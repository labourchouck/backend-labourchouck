import { Booking } from '../models/Booking.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { sendToUser } from '../services/notificationService.js'
import { refundBookingWalletDiscount } from '../services/bookingSettlementService.js'

export const acceptBroadcast = asyncHandler(async (req, res) => {
  const { bookingId } = req.params
  const laborId = req.user._id

  // 1. Check Cash Limit before allowing acceptance
  const { Wallet } = await import('../models/Wallet.js')
  const { SystemSetting } = await import('../models/SystemSetting.js')
  
  const wallet = await Wallet.findOne({ userId: laborId })
  if (wallet && wallet.adminBalance > 0) {
    let settings = await SystemSetting.findOne({ configKey: 'master_config' })
    if (settings && wallet.adminBalance >= (settings.labourCashLimit ?? 500)) {
      return sendError(res, { 
        message: `Cannot accept new bookings. You owe the admin ₹${wallet.adminBalance}. Please clear your dues first.`, 
        statusCode: HTTP_STATUS.FORBIDDEN 
      })
    }
  }

  // 2. Atomic FCFS Update
  // We only update if the booking is currently in BROADCASTING state.
  // This inherently prevents race conditions. The first update succeeds, subsequent updates find nothing or fail.
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'BROADCASTING' },
    { 
      $set: { 
        status: 'ACCEPTED', 
        acceptedLabourId: laborId, 
        laborId: laborId 
      } 
    },
    { new: true } // Returns the modified document
  )

  if (!booking) {
    // If it returns null, either the booking doesn't exist, was cancelled, or someone else accepted it first.
    // Let's check the actual state to return a precise message.
    const currentBooking = await Booking.findById(bookingId)
    if (!currentBooking) {
      return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }
    if (currentBooking.status === 'ACCEPTED') {
      return sendError(res, { message: 'Booking was already accepted by another labourer', statusCode: HTTP_STATUS.CONFLICT })
    }
    if (currentBooking.status === 'CANCELLED') {
      return sendError(res, { message: 'Booking was cancelled by the customer', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    return sendError(res, { message: `Cannot accept booking. Current status is ${currentBooking.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // 2. Notify the customer that the booking was accepted
  import('../socket.js').then(({ emitToUser, getIo }) => {
    emitToUser(booking.userId, 'BOOKING_ACCEPTED', { bookingId: booking._id, laborId: laborId })

    // Dismiss the offer for everyone else who received the broadcast
    const io = getIo()
    if (io) {
      io.emit('BOOKING_EXPIRED', { bookingId: booking._id, winnerId: laborId })
    }
  }).catch(err => console.error('Failed to notify sockets:', err))

  sendToUser(booking.userId, {
    title: 'Worker found!',
    body: `${req.user.fullName || 'A worker'} accepted your booking and will be on the way soon.`,
    type: 'BOOKING_ACCEPTED',
    data: { bookingId: String(booking._id), link: `/app/tracking/${booking._id}` },
  }).catch(err => console.error('Push notify (accepted) failed:', err))

  return sendSuccess(res, { message: 'Booking accepted successfully', data: { booking } })
})

export const rejectBroadcast = asyncHandler(async (req, res) => {
  const { bookingId } = req.params
  const laborId = req.user._id
  
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'BROADCASTING' },
    { $addToSet: { rejectedBy: laborId } },
    { new: true }
  )

  if (!booking) {
    return sendSuccess(res, { message: 'Booking already handled or no longer broadcasting' })
  }

  // If everyone eligible has rejected it, fail it immediately to save customer wait time
  if ((booking.rejectedBy?.length || 0) >= (booking.eligibleLabourCount || 0)) {
    booking.status = 'FAILED'
    await booking.save()
    await refundBookingWalletDiscount(booking, 'could not be matched')

    import('../socket.js').then(({ emitToUser, getIo }) => {
      emitToUser(booking.userId, 'BOOKING_FAILED', { bookingId: booking._id, reason: 'All available labourers declined' })

      const io = getIo()
      if (io) {
        io.emit('BOOKING_EXPIRED', { bookingId: booking._id })
      }
    }).catch(err => console.error('Failed to notify sockets on reject:', err))

    sendToUser(booking.userId, {
      title: 'No worker available',
      body: 'All nearby workers declined your booking. Please try again in a while.',
      type: 'BOOKING_FAILED',
      data: { bookingId: String(booking._id), reason: 'All declined', link: '/app/my-bookings' },
    }).catch(err => console.error('Push notify (all declined) failed:', err))
  }

  return sendSuccess(res, { message: 'Booking rejected successfully' })
})

const LEGACY_WINDOW_MS = 5 * 60 * 1000 // broadcasts sent by a server without recovery data used a 5 minute window

/**
 * GET /broadcasts/pending — offers this worker can still act on.
 *
 * The live socket event is easy to miss (app closed, reconnecting) and, when several server instances share
 * one database, the instance that sends a broadcast is not necessarily the one this worker is connected to.
 * So the answer comes from the database: an open (BROADCASTING) booking is offered to this worker if they were
 * recorded as eligible, or — for broadcasts sent by an instance that records nothing — if they qualify now
 * (skill, available, within radius, working hours, wallet limit).
 */
export const getPendingBroadcasts = asyncHandler(async (req, res) => {
  const laborId = req.user._id
  const now = new Date()
  const tag = `[PENDING ${String(laborId).slice(-6)}]`

  const [{ User }, { checkWalletEligibility }, { isWithinWorkingHours, haversineKm }] = await Promise.all([
    import('../models/User.js'),
    import('./walletController.js'),
    import('../services/broadcastService.js'),
  ])

  const me = await User.findById(laborId).select('labourProfile role').lean()
  const profile = me?.labourProfile || {}

  const { getBusyLabourIds } = await import('../services/broadcastService.js')
  const busySet = await getBusyLabourIds(Date.now())
  if (busySet.has(String(laborId))) {
    console.log(`${tag} worker is on another job right now, no offers`)
    return sendSuccess(res, { data: { offers: [] } })
  }

  const open = await Booking.find({ status: 'BROADCASTING', rejectedBy: { $ne: laborId } })
    .populate('userId', 'fullName phone')
    .sort({ scheduledAt: 1, createdAt: 1 })
    .lean()
  console.log(`${tag} ${open.length} open broadcast(s); worker status=${profile.availabilityStatus} hasLocation=${profile.currentLatitude != null}`)

  const offers = []
  for (const b of open) {
    const expiresAt = b.broadcastExpiresAt ? new Date(b.broadcastExpiresAt) : new Date(new Date(b.updatedAt).getTime() + LEGACY_WINDOW_MS)
    const label = `${tag} booking ${String(b._id).slice(-6)}`
    if (expiresAt <= now) {
      console.log(`${label} skipped: window closed at ${expiresAt.toISOString()}`)
      continue
    }

    const tracked = (b.eligibleLabourIds || []).length > 0
    if (tracked) {
      if (!b.eligibleLabourIds.some((id) => String(id) === String(laborId))) {
        console.log(`${label} skipped: not in the eligible list`)
        continue
      }
    } else {
      // Sent by an instance that did not record recipients: work out whether this worker qualifies.
      const [bLng, bLat] = b.address?.coordinates?.coordinates || []
      const radiusKm = b.broadcastRadius || 10
      const reasons = []
      if (profile.availabilityStatus !== 'available') reasons.push(`status is ${profile.availabilityStatus}`)
      if (!(profile.subcategoryIds || []).some((id) => String(id) === String(b.subcategoryId))) reasons.push('skill does not match')
      if (profile.currentLatitude == null || profile.currentLongitude == null) reasons.push('no location on file')
      else if (!bLat || !bLng) reasons.push('booking has no coordinates')
      else {
        const km = haversineKm(bLat, bLng, profile.currentLatitude, profile.currentLongitude)
        if (km > radiusKm) reasons.push(`${km.toFixed(1)}km away (limit ${radiusKm}km)`)
      }
      if (!isWithinWorkingHours(me, b)) reasons.push('outside working hours')
      if (!reasons.length && !(await checkWalletEligibility(laborId))) reasons.push('cash limit reached')
      if (reasons.length) {
        console.log(`${label} skipped: ${reasons.join('; ')}`)
        continue
      }
    }

    console.log(`${label} OFFERED (${tracked ? 'recorded recipient' : 'matched on request'}), ${Math.round((expiresAt - now) / 1000)}s left`)
    const [oLng, oLat] = b.address?.coordinates?.coordinates || []
    const distanceKm =
      oLat && oLng && profile.currentLatitude != null && profile.currentLongitude != null
        ? Math.round(haversineKm(oLat, oLng, profile.currentLatitude, profile.currentLongitude) * 10) / 10
        : null
    offers.push({
      distanceKm,
      bookingId: b._id,
      basePrice: b.basePrice,
      laborShare: b.laborShare,
      address: b.address,
      scheduledAt: b.scheduledAt,
      type: b.type,
      customer: b.userId,
      timeoutMs: Math.max(1000, expiresAt.getTime() - now.getTime()),
    })
  }

  return sendSuccess(res, { data: { offers } })
})

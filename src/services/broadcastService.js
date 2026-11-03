import os from 'os'
import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { BroadcastLog } from '../models/BroadcastLog.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { checkWalletEligibility } from '../controllers/walletController.js'
import { getRoadDistances } from '../utils/googleMapsDistance.js'
import { sendToUser, sendToUsers } from './notificationService.js'
import { refundBookingWalletDiscount } from './bookingSettlementService.js'

export const INSTANCE_ID = `${os.hostname()}:${process.pid}`

export const BROADCAST_TIMEOUT_MS = 300000 // 5 minutes flash broadcast timeout (instant bookings)

const SCHEDULED_MIN_WINDOW_MS = 5 * 60 * 1000
const SCHEDULED_MAX_WINDOW_MS = 30 * 60 * 1000
const SCHEDULED_START_BUFFER_MS = 10 * 60 * 1000

/**
 * How long a broadcast stays open. Instant jobs keep the 5 minute flash window. A scheduled job is
 * offered 1 hour ahead, so a worker who is briefly offline or busy gets a longer chance to respond —
 * up to 30 minutes, but never past 10 minutes before the job starts.
 */
export function getBroadcastWindowMs(booking, now = Date.now()) {
  if (booking.type !== 'SCHEDULED' || !booking.scheduledAt) return BROADCAST_TIMEOUT_MS
  const untilStart = new Date(booking.scheduledAt).getTime() - now - SCHEDULED_START_BUFFER_MS
  return Math.max(SCHEDULED_MIN_WINDOW_MS, Math.min(SCHEDULED_MAX_WINDOW_MS, untilStart))
}


const to24Hour = (timeStr) => {
  if (!timeStr) return ''
  const match = timeStr.match(/(\d+):(\d+)\s?(AM|PM)?/i)
  if (!match) return timeStr
  let [, h, m, ampm] = match
  h = parseInt(h, 10)
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && h < 12) h += 12
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
  }
  return `${String(h).padStart(2, '0')}:${m}`
}

const getIstDayAndTime = (dateObj) => {
  const options = { timeZone: 'Asia/Kolkata', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(dateObj)
  let day = '', hour = '', minute = ''
  for (const part of parts) {
    if (part.type === 'weekday') day = part.value
    if (part.type === 'hour') hour = part.value
    if (part.type === 'minute') minute = part.value
  }
  if (hour === '24') hour = '00'
  return { day, timeStr: `${hour}:${minute}` }
}

function getBookingTarget(booking) {
  const targetDate = booking.type === 'SCHEDULED' && booking.scheduledAt ? new Date(booking.scheduledAt) : new Date()
  const { day, timeStr } = getIstDayAndTime(targetDate)
  return { day, start: to24Hour(booking.timeSlot) || timeStr, end: to24Hour(booking.endTime) }
}

function describeBookingTime(booking) {
  const t = getBookingTarget(booking)
  return `day=${t.day} start=${t.start} end=${t.end || '(none)'}`
}

/** Does the booking's day/time fall inside this worker's weekly working hours? Shared by broadcast + pending-offer lookup. */
export function isWithinWorkingHours(labor, booking, verbose = false) {
  const { day, start, end } = getBookingTarget(booking)
  const why = (reason) => {
    if (verbose) console.log(`[BROADCAST]   - ${labor._id} dropped: ${reason}`)
    return false
  }
  const dayEntry = (labor.labourProfile?.schedule || []).find((e) => e.day === day)
  if (!dayEntry || !dayEntry.isAvailable) return why(`not available on ${day} (${dayEntry ? 'isAvailable=false' : 'no schedule entry'})`)

  const sTime = to24Hour(dayEntry.startTime || '00:00')
  const eTime = to24Hour(dayEntry.endTime || '23:59')
  if (start < sTime || start > eTime) return why(`job start ${start} outside working hours ${sTime}-${eTime}`)

  if (end) {
    if (end > eTime) return why(`job end ${end} after working hours end ${eTime}`)
  } else {
    const [h, m] = start.split(':')
    const bufferEndTime = `${String(parseInt(h, 10) + 1).padStart(2, '0')}:${m}`
    if (bufferEndTime <= '23:59' && bufferEndTime > eTime) return why(`1h buffer end ${bufferEndTime} after working hours end ${eTime}`)
  }
  return true
}

/** Straight-line distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Starts the flash broadcast for a new booking based on a radius zone.
 */
export async function startBroadcastCycle(bookingId) {
  const booking = await Booking.findById(bookingId).populate('userId', 'fullName phone')
  if (!booking || booking.status !== 'CREATED') {
    console.log(`[BROADCAST] ${bookingId} skipped: ${booking ? `status is ${booking.status}, expected CREATED` : 'booking not found'}`)
    return
  }
  console.log(`[BROADCAST] start ${booking._id} type=${booking.type} scheduledAt=${booking.scheduledAt?.toISOString?.()} timeSlot=${booking.timeSlot} endTime=${booking.endTime} subcategoryId=${booking.subcategoryId}`)

  // 1. Get Radius Setting
  const settings = await SystemSetting.findOne({ configKey: 'master_config' })
  const radiusKm = settings?.bookingBroadcastRadius || 10

  // Log snapshot of radius onto booking
  booking.broadcastRadius = radiusKm

  // Validate coordinates
  const bookingLng = booking.address?.coordinates?.coordinates[0]
  const bookingLat = booking.address?.coordinates?.coordinates[1]

  if (!bookingLng || !bookingLat) {
    console.error(`Booking ${bookingId} FAILED: Invalid coordinates for zone broadcast.`)
    booking.status = 'FAILED'
    await booking.save()
    await refundBookingWalletDiscount(booking, 'could not be matched')
    // Emit to customer
    import('../socket.js').then(({ emitToUser }) => {
      emitToUser(booking.userId, 'BOOKING_FAILED', { bookingId, reason: 'Invalid location' })
    }).catch(err => console.error(err))
    return
  }

  // Claim the booking atomically. Several server instances can share one database (each runs the cron),
  // so only the one that flips CREATED -> BROADCASTING may send the offers; the rest must back off.
  const claimed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'CREATED' },
    { $set: { status: 'BROADCASTING', broadcastRadius: radiusKm, broadcastBy: INSTANCE_ID } },
    { new: true },
  )
  if (!claimed) {
    console.log(`[BROADCAST] ${booking._id} already claimed by another instance, skipping (this instance: ${INSTANCE_ID})`)
    return
  }
  booking.status = 'BROADCASTING'
  booking.broadcastBy = INSTANCE_ID
  console.log(`[BROADCAST] ${booking._id} claimed by ${INSTANCE_ID}`)

  console.log(`[BROADCAST] ${booking._id} radius=${radiusKm}km coords lat=${bookingLat} lng=${bookingLng}`)

  // 2. Pre-filter labourers by bounding box (rough estimate to avoid hitting Google Maps for everyone)
  const latDiff = radiusKm / 111
  const lngDiff = radiusKm / (111 * Math.cos(bookingLat * (Math.PI / 180)))

  // Multiply radius slightly to ensure we don't accidentally cut off corners in the rough box
  const bufferLatDiff = latDiff * 1.2
  const bufferLngDiff = lngDiff * 1.2

  // EXCLUDE labourers who are already busy with an active job
  const busyBookings = await Booking.find({
    status: { $in: ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED'] },
    acceptedLabourId: { $exists: true, $ne: null }
  }).select('acceptedLabourId').lean()
  const busyLabourIds = busyBookings.map(b => b.acceptedLabourId)

  const potentialLaborersRaw = await User.find({
    _id: { $nin: busyLabourIds },
    role: { $in: ['labour', 'contractor'] },
    'labourProfile.availabilityStatus': 'available',
    'labourProfile.currentLatitude': { $gte: bookingLat - bufferLatDiff, $lte: bookingLat + bufferLatDiff },
    'labourProfile.currentLongitude': { $gte: bookingLng - bufferLngDiff, $lte: bookingLng + bufferLngDiff },
    'labourProfile.subcategoryIds': booking.subcategoryId,
    // Labour only take part once the admin has approved their KYC (contractors have their own verification).
    $or: [{ role: 'contractor' }, { role: 'labour', 'labourProfile.kycStatus': 'verified' }],
  }).lean()

  console.log(`[BROADCAST] ${booking._id} stage1 area+skill+available: ${potentialLaborersRaw.length} labourers (busy excluded: ${busyLabourIds.length})`)
  if (potentialLaborersRaw.length === 0) {
    const total = await User.countDocuments({ role: { $in: ['labour', 'contractor'] } })
    const avail = await User.countDocuments({ role: { $in: ['labour', 'contractor'] }, 'labourProfile.availabilityStatus': 'available' })
    const withLoc = await User.countDocuments({ role: { $in: ['labour', 'contractor'] }, 'labourProfile.availabilityStatus': 'available', 'labourProfile.currentLatitude': { $exists: true, $ne: null } })
    const withSkill = await User.countDocuments({ role: { $in: ['labour', 'contractor'] }, 'labourProfile.subcategoryIds': booking.subcategoryId })
    console.log(`[BROADCAST] ${booking._id} stage1 diagnostics: workers=${total}, available=${avail}, available+hasLocation=${withLoc}, haveThisSkill=${withSkill}`)
  }

  console.log(`[BROADCAST] ${booking._id} schedule check for ${describeBookingTime(booking)}`)
  const potentialLaborers = potentialLaborersRaw.filter((labor) => isWithinWorkingHours(labor, booking, true))
  console.log(`[BROADCAST] ${booking._id} stage2 working-hours schedule: ${potentialLaborers.length} of ${potentialLaborersRaw.length} remain`)

  if (potentialLaborers.length === 0) {
    await markBookingFailed(booking, 'No laborers in area')
    return
  }

  // 3. Wallet Eligibility Filter
  const walletEligible = []
  for (const labor of potentialLaborers) {
    const isEligible = await checkWalletEligibility(labor._id)
    if (isEligible) {
      walletEligible.push(labor)
    }
  }

  console.log(`[BROADCAST] ${booking._id} stage3 wallet limit: ${walletEligible.length} of ${potentialLaborers.length} remain`)
  if (walletEligible.length === 0) {
    await markBookingFailed(booking, 'No eligible laborers found')
    return
  }

  // 4. Precise Distance Filter (Google Maps)
  const destinations = walletEligible.map(l => ({
    id: String(l._id),
    lat: l.labourProfile.currentLatitude,
    lng: l.labourProfile.currentLongitude
  }))

  const distances = await getRoadDistances(bookingLat, bookingLng, destinations)
  
  const eligibleLaborers = walletEligible.filter(labor => {
    const distData = distances.find(d => d.id === String(labor._id))
    // Include them if distance is within radius. 
    // If FALLBACK or error, we still include if Haversine said it's within radius
    return distData && distData.distanceKm <= radiusKm
  })

  console.log(`[BROADCAST] ${booking._id} stage4 road distance <= ${radiusKm}km: ${eligibleLaborers.length} of ${walletEligible.length} remain; distances=${JSON.stringify(distances.map(d => ({ id: d.id, km: d.distanceKm === Infinity ? 'Infinity' : Number(d.distanceKm?.toFixed?.(2)), status: d.status })))}`)

  // 5. Update eligible count + remember who was offered (so missed offers can be recovered)
  const offerWindowMs = getBroadcastWindowMs(booking)
  booking.eligibleLabourCount = eligibleLaborers.length
  booking.eligibleLabourIds = eligibleLaborers.map((l) => l._id)
  booking.broadcastExpiresAt = new Date(Date.now() + offerWindowMs)
  await booking.save()
  console.log(`[BROADCAST] ${booking._id} offer window ${Math.round(offerWindowMs / 60000)} min, expires ${booking.broadcastExpiresAt.toISOString()}`)

  if (eligibleLaborers.length === 0) {
    await markBookingFailed(booking, 'No laborers within actual driving radius')
    return
  }

  // 6. Flash Broadcast via WebSockets
  console.log(`Flash broadcasting Booking ${booking._id} to ${eligibleLaborers.length} laborers`)

  // Notify customer
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_BROADCAST_STARTED', { 
      bookingId: booking._id,
      radiusKm: radiusKm,
      eligibleCount: eligibleLaborers.length
    })

    // Notify all eligible laborers
    eligibleLaborers.forEach(labor => {
      emitToUser(labor._id, 'BOOKING_RECEIVED', {
        bookingId: booking._id,
        basePrice: booking.basePrice,
        laborShare: booking.laborShare,
        address: booking.address,
        scheduledAt: booking.scheduledAt,
        type: booking.type,
        customer: booking.userId,
        timeoutMs: offerWindowMs
      })
    })
  }).catch(err => console.error('Failed to load socket emitter:', err))

  // Push notification to eligible laborers (reaches devices even when the app is closed)
  sendToUsers(eligibleLaborers.map(l => l._id), {
    title: 'New job offer nearby',
    body: `₹${booking.laborShare || booking.basePrice || ''} · ${booking.address?.text || 'Near you'}. Open the app to accept — offer expires soon!`,
    type: 'BOOKING_RECEIVED',
    data: { bookingId: String(booking._id), link: '/app' },
  }).catch(err => console.error('Push notify (offer) failed:', err))

  // Set timeout to expire broadcast if no one accepts
  setTimeout(async () => {
    const currentBooking = await Booking.findById(booking._id)
    if (currentBooking && currentBooking.status === 'BROADCASTING') {
      currentBooking.status = 'FAILED'
      await currentBooking.save()
      await refundBookingWalletDiscount(currentBooking, 'expired')
      console.log(`Booking ${booking._id} EXPIRED without acceptance.`)
      
      // Notify customer
      import('../socket.js').then(({ emitToUser }) => {
        emitToUser(currentBooking.userId, 'BOOKING_FAILED', { bookingId: currentBooking._id, reason: 'Expired' })

        // Notify laborers that it expired
        eligibleLaborers.forEach(labor => {
          emitToUser(labor._id, 'BOOKING_EXPIRED', { bookingId: currentBooking._id })
        })
      }).catch(err => console.error(err))

      sendToUser(currentBooking.userId, {
        title: 'No worker found',
        body: 'Sorry, no worker accepted your booking in time. Please try booking again.',
        type: 'BOOKING_FAILED',
        data: { bookingId: String(currentBooking._id), reason: 'Expired', link: '/app/my-bookings' },
      }).catch(err => console.error('Push notify (expiry) failed:', err))
    }
  }, offerWindowMs)
}

async function markBookingFailed(booking, reason) {
  booking.status = 'FAILED'
  await booking.save()
  await refundBookingWalletDiscount(booking, 'could not be matched')
  console.log(`Booking ${booking._id} FAILED: ${reason}`)
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_FAILED', { bookingId: booking._id, reason })
  }).catch(err => console.error(err))

  sendToUser(booking.userId, {
    title: 'Booking could not be placed',
    body: 'We could not find an available worker for your booking. Please try again.',
    type: 'BOOKING_FAILED',
    data: { bookingId: String(booking._id), reason, link: '/app/my-bookings' },
  }).catch(err => console.error('Push notify (failed) failed:', err))
}

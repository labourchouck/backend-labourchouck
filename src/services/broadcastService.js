import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { BroadcastLog } from '../models/BroadcastLog.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { checkWalletEligibility } from '../controllers/walletController.js'
import { getRoadDistances } from '../utils/googleMapsDistance.js'
import { sendToUser, sendToUsers } from './notificationService.js'

export const BROADCAST_TIMEOUT_MS = 300000 // 5 minutes flash broadcast timeout

/**
 * Starts the flash broadcast for a new booking based on a radius zone.
 */
export async function startBroadcastCycle(bookingId) {
  const booking = await Booking.findById(bookingId).populate('userId', 'fullName phone')
  if (!booking || booking.status !== 'CREATED') return

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
    // Emit to customer
    import('../socket.js').then(({ emitToUser }) => {
      emitToUser(booking.userId, 'BOOKING_FAILED', { bookingId, reason: 'Invalid location' })
    }).catch(err => console.error(err))
    return
  }

  booking.status = 'BROADCASTING'
  await booking.save()

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
    'labourProfile.subcategoryIds': booking.subcategoryId
  }).lean()

  const to24Hour = (timeStr) => {
    if (!timeStr) return ''
    const match = timeStr.match(/(\d+):(\d+)\s?(AM|PM)?/i)
    if (!match) return timeStr
    let [ , h, m, ampm ] = match
    h = parseInt(h, 10)
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
    }
    return `${String(h).padStart(2, '0')}:${m}`
  }

  const getIstDayAndTime = (dateObj) => {
    const options = { timeZone: 'Asia/Kolkata', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }
    const formatter = new Intl.DateTimeFormat('en-US', options)
    const parts = formatter.formatToParts(dateObj)
    let day = '', hour = '', minute = ''
    for (const part of parts) {
      if (part.type === 'weekday') day = part.value
      if (part.type === 'hour') hour = part.value
      if (part.type === 'minute') minute = part.value
    }
    if (hour === '24') hour = '00'
    return { day, timeStr: `${hour}:${minute}` }
  }

  const targetDate = (booking.type === 'SCHEDULED' && booking.scheduledAt) ? new Date(booking.scheduledAt) : new Date()
  const { day: targetDayName, timeStr: currentIstTimeStr } = getIstDayAndTime(targetDate)
  const targetStartTimeStr = to24Hour(booking.timeSlot) || currentIstTimeStr
  const targetEndTimeStr = to24Hour(booking.endTime)

  const potentialLaborers = potentialLaborersRaw.filter(labor => {
    const schedule = labor.labourProfile?.schedule || []
    const dayEntry = schedule.find(s => s.day === targetDayName)
    if (!dayEntry || !dayEntry.isAvailable) return false
    
    const sTime = to24Hour(dayEntry.startTime || '00:00')
    const eTime = to24Hour(dayEntry.endTime || '23:59')
    
    if (targetStartTimeStr < sTime || targetStartTimeStr > eTime) return false

    if (targetEndTimeStr) {
      if (targetEndTimeStr > eTime) return false
    } else {
      let [h, m] = targetStartTimeStr.split(':')
      h = parseInt(h, 10) + 1
      const bufferEndTime = `${String(h).padStart(2, '0')}:${m}`
      if (bufferEndTime <= '23:59' && bufferEndTime > eTime) return false
    }

    return true
  })

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

  // 5. Update eligible count
  booking.eligibleLabourCount = eligibleLaborers.length
  await booking.save()

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
        timeoutMs: BROADCAST_TIMEOUT_MS
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
  }, BROADCAST_TIMEOUT_MS)
}

async function markBookingFailed(booking, reason) {
  booking.status = 'FAILED'
  await booking.save()
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

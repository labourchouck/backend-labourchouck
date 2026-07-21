import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { BroadcastLog } from '../models/BroadcastLog.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { checkWalletEligibility } from '../controllers/walletController.js'
import { getRoadDistances } from '../utils/googleMapsDistance.js'

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

  const potentialLaborers = await User.find({
    role: { $in: ['labour', 'contractor'] },
    'labourProfile.availabilityStatus': 'available',
    'labourProfile.currentLatitude': { $gte: bookingLat - bufferLatDiff, $lte: bookingLat + bufferLatDiff },
    'labourProfile.currentLongitude': { $gte: bookingLng - bufferLngDiff, $lte: bookingLng + bufferLngDiff },
    'labourProfile.subcategoryIds': booking.subcategoryId
  }).lean()

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
}

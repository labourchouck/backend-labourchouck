import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { BroadcastLog } from '../models/BroadcastLog.js'
import { checkWalletEligibility } from '../controllers/walletController.js'

// In a real distributed system, we would use Redis/BullMQ to handle the timeout queues.
// For this MVP, we use in-memory NodeJS timeouts.
const activeBroadcastTimeouts = new Map()

export const BROADCAST_TIMEOUT_MS = 30000 // 30 seconds per labor

/**
 * Finds eligible laborers for a given booking based on:
 * 1. Online status
 * 2. Subcategory support
 * 3. Price range overlaps with Booking's laborShare
 * 4. Wallet admin balance under limit
 */
async function findEligibleLaborers(booking) {
  // 1 & 2 & 3: Database Query
  const potentialLaborers = await User.find({
    role: { $in: ['LABOUR', 'INDIVIDUAL'] },
    'labourProfile.availabilityStatus': 'available',
    'labourProfile.subcategoryIds': booking.subcategoryId,
    'labourProfile.minAcceptedPrice': { $lte: booking.laborShare },
    $or: [
      { 'labourProfile.maxAcceptedPrice': { $gte: booking.laborShare } },
      { 'labourProfile.maxAcceptedPrice': null }, // If max is not set, they accept any amount above min
    ]
  }).lean()

  // 4: Wallet Validation (Could be optimized with aggregate joins, doing it iteratively for clarity here)
  const eligible = []
  for (const labor of potentialLaborers) {
    const isEligible = await checkWalletEligibility(labor._id)
    if (isEligible) {
      eligible.push(labor)
    }
  }

  // Sort the eligible labourers price wise (lowest minAcceptedPrice first)
  eligible.sort((a, b) => {
    const aPrice = a.labourProfile?.minAcceptedPrice || 0
    const bPrice = b.labourProfile?.minAcceptedPrice || 0
    return aPrice - bPrice
  })

  // Ideally, sort by distance here if coordinates exist, but currently sorted by price
  return eligible
}

/**
 * Starts the broadcast chain for a new booking.
 */
export async function startBroadcastCycle(bookingId) {
  const booking = await Booking.findById(bookingId)
  if (!booking || booking.status !== 'CREATED') return

  booking.status = 'BROADCASTING'
  await booking.save()

  const eligibleLaborers = await findEligibleLaborers(booking)

  if (eligibleLaborers.length === 0) {
    booking.status = 'FAILED'
    await booking.save()
    console.log(`Booking ${bookingId} FAILED: No eligible laborers found.`)
    return
  }

  // Store queue in memory for sequential processing
  await processNextInQueue(bookingId, eligibleLaborers)
}

/**
 * Processes the next labor in the queue.
 */
async function processNextInQueue(bookingId, laborQueue) {
  const booking = await Booking.findById(bookingId)
  if (!booking || booking.status !== 'BROADCASTING') return // Booking accepted or cancelled

  if (laborQueue.length === 0) {
    booking.status = 'FAILED'
    await booking.save()
    console.log(`Booking ${bookingId} FAILED: Queue exhausted.`)
    return
  }

  const nextLabor = laborQueue.shift() // Dequeue

  // Create Broadcast Log
  const log = await BroadcastLog.create({
    bookingId: booking._id,
    laborId: nextLabor._id,
    status: 'PENDING'
  })

  // Emit WebSocket event to this specific Labor here
  console.log(`Emitting BROADCAST to Labor ${nextLabor._id} for Booking ${booking._id}`)
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(nextLabor._id, 'NEW_BROADCAST', {
      bookingId: booking._id,
      logId: log._id,
      basePrice: booking.basePrice,
      laborShare: booking.laborShare,
      address: booking.address,
      scheduledAt: booking.scheduledAt,
      type: booking.type,
      timeoutMs: BROADCAST_TIMEOUT_MS
    })
  }).catch(err => console.error('Failed to load socket emitter:', err))

  // Set timeout for 30s
  const timeoutId = setTimeout(async () => {
    // 30 seconds elapsed, check if still pending
    const currentLog = await BroadcastLog.findById(log._id)
    if (currentLog && currentLog.status === 'PENDING') {
      currentLog.status = 'TIMEOUT'
      await currentLog.save()
      console.log(`Broadcast TIMEOUT for Labor ${nextLabor._id}`)
      
      // Recursively process next
      await processNextInQueue(bookingId, laborQueue)
    }
  }, BROADCAST_TIMEOUT_MS)

  activeBroadcastTimeouts.set(String(log._id), { timeoutId, laborQueue })
}

/**
 * Cancels a pending timeout for a broadcast log (used when accepted/rejected)
 */
export function cancelBroadcastTimeout(logId) {
  const meta = activeBroadcastTimeouts.get(String(logId))
  if (meta) {
    clearTimeout(meta.timeoutId)
    activeBroadcastTimeouts.delete(String(logId))
    return meta.laborQueue
  }
  return null
}

export async function continueBroadcastCycle(bookingId, laborQueue) {
  await processNextInQueue(bookingId, laborQueue)
}

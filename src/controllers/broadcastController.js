import { BroadcastLog } from '../models/BroadcastLog.js'
import { Booking } from '../models/Booking.js'
import { cancelBroadcastTimeout, continueBroadcastCycle } from '../services/broadcastService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const acceptBroadcast = asyncHandler(async (req, res) => {
  const { logId } = req.params

  const log = await BroadcastLog.findById(logId)
  if (!log) {
    return sendError(res, { message: 'Broadcast not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (log.status !== 'PENDING') {
    return sendError(res, { message: `Cannot accept broadcast. Current status is ${log.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (String(log.laborId) !== String(req.user._id)) {
    return sendError(res, { message: 'Unauthorized access to this broadcast', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const booking = await Booking.findById(log.bookingId)
  if (!booking || booking.status !== 'BROADCASTING') {
    return sendError(res, { message: 'Booking is no longer available', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Cancel the timeout for this specific broadcast
  cancelBroadcastTimeout(log._id)

  // Update statuses
  log.status = 'ACCEPTED'
  log.respondedAt = new Date()
  await log.save()

  // Concurrency note: In a real high-scale environment, we should use MongoDB findOneAndUpdate with status check
  // or Redis distributed locking here to ensure two laborers don't accept simultaneously if the timeout logic has a race condition.
  booking.laborId = log.laborId
  booking.status = 'ACCEPTED'
  await booking.save()

  // Phase 4: Notify the customer that the booking was accepted
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_ACCEPTED', { bookingId: booking._id, laborId: log.laborId })
  }).catch(err => console.error('Failed to notify customer:', err))

  return sendSuccess(res, { message: 'Booking accepted successfully', data: { booking } })
})

export const rejectBroadcast = asyncHandler(async (req, res) => {
  const { logId } = req.params

  const log = await BroadcastLog.findById(logId)
  if (!log) {
    return sendError(res, { message: 'Broadcast not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (log.status !== 'PENDING') {
    return sendError(res, { message: `Cannot reject broadcast. Current status is ${log.status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (String(log.laborId) !== String(req.user._id)) {
    return sendError(res, { message: 'Unauthorized access to this broadcast', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  // Cancel the timeout since they responded immediately
  const remainingQueue = cancelBroadcastTimeout(log._id)

  // Update statuses
  log.status = 'REJECTED'
  log.respondedAt = new Date()
  await log.save()

  // Resume the broadcast cycle with the remaining queue immediately
  if (remainingQueue) {
    continueBroadcastCycle(log.bookingId, remainingQueue).catch(err => console.error('Broadcast Resume Error:', err))
  }

  return sendSuccess(res, { message: 'Booking rejected' })
})

import { Booking } from '../models/Booking.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const acceptBroadcast = asyncHandler(async (req, res) => {
  const { bookingId } = req.params
  const laborId = req.user._id

  // 1. Atomic FCFS Update
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
  import('../socket.js').then(({ emitToUser, getSocketServer }) => {
    emitToUser(booking.userId, 'BOOKING_ACCEPTED', { bookingId: booking._id, laborId: laborId })
    
    // In a real production system, you'd emit BOOKING_EXPIRED to everyone who received the broadcast, 
    // EXCEPT the winner. For now, broadcasting globally to all connected clients is an option, 
    // or relying on a room.
    const io = getSocketServer()
    if (io) {
      io.emit('BOOKING_EXPIRED', { bookingId: booking._id, winnerId: laborId })
    }
  }).catch(err => console.error('Failed to notify sockets:', err))

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
  if (booking.rejectedBy.length >= (booking.eligibleLabourCount || 0)) {
    booking.status = 'FAILED'
    await booking.save()

    import('../socket.js').then(({ emitToUser, getSocketServer }) => {
      emitToUser(booking.userId, 'BOOKING_FAILED', { bookingId: booking._id, reason: 'All available labourers declined' })
      
      const io = getSocketServer()
      if (io) {
        io.emit('BOOKING_EXPIRED', { bookingId: booking._id })
      }
    }).catch(err => console.error('Failed to notify sockets on reject:', err))
  }

  return sendSuccess(res, { message: 'Booking rejected successfully' })
})

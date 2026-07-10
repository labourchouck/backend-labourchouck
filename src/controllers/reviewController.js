import { Review } from '../models/Review.js'
import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const submitReview = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment } = req.body

  const booking = await Booking.findById(bookingId)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (booking.status !== 'COMPLETED') {
    return sendError(res, { message: 'Can only review completed bookings', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let revieweeId
  if (String(booking.userId) === String(req.user._id)) {
    revieweeId = booking.laborId // Customer reviewing Labor
  } else if (String(booking.laborId) === String(req.user._id)) {
    revieweeId = booking.userId // Labor reviewing Customer
  } else {
    return sendError(res, { message: 'Unauthorized to review this booking', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const existingReview = await Review.findOne({ bookingId, reviewerId: req.user._id })
  if (existingReview) {
    return sendError(res, { message: 'You have already reviewed this booking', statusCode: HTTP_STATUS.CONFLICT })
  }

  const review = await Review.create({
    bookingId,
    reviewerId: req.user._id,
    revieweeId,
    rating,
    comment
  })

  return sendSuccess(res, { message: 'Review submitted successfully', data: { review } })
})

export const getReviews = asyncHandler(async (req, res) => {
  const { userId } = req.params
  
  const reviews = await Review.find({ revieweeId: userId }).populate('reviewerId', 'name').sort({ createdAt: -1 })
  
  // Calculate average
  const total = reviews.reduce((sum, r) => sum + r.rating, 0)
  const averageRating = reviews.length > 0 ? (total / reviews.length).toFixed(1) : 0

  return sendSuccess(res, { data: { reviews, averageRating, totalReviews: reviews.length } })
})

import { Review } from '../models/Review.js'
import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'

export const submitReview = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment, revieweeId: reqRevieweeId } = req.body

  let booking = await Booking.findById(bookingId)
  let request = null

  if (!booking) {
    request = await WorkforceRequest.findById(bookingId)
    if (!request) {
      return sendError(res, { message: 'Booking or Request not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }
  }

  if (booking && booking.status !== 'COMPLETED') {
    return sendError(res, { message: 'Can only review completed bookings', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (request && !['completed', 'billing'].includes(request.status)) {
    return sendError(res, { message: 'Can only review completed requests', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let revieweeId = reqRevieweeId
  if (!revieweeId) {
    if (booking && String(booking.userId) === String(req.user._id)) {
      revieweeId = booking.laborId
    } else if (booking && String(booking.laborId) === String(req.user._id)) {
      revieweeId = booking.userId
    } else {
      return sendError(res, { message: 'Unauthorized to review this booking / missing revieweeId', statusCode: HTTP_STATUS.FORBIDDEN })
    }
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

export const getAllReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({})
    .populate('reviewerId', 'name fullName email phone profileImageUrl role')
    .populate('revieweeId', 'name fullName email phone profileImageUrl role')
    .populate({
      path: 'bookingId',
      select: 'type scheduledAt timeSlot status',
    })
    .sort({ createdAt: -1 })
    
  return sendSuccess(res, { data: { reviews, totalReviews: reviews.length } })
})

import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const getAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query
  const skip = (page - 1) * limit
  
  const query = {}

  if (status && status !== 'ALL') {
    query.status = status
  }

  // Populate users beforehand if search exists, though typical simple search just matches IDs
  // To keep it simple, we'll just filter by status for now.

  const total = await Booking.countDocuments(query)
  const bookings = await Booking.find(query)
    .populate('userId', 'fullName phone email profileImageUrl')
    .populate('laborId', 'fullName phone email profileImageUrl')
    .populate('subcategoryId', 'name')
    .populate('serviceId', 'name basePrice')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  return sendSuccess(res, {
    data: {
      bookings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    }
  })
})

export const getBookingDetails = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('userId', 'fullName phone email profileImageUrl')
    .populate('laborId', 'fullName phone email profileImageUrl')
    .populate('subcategoryId', 'name')
    .populate('serviceId', 'name basePrice')
    .lean()

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { data: { booking } })
})

export const updateBookingStatusAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  const validStatuses = [
    'DRAFT', 'CREATED', 'BROADCASTING', 'ACCEPTED', 
    'ASSIGNED', 'EN_ROUTE', 'STARTED', 'COMPLETED', 
    'CANCELLED', 'REFUNDED', 'FAILED'
  ]

  if (!validStatuses.includes(status)) {
    return sendError(res, { message: 'Invalid status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const booking = await Booking.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  ).populate('userId', 'fullName phone email')
   .populate('laborId', 'fullName phone email')

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  // Optionally notify user here if socket is imported

  return sendSuccess(res, { message: 'Booking status updated successfully', data: { booking } })
})

export const assignLabourerManually = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { laborId } = req.body

  if (!laborId) {
    return sendError(res, { message: 'Labour ID is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const labourer = await User.findById(laborId)
  if (!labourer || !['labour', 'contractor'].includes(labourer.role)) {
    return sendError(res, { message: 'Valid labourer is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const booking = await Booking.findById(id)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(booking.status)) {
    return sendError(res, { message: 'Cannot assign labourer to a completed or cancelled booking', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  booking.laborId = laborId
  booking.acceptedLabourId = laborId
  booking.status = 'ASSIGNED'
  await booking.save()

  const updatedBooking = await Booking.findById(id)
    .populate('userId', 'fullName phone email profileImageUrl')
    .populate('laborId', 'fullName phone email profileImageUrl')
    .populate('subcategoryId', 'name')
    .populate('serviceId', 'name basePrice')
    .lean()

  return sendSuccess(res, { message: 'Labourer assigned manually successfully', data: { booking: updatedBooking } })
})

export const createBookingAdmin = asyncHandler(async (req, res) => {
  const bookingData = req.body
  
  // Add some minimum validations based on what your Booking model expects
  if (!bookingData.userId || !bookingData.serviceId || !bookingData.type) {
    return sendError(res, { message: 'userId, serviceId, and type are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const startOtp = Math.floor(1000 + Math.random() * 9000).toString()
  const completionOtp = Math.floor(1000 + Math.random() * 9000).toString()

  const booking = await Booking.create({
    ...bookingData,
    startOtp,
    completionOtp
  })
  
  return sendSuccess(res, { message: 'Booking created successfully', statusCode: HTTP_STATUS.CREATED, data: { booking } })
})

export const updateBookingAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params
  const updates = req.body

  const booking = await Booking.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
    .populate('userId', 'fullName phone email')
    .populate('laborId', 'fullName phone email')
    .populate('subcategoryId', 'name')
    .populate('serviceId', 'name basePrice')

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { message: 'Booking updated successfully', data: { booking } })
})

export const deleteBookingAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params

  const booking = await Booking.findByIdAndDelete(id)

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { message: 'Booking deleted successfully' })
})

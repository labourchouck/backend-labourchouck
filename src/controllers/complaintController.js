import { Complaint } from '../models/Complaint.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendError, sendSuccess, HTTP_STATUS } from '../utils/apiResponse.js'

export const submitComplaint = asyncHandler(async (req, res) => {
  const { bookingId, complaineeId, title, description } = req.body

  if (complaineeId && req.user._id.toString() === complaineeId) {
    return sendError(res, { message: 'You cannot complain against yourself', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const complaint = await Complaint.create({
    bookingId,
    complainantId: req.user._id,
    complaineeId,
    title,
    description,
    status: 'OPEN'
  })

  return sendSuccess(res, { message: 'Complaint submitted successfully', data: { complaint } }, HTTP_STATUS.CREATED)
})

export const getMyComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ complainantId: req.user._id })
    .populate('complaineeId', 'name phone role')
    .populate('bookingId', 'status type')
    .sort({ createdAt: -1 })
    .lean()

  return sendSuccess(res, { data: { complaints } })
})

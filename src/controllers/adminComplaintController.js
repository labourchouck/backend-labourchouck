import { Complaint } from '../models/Complaint.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendError, sendSuccess, HTTP_STATUS } from '../utils/apiResponse.js'

export const getAllComplaints = asyncHandler(async (req, res) => {
  const { status, role, page = 1, limit = 20 } = req.query
  const query = status && status !== 'ALL' ? { status } : {}
  
  if (role && role !== 'ALL') {
    const users = await User.find({ role }).select('_id')
    query.complainantId = { $in: users.map(u => u._id) }
  }

  const skip = (Number(page) - 1) * Number(limit)

  const complaints = await Complaint.find(query)
    .populate('complainantId', 'fullName phone role')
    .populate('complaineeId', 'fullName phone role')
    .populate('bookingId', 'status type locationText')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  const total = await Complaint.countDocuments(query)

  return sendSuccess(res, {
    data: {
      complaints,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    },
  })
})

export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, adminRemarks } = req.body

  const complaint = await Complaint.findById(id)
  if (!complaint) {
    return sendError(res, { message: 'Complaint not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (status) complaint.status = status
  if (adminRemarks !== undefined) complaint.adminRemarks = adminRemarks

  await complaint.save()

  return sendSuccess(res, { message: 'Complaint updated successfully', data: { complaint } })
})

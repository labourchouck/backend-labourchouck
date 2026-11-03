import { Complaint } from '../models/Complaint.js'
import { sendToUser } from '../services/notificationService.js'
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

  // Counts per status for the current role filter (not the status filter), so the header counters stay right on every page.
  const countQuery = { ...query }
  delete countQuery.status
  const countRows = await Complaint.aggregate([{ $match: countQuery }, { $group: { _id: '$status', n: { $sum: 1 } } }])
  const statusCounts = Object.fromEntries(countRows.map((r) => [r._id || 'OPEN', r.n]))

  return sendSuccess(res, {
    data: {
      statusCounts,
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

  if (status) {
    const complainant = await User.findById(complaint.complainantId).select('role').lean()
    const homes = { labour: '/app', contractor: '/vendor', corporate: '/corporate' }
    sendToUser(complaint.complainantId, {
      title: 'Complaint update',
      body: `Your complaint "${complaint.title}" is now ${String(status).replace(/_/g, ' ').toLowerCase()}.${complaint.adminRemarks ? ` Admin note: ${complaint.adminRemarks}` : ''}`,
      type: 'COMPLAINT_UPDATE',
      data: { complaintId: String(complaint._id), status: String(status), link: homes[complainant?.role] || '/app' },
    }).catch((err) => console.error('Push notify (complaint) failed:', err))
  }

  return sendSuccess(res, { message: 'Complaint updated successfully', data: { complaint } })
})

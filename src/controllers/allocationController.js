import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import { REQUEST_STATUS, ASSIGNMENT_STATUS } from '../constants/workforceConstants.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const createAllocationAdmin = asyncHandler(async (req, res) => {
  const { requestId, vendorId, labourIds, notes } = req.body
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return sendError(res, { message: 'Invalid requestId', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const request = await WorkforceRequest.findById(requestId)
  if (!request) return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })

  let allocation = await Allocation.findOne({ requestId })
  if (!allocation) {
    allocation = await Allocation.create({
      requestId,
      adminId: req.user._id,
      vendorId: vendorId && mongoose.Types.ObjectId.isValid(vendorId) ? vendorId : undefined,
      notes,
    })
  } else {
    if (vendorId) allocation.vendorId = vendorId
    if (notes != null) allocation.notes = notes
    allocation.adminId = req.user._id
    await allocation.save()
  }

  const ids = Array.isArray(labourIds) ? labourIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) : []
  const assignments = []
  for (const labourId of ids) {
    const labour = await User.findOne({ _id: labourId, role: USER_ROLES.LABOUR, isActive: true })
    if (!labour) continue
    const existing = await Assignment.findOne({
      allocationId: allocation._id,
      labourId,
      status: { $nin: [ASSIGNMENT_STATUS.REPLACED, ASSIGNMENT_STATUS.DECLINED] },
    })
    if (existing) continue
    const line = request.lines?.[0]
    const assignment = await Assignment.create({
      allocationId: allocation._id,
      requestId: request._id,
      labourId,
      vendorId: labour.vendorId || allocation.vendorId,
      categoryId: line?.categoryId,
      status: ASSIGNMENT_STATUS.OFFERED,
    })
    assignments.push(assignment)
  }

  if (request.status === REQUEST_STATUS.PENDING_REVIEW || request.status === REQUEST_STATUS.CONFIRMED) {
    request.status = REQUEST_STATUS.ALLOCATING
    await request.save()
  }
  if (assignments.length) {
    request.status = REQUEST_STATUS.ASSIGNED
    await request.save()
  }

  sendSuccess(res, { allocation, assignments }, HTTP_STATUS.CREATED)
})

export const replaceAssignmentAdmin = asyncHandler(async (req, res) => {
  const { newLabourId, reason } = req.body
  const old = await Assignment.findById(req.params.id)
  if (!old) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })
  old.status = ASSIGNMENT_STATUS.REPLACED
  old.replaceReason = reason
  old.replacedBy = req.user._id
  await old.save()

  const labour = await User.findOne({ _id: newLabourId, role: USER_ROLES.LABOUR })
  if (!labour) return sendError(res, { message: 'Labour not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const assignment = await Assignment.create({
    allocationId: old.allocationId,
    requestId: old.requestId,
    labourId: newLabourId,
    vendorId: labour.vendorId,
    categoryId: old.categoryId,
    status: ASSIGNMENT_STATUS.OFFERED,
    replacedAssignmentId: old._id,
  })
  sendSuccess(res, { assignment, replaced: old })
})

export const listLabourAssignments = asyncHandler(async (req, res) => {
  const filter = { labourId: req.user._id }
  if (req.query.status) filter.status = req.query.status
  const assignments = await Assignment.find(filter)
    .sort({ createdAt: -1 })
    .populate('requestId')
    .lean()
  sendSuccess(res, { assignments })
})

export const respondToAssignment = asyncHandler(async (req, res) => {
  const { action } = req.body
  const assignment = await Assignment.findOne({ _id: req.params.id, labourId: req.user._id })
  if (!assignment) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (action === 'accept') {
    assignment.status = ASSIGNMENT_STATUS.ACCEPTED
    assignment.acceptedAt = new Date()
  } else if (action === 'decline') {
    assignment.status = ASSIGNMENT_STATUS.DECLINED
  } else {
    return sendError(res, { message: 'Invalid action', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  await assignment.save()
  sendSuccess(res, { assignment })
})

import mongoose from 'mongoose'
import { USER_ROLES, CORPORATE_STATUS } from '../constants/roles.js'
import {
  REQUEST_SOURCE,
  REQUEST_STATUS,
  SCHEDULE_TYPE,
} from '../constants/workforceConstants.js'
import { WorkforceRequest, generateRequestReference } from '../models/WorkforceRequest.js'
import { Assignment } from '../models/Assignment.js'
import { Allocation } from '../models/Allocation.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

function parseLines(lines) {
  if (!Array.isArray(lines) || !lines.length) return null
  return lines
    .map((l) => ({
      categoryId: l.categoryId,
      quantity: Math.max(1, Number(l.quantity) || 1),
    }))
    .filter((l) => mongoose.Types.ObjectId.isValid(l.categoryId))
}

export const createRequest = asyncHandler(async (req, res) => {
  const user = req.user
  let sourceType = REQUEST_SOURCE.INDIVIDUAL
  if (user.role === USER_ROLES.CORPORATE) {
    if (user.corporateProfile?.status !== CORPORATE_STATUS.APPROVED) {
      return sendError(res, {
        message: 'Corporate account must be approved',
        statusCode: HTTP_STATUS.FORBIDDEN,
      })
    }
    sourceType = REQUEST_SOURCE.CORPORATE
  } else if (user.role !== USER_ROLES.INDIVIDUAL) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const {
    projectId,
    siteId,
    scheduleType,
    startDate,
    endDate,
    shiftStart,
    shiftEnd,
    lines,
    locationText,
    notes,
    billingMode,
    bookingType,
  } = req.body

  const parsedLines = parseLines(lines)
  if (!parsedLines?.length) {
    return sendError(res, { message: 'At least one skill line required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (!startDate) {
    return sendError(res, { message: 'Start date required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const request = await WorkforceRequest.create({
    reference: generateRequestReference(sourceType === REQUEST_SOURCE.CORPORATE ? 'CR' : 'IR'),
    sourceType,
    clientId: user._id,
    projectId: projectId && mongoose.Types.ObjectId.isValid(projectId) ? projectId : undefined,
    siteId: siteId && mongoose.Types.ObjectId.isValid(siteId) ? siteId : undefined,
    scheduleType: Object.values(SCHEDULE_TYPE).includes(scheduleType) ? scheduleType : SCHEDULE_TYPE.DAILY,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : undefined,
    shiftStart,
    shiftEnd,
    lines: parsedLines,
    locationText,
    notes,
    billingMode,
    bookingType,
    status: REQUEST_STATUS.PENDING_REVIEW,
  })

  sendSuccess(res, { request }, HTTP_STATUS.CREATED)
})

export const listMyRequests = asyncHandler(async (req, res) => {
  const filter = { clientId: req.user._id }
  if (req.query.status) filter.status = req.query.status
  const requests = await WorkforceRequest.find(filter).sort({ createdAt: -1 }).limit(100).lean()
  sendSuccess(res, { requests })
})

export const getRequest = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id).lean()
  if (!request) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const isOwner = String(request.clientId) === String(req.user._id)
  const isAdmin = req.user.role === USER_ROLES.ADMIN
  if (!isOwner && !isAdmin) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const allocation = await Allocation.findOne({ requestId: request._id }).lean()
  const assignments = await Assignment.find({ requestId: request._id })
    .populate('labourId', 'fullName phone profileImageUrl labourProfile.kycStatus')
    .lean()

  sendSuccess(res, { request, allocation, assignments })
})

export const listAdminRequests = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.status) filter.status = req.query.status
  if (req.query.sourceType) filter.sourceType = req.query.sourceType
  const requests = await WorkforceRequest.find(filter)
    .sort({ createdAt: 1 })
    .limit(200)
    .populate('clientId', 'fullName phone role corporateProfile companyName')
    .lean()
  sendSuccess(res, { requests })
})

export const patchRequestStatusAdmin = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (!Object.values(REQUEST_STATUS).includes(status)) {
    return sendError(res, { message: 'Invalid status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  request.status = status
  if (adminNote != null) request.adminNote = String(adminNote).trim()
  request.reviewedBy = req.user._id
  request.reviewedAt = new Date()
  await request.save()
  sendSuccess(res, { request })
})

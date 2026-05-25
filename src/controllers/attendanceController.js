import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import { ATTENDANCE_STATUS, REQUEST_STATUS } from '../constants/workforceConstants.js'
import { User } from '../models/User.js'
import { Assignment } from '../models/Assignment.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

function billableUnitsForStatus(status) {
  if (status === ATTENDANCE_STATUS.PRESENT) return 1
  if (status === ATTENDANCE_STATUS.HALF_DAY) return 0.5
  if (status === ATTENDANCE_STATUS.LATE) return 1
  return 0
}

export const checkIn = asyncHandler(async (req, res) => {
  const { assignmentId } = req.body
  const assignment = await Assignment.findOne({ _id: assignmentId, labourId: req.user._id })
  if (!assignment) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const shiftDate = new Date()
  shiftDate.setHours(0, 0, 0, 0)

  let record = await AttendanceRecord.findOne({ assignmentId, shiftDate })
  if (!record) {
    const request = await WorkforceRequest.findById(assignment.requestId).lean()
    record = await AttendanceRecord.create({
      assignmentId: assignment._id,
      requestId: assignment.requestId,
      labourId: req.user._id,
      projectId: request?.projectId,
      siteId: request?.siteId,
      shiftDate,
      checkInAt: new Date(),
      status: ATTENDANCE_STATUS.PRESENT,
      billableUnits: 0,
      verifiedBy: 'labour',
    })
  } else {
    record.checkInAt = new Date()
    record.status = ATTENDANCE_STATUS.PRESENT
    await record.save()
  }

  assignment.status = 'on_site'
  await assignment.save()

  sendSuccess(res, { record })
})

export const checkOut = asyncHandler(async (req, res) => {
  const { assignmentId } = req.body
  const assignment = await Assignment.findOne({ _id: assignmentId, labourId: req.user._id })
  if (!assignment) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const shiftDate = new Date()
  shiftDate.setHours(0, 0, 0, 0)
  const record = await AttendanceRecord.findOne({ assignmentId, shiftDate })
  if (!record) return sendError(res, { message: 'No check-in for today', statusCode: HTTP_STATUS.BAD_REQUEST })

  record.checkOutAt = new Date()
  record.billableUnits = billableUnitsForStatus(record.status)
  await record.save()
  sendSuccess(res, { record })
})

export const listAttendance = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.user.role === USER_ROLES.LABOUR) {
    filter.labourId = req.user._id
  } else if (req.user.role === USER_ROLES.CORPORATE) {
    const requestIds = await WorkforceRequest.find({ clientId: req.user._id }).distinct('_id')
    filter.requestId = { $in: requestIds }
  } else if (req.user.role === USER_ROLES.CONTRACTOR) {
    const crewIds = await User.find({ vendorId: req.user._id }).distinct('_id')
    filter.labourId = { $in: crewIds }
  } else if (req.user.role === USER_ROLES.ADMIN) {
    // all
  } else {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (req.query.requestId && mongoose.Types.ObjectId.isValid(req.query.requestId)) {
    filter.requestId = req.query.requestId
  }
  if (req.query.projectId && mongoose.Types.ObjectId.isValid(req.query.projectId)) {
    filter.projectId = req.query.projectId
  }
  if (req.query.date) {
    const d = new Date(req.query.date)
    d.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setDate(end.getDate() + 1)
    filter.shiftDate = { $gte: d, $lt: end }
  }

  const records = await AttendanceRecord.find(filter)
    .sort({ shiftDate: -1 })
    .limit(200)
    .populate('labourId', 'fullName phone')
    .lean()
  sendSuccess(res, { records })
})

export const verifyAttendanceAdmin = asyncHandler(async (req, res) => {
  const { status, notes } = req.body
  const record = await AttendanceRecord.findById(req.params.id)
  if (!record) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (status && Object.values(ATTENDANCE_STATUS).includes(status)) {
    record.status = status
    record.billableUnits = billableUnitsForStatus(status)
  }
  if (notes != null) record.notes = String(notes).trim()
  record.verifiedBy = req.user.role === USER_ROLES.CONTRACTOR ? 'vendor_supervisor' : 'admin'
  record.verifiedAt = new Date()
  await record.save()
  sendSuccess(res, { record })
})

export const markAttendanceVendor = asyncHandler(async (req, res) => {
  const { assignmentId, shiftDate, status, notes } = req.body
  const assignment = await Assignment.findById(assignmentId).populate('labourId')
  if (!assignment || String(assignment.vendorId) !== String(req.user._id)) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  const d = shiftDate ? new Date(shiftDate) : new Date()
  d.setHours(0, 0, 0, 0)
  const attStatus = Object.values(ATTENDANCE_STATUS).includes(status) ? status : ATTENDANCE_STATUS.PRESENT

  let record = await AttendanceRecord.findOne({ assignmentId, shiftDate: d })
  if (!record) {
    const request = await WorkforceRequest.findById(assignment.requestId).lean()
    record = await AttendanceRecord.create({
      assignmentId,
      requestId: assignment.requestId,
      labourId: assignment.labourId,
      projectId: request?.projectId,
      siteId: request?.siteId,
      shiftDate: d,
      status: attStatus,
      billableUnits: billableUnitsForStatus(attStatus),
      verifiedBy: 'vendor_supervisor',
      verifiedAt: new Date(),
      notes,
    })
  } else {
    record.status = attStatus
    record.billableUnits = billableUnitsForStatus(attStatus)
    record.verifiedBy = 'vendor_supervisor'
    record.verifiedAt = new Date()
    if (notes != null) record.notes = notes
    await record.save()
  }
  sendSuccess(res, { record })
})

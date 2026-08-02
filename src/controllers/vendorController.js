import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import {
  VENDOR_DOCUMENT_TYPE_LIST,
  VENDOR_DOCUMENT_TYPES,
} from '../constants/vendorVerification.js'
import { REQUEST_STATUS, ASSIGNMENT_STATUS } from '../constants/workforceConstants.js'
import { User } from '../models/User.js'
import { Allocation } from '../models/Allocation.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Assignment } from '../models/Assignment.js'
import { Invoice } from '../models/Invoice.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { Wallet } from '../models/Wallet.js'
import { WithdrawalRequest } from '../models/WithdrawalRequest.js'
import { Banner } from '../models/Banner.js'
import { SubscriptionPlan } from '../models/SubscriptionPlan.js'
import { VendorSubscription } from '../models/VendorSubscription.js'
import { checkVendorInventory } from '../services/vendorInventoryService.js'
import { createOtpChallenge, validateOtpChallenge, deleteOtpChallengeDoc } from '../services/otpService.js'
import { emitToUser } from '../socket.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { normalizeStoredMediaUrl } from '../utils/mediaUrl.js'
import {
  getVendorVerificationProgress,
  labelForVendorDocumentType,
  normalizeVendorProfilePatch,
  validateVendorProfileForSubmit,
} from '../utils/vendorVerification.js'

function requireApprovedVendor(user) {
  if (user.role !== USER_ROLES.CONTRACTOR) return 'Vendor account required'
  if (user.contractorProfile?.verificationStatus !== 'approved') {
    return 'Vendor must be verified before this action'
  }
  return null
}

export const getVendorMe = asyncHandler(async (req, res) => {
  const progress = getVendorVerificationProgress(req.user.contractorProfile || {})
  
  const activeSubscription = await VendorSubscription.findOne({
    vendor: req.user._id,
    status: 'active'
  }).populate('plan').lean()

  sendSuccess(res, {
    data: {
      user: req.user.toSafeObject(),
      verification: {
        checklist: progress.checklist,
        requiredDone: progress.requiredDone,
        requiredTotal: progress.requiredTotal,
        readyToSubmit: progress.readyToSubmit,
      },
      activeSubscription,
    },
  })
})

export const patchVendorMe = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.contractorProfile?.verificationStatus === 'pending' && req.user.contractorProfile?.documentsSubmittedAt) {
    return sendError(res, {
      message: 'Cannot update profile while verification is in review',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const patch = normalizeVendorProfilePatch(req.body)
  if (!req.user.contractorProfile) req.user.contractorProfile = {}
  Object.assign(req.user.contractorProfile, patch)

  // Sync personal details with User model
  if (patch.contactPersonName) req.user.fullName = patch.contactPersonName
  if (patch.contactEmail) req.user.email = patch.contactEmail
  if (patch.contactPhone) req.user.phone = patch.contactPhone

  await req.user.save()
  const progress = getVendorVerificationProgress(req.user.contractorProfile)
  sendSuccess(res, {
    data: {
      user: req.user.toSafeObject(),
      verification: {
        checklist: progress.checklist,
        requiredDone: progress.requiredDone,
        requiredTotal: progress.requiredTotal,
        readyToSubmit: progress.readyToSubmit,
      },
    },
  })
})

export const addVendorDocument = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.contractorProfile?.verificationStatus === 'pending' && req.user.contractorProfile?.documentsSubmittedAt) {
    return sendError(res, {
      message: 'Cannot upload documents while verification is in review',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const { label, url, documentType } = req.body
  const docUrl = normalizeStoredMediaUrl(String(url ?? '').trim())
  if (!docUrl) {
    return sendError(res, { message: 'Valid document URL required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const type = String(documentType ?? '').trim()
  if (!VENDOR_DOCUMENT_TYPE_LIST.includes(type)) {
    return sendError(res, {
      message: 'Select a valid document type',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_DOCUMENT_TYPE',
    })
  }
  if (!req.user.contractorProfile) req.user.contractorProfile = {}
  if (!req.user.contractorProfile.documents) req.user.contractorProfile.documents = []
  const existing = req.user.contractorProfile.documents.find(
    (d) => d.documentType === type && type !== VENDOR_DOCUMENT_TYPES.OTHER,
  )
  if (existing) {
    return sendError(res, {
      message: `A ${labelForVendorDocumentType(type)} is already uploaded — remove it first to replace`,
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'DOCUMENT_TYPE_EXISTS',
    })
  }
  req.user.contractorProfile.documents.push({
    documentType: type,
    label: String(label ?? labelForVendorDocumentType(type)).trim(),
    url: docUrl,
    uploadedAt: new Date(),
  })
  if (req.user.contractorProfile.verificationStatus === 'rejected') {
    req.user.contractorProfile.verificationStatus = 'pending'
    req.user.contractorProfile.documentsSubmittedAt = undefined
    req.user.contractorProfile.reviewNote = undefined
  }
  await req.user.save()
  sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

export const submitVendorVerification = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.contractorProfile?.documentsSubmittedAt) {
    return sendError(res, {
      message: 'Verification already submitted and is under review',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }
  const profile = req.user.contractorProfile || {}
  const validation = validateVendorProfileForSubmit(profile)
  if (!validation.ok) {
    return sendError(res, {
      message: validation.message,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'VERIFICATION_INCOMPLETE',
      errors: validation.checklist?.filter((i) => i.required && !i.done).map((i) => i.id),
    })
  }
  if (!req.user.contractorProfile) req.user.contractorProfile = {}
  req.user.contractorProfile.verificationStatus = 'pending'
  req.user.contractorProfile.documentsSubmittedAt = new Date()
  req.user.contractorProfile.reviewNote = undefined
  await req.user.save()
  sendSuccess(res, {
    message: 'Verification submitted — our team will review your documents shortly',
    data: { user: req.user.toSafeObject() },
  })
})

export const removeVendorDocument = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.contractorProfile?.verificationStatus === 'pending' && req.user.contractorProfile?.documentsSubmittedAt) {
    return sendError(res, {
      message: 'Cannot remove documents while verification is in review',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const docId = req.params.docId
  if (!req.user.contractorProfile?.documents?.length) {
    return sendError(res, { message: 'Document not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  const before = req.user.contractorProfile.documents.length
  req.user.contractorProfile.documents = req.user.contractorProfile.documents.filter(
    (d) => String(d._id) !== String(docId),
  )
  if (req.user.contractorProfile.documents.length === before) {
    return sendError(res, { message: 'Document not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  await req.user.save()
  sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

export const listVendorCrew = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const crew = await User.find({ vendorId: req.user._id, role: USER_ROLES.LABOUR })
    .select('fullName phone profileImageUrl labourProfile')
    .populate('labourProfile.categoryIds', 'name')
    .populate('labourProfile.subcategoryIds', 'name')
    .populate('labourProfile.serviceIds', 'name')
    .populate('labourProfile.servicePricing.subcategoryId', 'name')
    .populate('labourProfile.servicePricing.serviceId', 'name')
    .lean()
  sendSuccess(res, { data: { crew } })
})

export const linkVendorCrew = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const { phone } = req.body
  const digits = String(phone ?? '').replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) {
    return sendError(res, { message: 'Valid 10-digit phone required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const worker = await User.findOne({ phone: digits, role: USER_ROLES.LABOUR })
  if (!worker) {
    return sendError(res, {
      message: 'Labour account not found — worker must register as labour first',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }
  if (worker.vendorId?.toString() === req.user._id.toString()) {
    return sendError(res, {
      message: 'Worker is already linked to your crew',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }
  const { challengeId } = await createOtpChallenge(digits, 'link_crew')
  sendSuccess(res, { data: { needsOtp: true, challengeId } })
})

export const verifyLinkVendorCrewOtp = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const { phone, code, challengeId } = req.body
  const digits = String(phone ?? '').replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) {
    return sendError(res, { message: 'Valid 10-digit phone required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  const worker = await User.findOne({ phone: digits, role: USER_ROLES.LABOUR })
  if (!worker) {
    return sendError(res, {
      message: 'Labour account not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }
  
  const otp = await validateOtpChallenge({ phone: digits, purpose: 'link_crew', code, challengeId })
  if (!otp.ok) {
    const map = {
      INVALID_CHALLENGE: 'OTP session invalid — request a new OTP',
      NO_OTP: 'Request OTP first',
      EXPIRED: 'OTP expired — request a new one',
      TOO_MANY_ATTEMPTS: 'Too many attempts — request a new OTP',
      INVALID_CODE: 'Invalid OTP',
    }
    return sendError(res, {
      message: map[otp.reason] || 'OTP verification failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: otp.reason,
    })
  }
  
  worker.vendorId = req.user._id
  await worker.save()
  await deleteOtpChallengeDoc(otp.doc)
  
  sendSuccess(res, { data: { worker: worker.toSafeObject() } })
})

export const unlinkVendorCrew = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  
  const worker = await User.findOne({ _id: req.params.workerId, role: USER_ROLES.LABOUR, vendorId: req.user._id })
  if (!worker) {
    return sendError(res, {
      message: 'Worker not found in your crew',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }
  
  worker.vendorId = undefined
  await worker.save()
  
  sendSuccess(res, { message: 'Worker unlinked successfully' })
})

export const getVendorDirectRequests = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  // Find requests specifically directed to this vendor which are still open/pending
  const requests = await WorkforceRequest.find({
    preferredVendorId: req.user._id,
    status: { $in: [REQUEST_STATUS.BROADCASTED, REQUEST_STATUS.PENDING_REVIEW] }
  })
    .sort({ createdAt: -1 })
    .populate('clientId', 'fullName corporateProfile.companyName corporateProfile.city')
    .populate('projectId', 'name')
    .populate('lines.categoryId', 'name')
    .lean()

  sendSuccess(res, { data: { requests } })
})

export const getVendorDashboard = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const vendorId = req.user._id
  const crewCount = await User.countDocuments({ vendorId, role: USER_ROLES.LABOUR })
  const openJobs = await Allocation.countDocuments({ vendorId, vendorAcceptedAt: { $exists: false } })
  const activeAssignments = await Assignment.countDocuments({
    vendorId,
    status: { $in: ['accepted', 'on_site'] },
  })
  
  const activeSubscription = await VendorSubscription.findOne({
    vendor: vendorId,
    status: 'active'
  }).populate('plan').lean()

  sendSuccess(res, {
    data: {
      stats: { crewCount, openJobs, activeAssignments },
      activeSubscription,
    },
  })
})

export const listVendorJobs = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  
  // 1. Fetch real allocations
  const allocations = await Allocation.find({ vendorId: req.user._id })
    .sort({ createdAt: -1 })
    .populate({
      path: 'requestId',
      select: 'reference status locationText startDate endDate lines clientId preferredCrewIds',
      populate: [
        { path: 'clientId', select: 'fullName phone corporateProfile.companyName' },
        { path: 'preferredCrewIds', select: 'fullName category services' }
      ]
    })
    .lean()

  // 2. Fetch pending direct requests that don't have an allocation yet
  const pendingRequests = await WorkforceRequest.find({
    preferredVendorId: req.user._id,
    status: { $in: [REQUEST_STATUS.BROADCASTED, REQUEST_STATUS.PENDING_REVIEW] }
  })
    .sort({ createdAt: -1 })
    .populate('clientId', 'fullName phone corporateProfile.companyName')
    .populate('preferredCrewIds', 'fullName category services')
    .lean()

  // 3. Map pending requests to pseudo-allocations
  const pseudoAllocations = pendingRequests.map(reqData => ({
    _id: reqData._id, // Use requestId as _id so handleAccept passes requestId
    vendorId: req.user._id,
    vendorAcceptedAt: null, // Marks it as pending
    vendorRejectedAt: null,
    requestId: reqData,
    createdAt: reqData.createdAt,
    isDirectRequest: true
  }))

  const combined = [...pseudoAllocations, ...allocations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  sendSuccess(res, { data: { allocations: combined } })
})

export const getVendorJob = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  
  const allocation = await Allocation.findOne({ _id: req.params.id, vendorId: req.user._id })
    .populate({
      path: 'requestId',
      populate: { path: 'clientId', select: 'fullName phone companyName' }
    })
    .lean()
    
  if (!allocation) {
    return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Map the populated fields to match the exact JSON structure defined in JOB_ALLOCATIONS_API.md
  if (allocation.requestId) {
    const reqData = allocation.requestId
    const client = reqData.clientId || {}
    allocation.requestId = {
      reference: reqData.reference,
      status: reqData.status,
      locationText: reqData.locationText,
      startDate: reqData.startDate,
      endDate: reqData.endDate,
      description: reqData.notes,
      requirements: reqData.notes, // Using notes as a fallback since requirements isn't in schema
      clientName: client.companyName || client.fullName,
      clientPhone: client.phone,
      lines: reqData.lines
    }
  }
  
  sendSuccess(res, { data: { allocation } })
})

export const acceptVendorJob = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  
  const requestId = req.params.id
  
  // Start a transaction-like atomic update
  const request = await WorkforceRequest.findOneAndUpdate(
    { 
      _id: requestId, 
      status: { $in: [REQUEST_STATUS.BROADCASTED, REQUEST_STATUS.PENDING_REVIEW] },
      $or: [{ preferredVendorId: req.user._id }, { preferredVendorId: { $exists: false } }]
    },
    { $set: { status: REQUEST_STATUS.CONFIRMED } },
    { new: true }
  )

  if (!request) {
    return sendError(res, { message: 'Job not found, already accepted by another vendor, or not available.', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Check inventory to be absolutely sure
  const sDate = new Date(request.startDate)
  const eDate = request.endDate ? new Date(request.endDate) : sDate
  const inventory = await checkVendorInventory(req.user._id, request.lines, sDate, eDate)

  if (!inventory.hasInventory) {
    // Revert request status
    await WorkforceRequest.updateOne({ _id: requestId }, { $set: { status: REQUEST_STATUS.BROADCASTED } })
    return sendError(res, { 
      message: 'You do not have enough available crew members to fulfill this request.', 
      statusCode: HTTP_STATUS.BAD_REQUEST 
    })
  }

  // Create Allocation
  const allocation = await Allocation.create({
    requestId: request._id,
    vendorId: req.user._id,
    vendorAcceptedAt: new Date(),
  })
  
  if (request.preferredCrewIds && request.preferredCrewIds.length > 0) {
    const assignmentsToCreate = request.preferredCrewIds.map(labourId => ({
      allocationId: allocation._id,
      requestId: request._id,
      vendorId: req.user._id,
      labourId: labourId,
      status: ASSIGNMENT_STATUS.ACCEPTED,
      acceptedAt: new Date()
    }))
    await Assignment.insertMany(assignmentsToCreate)
  }
  
  // Notify corporate
  emitToUser(request.clientId, 'B2B_REQUEST_ACCEPTED', {
    requestId: request._id,
    vendorId: req.user._id,
    allocationId: allocation._id
  })

  sendSuccess(res, { data: { allocation } })
})

export const rejectVendorJob = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  
  const requestId = req.params.id

  // 1. Try to find an existing Allocation
  let allocation = await Allocation.findOne({ _id: requestId, vendorId: req.user._id })
  
  if (allocation) {
    if (allocation.vendorAcceptedAt) {
      return sendError(res, { message: 'Job has already been accepted', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    if (allocation.vendorRejectedAt) {
      return sendError(res, { message: 'Job has already been rejected', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    allocation.vendorRejectedAt = new Date()
    await allocation.save()
    return sendSuccess(res, { message: 'Job rejected successfully', data: { allocation } })
  }

  // 2. If no Allocation, check if it's a pending direct WorkforceRequest
  const request = await WorkforceRequest.findOne({
    _id: requestId,
    preferredVendorId: req.user._id,
    status: { $in: [REQUEST_STATUS.BROADCASTED, REQUEST_STATUS.PENDING_REVIEW] }
  })

  if (!request) {
    return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Reject the request and set status to cancelled so it doesn't show up anymore
  await WorkforceRequest.updateOne(
    { _id: requestId }, 
    { $set: { status: REQUEST_STATUS.CANCELLED } }
  )

  sendSuccess(res, { message: 'Direct request rejected successfully', data: { requestId } })
})

export const assignVendorCrew = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const allocation = await Allocation.findOne({ _id: req.params.id, vendorId: req.user._id }).populate('requestId')
  if (!allocation) return sendError(res, { message: 'Allocation not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const { assignments } = req.body // Array of { labourId, categoryId }
  if (!Array.isArray(assignments) || !assignments.length) {
    return sendError(res, { message: 'Assignments required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const request = allocation.requestId
  const sDate = new Date(request.startDate)
  const eDate = request.endDate ? new Date(request.endDate) : sDate

  // Fetch Vendor's entire crew to validate
  const crew = await User.find({ vendorId: req.user._id, role: USER_ROLES.LABOUR }).lean()
  const crewIds = crew.map(c => String(c._id))

  // Find busy crew
  const activeAssignments = await Assignment.find({
    labourId: { $in: crewIds },
    status: { $in: [ASSIGNMENT_STATUS.OFFERED, ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE] }
  }).populate({
    path: 'requestId',
    match: {
      startDate: { $lte: eDate },
      $or: [{ endDate: { $gte: sDate } }, { endDate: null }]
    }
  }).lean()

  const busyCrewIds = activeAssignments.filter(a => a.requestId).map(a => String(a.labourId))

  const newAssignments = []
  
  // We should also validate that they don't over-assign beyond the request lines
  // To keep it simple, we'll just check if the labour is available and belongs to vendor
  for (const assign of assignments) {
    if (!crewIds.includes(String(assign.labourId))) {
      return sendError(res, { message: `Worker ${assign.labourId} is not in your crew`, statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    if (busyCrewIds.includes(String(assign.labourId))) {
      return sendError(res, { message: `Worker ${assign.labourId} is already assigned to another overlapping project`, statusCode: HTTP_STATUS.BAD_REQUEST })
    }

    newAssignments.push({
      allocationId: allocation._id,
      requestId: request._id,
      vendorId: req.user._id,
      labourId: assign.labourId,
      categoryId: assign.categoryId,
      status: ASSIGNMENT_STATUS.ACCEPTED,
      acceptedAt: new Date()
    })
  }

  await Assignment.insertMany(newAssignments)
  allocation.deployedAt = new Date()
  await allocation.save()

  // Notify corporate
  emitToUser(request.clientId, 'B2B_CREW_ASSIGNED', {
    allocationId: allocation._id,
    requestId: request._id
  })

  sendSuccess(res, { message: 'Crew assigned successfully' })
})

export const replaceVendorCrew = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const allocation = await Allocation.findOne({ _id: req.params.id, vendorId: req.user._id }).populate('requestId')
  if (!allocation) return sendError(res, { message: 'Allocation not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const { oldLabourId, newLabourId } = req.body
  if (!oldLabourId || !newLabourId) {
    return sendError(res, { message: 'oldLabourId and newLabourId required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const oldAssignment = await Assignment.findOne({ 
    allocationId: allocation._id, 
    labourId: oldLabourId,
    status: { $in: [ASSIGNMENT_STATUS.OFFERED, ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE] }
  })

  if (!oldAssignment) {
    return sendError(res, { message: 'Old assignment not found or already completed', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Validate new worker
  const request = allocation.requestId
  const sDate = new Date(request.startDate)
  const eDate = request.endDate ? new Date(request.endDate) : sDate

  const newWorker = await User.findOne({ _id: newLabourId, vendorId: req.user._id, role: USER_ROLES.LABOUR })
  if (!newWorker) {
    return sendError(res, { message: 'New worker not found in your crew', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const activeAssignments = await Assignment.find({
    labourId: newLabourId,
    status: { $in: [ASSIGNMENT_STATUS.OFFERED, ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE] }
  }).populate({
    path: 'requestId',
    match: {
      startDate: { $lte: eDate },
      $or: [{ endDate: { $gte: sDate } }, { endDate: null }]
    }
  }).lean()

  const isBusy = activeAssignments.some(a => a.requestId)
  if (isBusy) {
    return sendError(res, { message: 'New worker is already assigned to another overlapping project', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Cancel old
  oldAssignment.status = 'CANCELLED'
  oldAssignment.replacedBy = newLabourId
  await oldAssignment.save()

  // Create new
  const newAssignment = await Assignment.create({
    allocationId: allocation._id,
    requestId: request._id,
    vendorId: req.user._id,
    labourId: newLabourId,
    categoryId: oldAssignment.categoryId,
    status: ASSIGNMENT_STATUS.ACCEPTED,
    replacedAssignmentId: oldAssignment._id,
    acceptedAt: new Date()
  })

  // Notify corporate
  emitToUser(request.clientId, 'B2B_CREW_REPLACED', {
    allocationId: allocation._id,
    requestId: request._id,
    oldLabourId,
    newLabourId
  })

  sendSuccess(res, { message: 'Crew replaced successfully', data: { newAssignment } })
})

export const toggleAcceptingRequests = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const { isAccepting } = req.body
  if (typeof isAccepting !== 'boolean') {
    return sendError(res, { message: 'isAccepting must be a boolean', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(req.user._id)
  if (user.contractorProfile) {
    user.contractorProfile.isAcceptingRequests = isAccepting
    await user.save()
  }

  sendSuccess(res, { message: 'Availability toggled successfully', data: { isAccepting } })
})

export const getVendorAnalytics = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const vendorId = req.user._id
  const days = Math.min(parseInt(req.query.days ?? '30', 10), 90)
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  // Get all labourIds linked to this vendor
  const crewIds = (await User.find({ vendorId, role: USER_ROLES.LABOUR }).select('_id').lean()).map((u) => u._id)

  // Daily attendance grouped by date for the last N days
  const attendanceAgg = await AttendanceRecord.aggregate([
    {
      $match: {
        labourId: { $in: crewIds },
        shiftDate: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$shiftDate' } },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        billableUnits: { $sum: '$billableUnits' },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', present: 1, absent: 1, billableUnits: 1, _id: 0 } },
  ])

  // Monthly earnings from paid invoices grouped by month
  const earningsAgg = await Invoice.aggregate([
    {
      $match: {
        vendorId: new mongoose.Types.ObjectId(vendorId),
        status: 'paid',
        paidAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
        totalEarned: { $sum: '$total' },
        invoiceCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { month: '$_id', totalEarned: 1, invoiceCount: 1, _id: 0 } },
  ])

  // Summary totals for the period
  const totalPresent = attendanceAgg.reduce((s, d) => s + d.present, 0)
  const totalBillableUnits = attendanceAgg.reduce((s, d) => s + d.billableUnits, 0)
  const totalEarned = earningsAgg.reduce((s, m) => s + m.totalEarned, 0)

  sendSuccess(res, {
    data: {
      period: { days, since },
      summary: { totalPresent, totalBillableUnits, totalEarned, crewSize: crewIds.length },
      attendanceChart: attendanceAgg,
      earningsChart: earningsAgg,
    },
  })
})

export const listVendorWithdrawals = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const withdrawals = await WithdrawalRequest.find({ vendorId: req.user._id })
    .sort({ createdAt: -1 })
    .lean()

  const wallet = await Wallet.findOne({ userId: req.user._id }).lean()

  sendSuccess(res, {
    data: {
      withdrawals,
      walletBalance: wallet?.selfBalance ?? 0,
    },
  })
})

export const requestVendorWithdrawal = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const { amount, bankDetails } = req.body
  const parsedAmount = Number(amount)

  if (!parsedAmount || parsedAmount < 100) {
    return sendError(res, {
      message: 'Minimum withdrawal amount is ₹100',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  // Bank details validation
  const { accountNumber, ifscCode, accountHolderName, bankName, qrCodeUrl } = bankDetails ?? {}
  if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
    return sendError(res, {
      message: 'Complete bank details required (accountNumber, ifscCode, accountHolderName, bankName)',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  // Check wallet balance
  const wallet = await Wallet.findOne({ userId: req.user._id })
  if (!wallet || wallet.selfBalance < parsedAmount) {
    return sendError(res, {
      message: `Insufficient wallet balance. Available: ₹${wallet?.selfBalance ?? 0}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INSUFFICIENT_BALANCE',
    })
  }

  // Check for existing pending request
  const pendingExists = await WithdrawalRequest.findOne({ vendorId: req.user._id, status: 'PENDING' })
  if (pendingExists) {
    return sendError(res, {
      message: 'You already have a pending withdrawal request. Wait for it to be processed.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'PENDING_EXISTS',
    })
  }

  const withdrawal = await WithdrawalRequest.create({
    vendorId: req.user._id,
    amount: parsedAmount,
    bankDetails: { accountNumber, ifscCode, accountHolderName, bankName, qrCodeUrl },
    status: 'PENDING',
  })

  sendSuccess(res, {
    message: 'Withdrawal request submitted — admin will process it shortly',
    statusCode: HTTP_STATUS.CREATED,
    data: { withdrawal },
  })
})

export const listVendorSettlements = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const invoices = await Invoice.find({ vendorId: req.user._id }).sort({ createdAt: -1 }).lean()
  sendSuccess(res, { data: { invoices } })
})

export const getVendorBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find({ panel: 'VENDOR', isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean()
  sendSuccess(res, { data: { banners } })
})

// --- Subscriptions ---

export const getSubscriptionPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 })
  sendSuccess(res, { data: { plans } })
})

export const subscribeToPlan = asyncHandler(async (req, res) => {
  const { planId } = req.body
  const plan = await SubscriptionPlan.findById(planId)
  
  if (!plan || !plan.isActive) {
    return sendError(res, { message: 'Invalid or inactive plan', statusCode: 400 })
  }

  // Create active subscription mock
  const subscription = await VendorSubscription.create({
    vendor: req.user._id,
    plan: plan._id,
    status: 'active',
    startDate: new Date(),
    // mock 1 month end date if duration contains month, etc. (simplistic approach for now)
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  })

  sendSuccess(res, { data: { subscription, message: `Successfully subscribed to ${plan.name}` } })
})

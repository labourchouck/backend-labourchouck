import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import {
  VENDOR_DOCUMENT_TYPE_LIST,
  VENDOR_DOCUMENT_TYPES,
} from '../constants/vendorVerification.js'
import { User } from '../models/User.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { Invoice } from '../models/Invoice.js'
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

export const patchVendorMe = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.contractorProfile?.verificationStatus === 'approved') {
    return sendError(res, {
      message: 'Account verified — contact support to update business details',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const patch = normalizeVendorProfilePatch(req.body)
  if (!req.user.contractorProfile) req.user.contractorProfile = {}
  Object.assign(req.user.contractorProfile, patch)
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
  if (req.user.contractorProfile?.verificationStatus === 'approved') {
    return sendError(res, {
      message: 'Account already verified — contact support to update documents',
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
  if (req.user.contractorProfile?.documentsSubmittedAt) {
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
  worker.vendorId = req.user._id
  await worker.save()
  sendSuccess(res, { data: { worker: worker.toSafeObject() } })
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
  sendSuccess(res, {
    data: {
      stats: { crewCount, openJobs, activeAssignments },
    },
  })
})

export const listVendorJobs = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const allocations = await Allocation.find({ vendorId: req.user._id })
    .sort({ createdAt: -1 })
    .populate({
      path: 'requestId',
      select: 'reference status locationText startDate endDate lines',
    })
    .lean()
  sendSuccess(res, { data: { allocations } })
})

export const acceptVendorJob = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const allocation = await Allocation.findOne({ _id: req.params.id, vendorId: req.user._id })
  if (!allocation) return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  allocation.vendorAcceptedAt = new Date()
  allocation.deployedAt = new Date()
  await allocation.save()
  sendSuccess(res, { data: { allocation } })
})

export const listVendorSettlements = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const invoices = await Invoice.find({ vendorId: req.user._id }).sort({ createdAt: -1 }).lean()
  sendSuccess(res, { data: { invoices } })
})

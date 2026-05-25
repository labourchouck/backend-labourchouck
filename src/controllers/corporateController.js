import { CORPORATE_STATUS, USER_ROLES } from '../constants/roles.js'
import { User } from '../models/User.js'
import { Project } from '../models/Project.js'
import { Site } from '../models/Site.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Assignment } from '../models/Assignment.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { Invoice } from '../models/Invoice.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { normalizeStoredMediaUrl } from '../utils/mediaUrl.js'
import {
  CORPORATE_DOCUMENT_TYPE_LIST,
  CORPORATE_DOCUMENT_TYPES,
} from '../constants/corporateVerification.js'
import {
  getCorporateVerificationProgress,
  labelForCorporateDocumentType,
  normalizeCorporateProfilePatch,
  validateCorporateProfileForSubmit,
} from '../utils/corporateVerification.js'

function requireApprovedCorporate(user) {
  if (user.role !== USER_ROLES.CORPORATE) return 'Corporate account required'
  if (user.corporateProfile?.status !== CORPORATE_STATUS.APPROVED) {
    return 'Corporate account must be approved before this action'
  }
  return null
}

export const getCorporateMe = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

export const patchCorporateMe = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CORPORATE) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.corporateProfile?.status === CORPORATE_STATUS.APPROVED) {
    return sendError(res, {
      message: 'Account approved — contact support to update company details',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const patch = normalizeCorporateProfilePatch(req.body)
  if (!req.user.corporateProfile) req.user.corporateProfile = {}
  Object.assign(req.user.corporateProfile, patch)
  await req.user.save()
  const progress = getCorporateVerificationProgress(req.user.corporateProfile)
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

export const addCorporateDocument = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CORPORATE) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.corporateProfile?.status === CORPORATE_STATUS.APPROVED) {
    return sendError(res, {
      message: 'Account already approved — contact support to update documents',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const { label, url, documentType } = req.body
  const docUrl = normalizeStoredMediaUrl(String(url ?? '').trim())
  if (!docUrl) {
    return sendError(res, { message: 'Valid document URL required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const type = String(documentType ?? '').trim()
  if (!CORPORATE_DOCUMENT_TYPE_LIST.includes(type)) {
    return sendError(res, {
      message: 'Select a valid document type',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_DOCUMENT_TYPE',
    })
  }
  if (!req.user.corporateProfile) req.user.corporateProfile = {}
  if (!req.user.corporateProfile.documents) req.user.corporateProfile.documents = []
  const existing = req.user.corporateProfile.documents.find(
    (d) => d.documentType === type && type !== CORPORATE_DOCUMENT_TYPES.OTHER,
  )
  if (existing) {
    return sendError(res, {
      message: `A ${labelForCorporateDocumentType(type)} is already uploaded — remove it first to replace`,
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'DOCUMENT_TYPE_EXISTS',
    })
  }
  req.user.corporateProfile.documents.push({
    documentType: type,
    label: String(label ?? labelForCorporateDocumentType(type)).trim(),
    url: docUrl,
    uploadedAt: new Date(),
  })
  if (req.user.corporateProfile.status === CORPORATE_STATUS.REJECTED) {
    req.user.corporateProfile.status = CORPORATE_STATUS.PENDING
    req.user.corporateProfile.documentsSubmittedAt = undefined
    req.user.corporateProfile.reviewNote = undefined
  }
  await req.user.save()
  sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

export const submitCorporateVerification = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CORPORATE) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.corporateProfile?.documentsSubmittedAt) {
    return sendError(res, {
      message: 'Verification already submitted and is under review',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }
  const profile = req.user.corporateProfile || {}
  const validation = validateCorporateProfileForSubmit(profile)
  if (!validation.ok) {
    return sendError(res, {
      message: validation.message,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'VERIFICATION_INCOMPLETE',
      errors: validation.checklist?.filter((i) => i.required && !i.done).map((i) => i.id),
    })
  }
  if (!req.user.corporateProfile) req.user.corporateProfile = {}
  req.user.corporateProfile.status = CORPORATE_STATUS.PENDING
  req.user.corporateProfile.documentsSubmittedAt = new Date()
  req.user.corporateProfile.reviewNote = undefined
  await req.user.save()
  sendSuccess(res, {
    message: 'Verification submitted — our team will review your documents shortly',
    data: { user: req.user.toSafeObject() },
  })
})

export const removeCorporateDocument = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.CORPORATE) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }
  if (req.user.corporateProfile?.documentsSubmittedAt) {
    return sendError(res, {
      message: 'Cannot remove documents while verification is in review',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }
  const docId = req.params.docId
  if (!req.user.corporateProfile?.documents?.length) {
    return sendError(res, { message: 'Document not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  const before = req.user.corporateProfile.documents.length
  req.user.corporateProfile.documents = req.user.corporateProfile.documents.filter(
    (d) => String(d._id) !== String(docId),
  )
  if (req.user.corporateProfile.documents.length === before) {
    return sendError(res, { message: 'Document not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  await req.user.save()
  sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

export const listCorporateProjects = asyncHandler(async (req, res) => {
  const err = requireApprovedCorporate(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const projects = await Project.find({ corporateId: req.user._id }).sort({ createdAt: -1 }).lean()
  const sites = await Site.find({ corporateId: req.user._id }).lean()
  const sitesByProject = sites.reduce((acc, s) => {
    const key = String(s.projectId)
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})
  sendSuccess(res, {
    data: {
      projects: projects.map((p) => ({ ...p, sites: sitesByProject[String(p._id)] || [] })),
    },
  })
})

export const createCorporateProject = asyncHandler(async (req, res) => {
  const err = requireApprovedCorporate(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const { name, startDate, endDate, notes, site } = req.body
  if (!name?.trim()) {
    return sendError(res, { message: 'Project name required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const project = await Project.create({
    corporateId: req.user._id,
    name: name.trim(),
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    notes,
  })
  let createdSite = null
  if (site?.name?.trim()) {
    createdSite = await Site.create({
      projectId: project._id,
      corporateId: req.user._id,
      name: site.name.trim(),
      address: site.address,
      city: site.city,
      geo: site.geo,
      contactName: site.contactName,
      contactPhone: site.contactPhone,
    })
  }
  sendSuccess(res, {
    data: { project: project.toObject(), site: createdSite },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const getCorporateProject = asyncHandler(async (req, res) => {
  const err = requireApprovedCorporate(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const project = await Project.findOne({ _id: req.params.id, corporateId: req.user._id }).lean()
  if (!project) return sendError(res, { message: 'Project not found', statusCode: HTTP_STATUS.NOT_FOUND })
  const sites = await Site.find({ projectId: project._id }).lean()
  sendSuccess(res, { data: { project: { ...project, sites } } })
})

export const addCorporateSite = asyncHandler(async (req, res) => {
  const err = requireApprovedCorporate(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const project = await Project.findOne({ _id: req.params.projectId, corporateId: req.user._id })
  if (!project) return sendError(res, { message: 'Project not found', statusCode: HTTP_STATUS.NOT_FOUND })
  const { name, address, city, geo, contactName, contactPhone } = req.body
  if (!name?.trim()) {
    return sendError(res, { message: 'Site name required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const site = await Site.create({
    projectId: project._id,
    corporateId: req.user._id,
    name: name.trim(),
    address,
    city,
    geo,
    contactName,
    contactPhone,
  })
  sendSuccess(res, { data: { site }, statusCode: HTTP_STATUS.CREATED })
})

export const getCorporateDashboard = asyncHandler(async (req, res) => {
  const err = requireApprovedCorporate(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const corporateId = req.user._id
  const [activeProjects, openRequests, assignments, attendanceToday, invoicesDue] = await Promise.all([
    Project.countDocuments({ corporateId, status: 'active' }),
    WorkforceRequest.countDocuments({
      clientId: corporateId,
      status: { $nin: ['completed', 'cancelled'] },
    }),
    Assignment.countDocuments({
      requestId: {
        $in: await WorkforceRequest.find({ clientId: corporateId }).distinct('_id'),
      },
      status: { $in: ['accepted', 'on_site'] },
    }),
    AttendanceRecord.countDocuments({
      requestId: {
        $in: await WorkforceRequest.find({ clientId: corporateId }).distinct('_id'),
      },
      shiftDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
      status: 'present',
    }),
    Invoice.countDocuments({ corporateId, status: { $in: ['issued', 'overdue'] } }),
  ])
  sendSuccess(res, {
    data: {
      stats: {
        activeProjects,
        openRequests,
        activeWorkers: assignments,
        attendanceToday,
        invoicesDue,
      },
    },
  })
})

export const listCorporateInvoices = asyncHandler(async (req, res) => {
  const err = requireApprovedCorporate(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const invoices = await Invoice.find({ corporateId: req.user._id }).sort({ createdAt: -1 }).lean()
  sendSuccess(res, { data: { invoices } })
})

export const reviewCorporateAdmin = asyncHandler(async (req, res) => {
  const { decision, status, reviewNote, note } = req.body
  const resolved =
    decision === 'approved' || status === 'approved'
      ? CORPORATE_STATUS.APPROVED
      : decision === 'rejected' || status === 'rejected'
        ? CORPORATE_STATUS.REJECTED
        : status

  if (![CORPORATE_STATUS.APPROVED, CORPORATE_STATUS.REJECTED, CORPORATE_STATUS.PENDING].includes(resolved)) {
    return sendError(res, { message: 'Invalid decision', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(req.params.id)
  if (!user || user.role !== USER_ROLES.CORPORATE) {
    return sendError(res, { message: 'Corporate user not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  if (!user.corporateProfile) user.corporateProfile = {}

  if (resolved === CORPORATE_STATUS.APPROVED) {
    if (!(user.corporateProfile.documents?.length > 0)) {
      return sendError(res, {
        message: 'Corporate has not uploaded verification documents yet',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'NO_SUBMISSION',
      })
    }
    user.corporateProfile.reviewNote = undefined
  } else if (resolved === CORPORATE_STATUS.REJECTED) {
    user.corporateProfile.reviewNote = String(reviewNote ?? note ?? '').trim().slice(0, 500)
  }

  user.corporateProfile.status = resolved
  user.corporateProfile.reviewedAt = new Date()
  await user.save()
  sendSuccess(res, {
    message: resolved === CORPORATE_STATUS.APPROVED ? 'Corporate account approved' : 'Corporate verification rejected',
    data: { user: user.toSafeObject() },
  })
})

export const reviewContractorAdmin = asyncHandler(async (req, res) => {
  const { decision, status, reviewNote, note } = req.body
  const resolved =
    decision === 'approved' || status === 'approved'
      ? 'approved'
      : decision === 'rejected' || status === 'rejected'
        ? 'rejected'
        : status

  if (!['approved', 'rejected', 'pending'].includes(resolved)) {
    return sendError(res, { message: 'Invalid decision', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(req.params.id)
  if (!user || user.role !== USER_ROLES.CONTRACTOR) {
    return sendError(res, { message: 'Vendor user not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  if (!user.contractorProfile) user.contractorProfile = {}

  if (resolved === 'approved') {
    if (!(user.contractorProfile.documents?.length > 0)) {
      return sendError(res, {
        message: 'Vendor has not uploaded verification documents yet',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'NO_SUBMISSION',
      })
    }
    user.contractorProfile.reviewNote = undefined
  } else if (resolved === 'rejected') {
    user.contractorProfile.reviewNote = String(reviewNote ?? note ?? '').trim().slice(0, 500)
  }

  user.contractorProfile.verificationStatus = resolved
  user.contractorProfile.reviewedAt = new Date()
  await user.save()
  sendSuccess(res, {
    message: resolved === 'approved' ? 'Vendor account verified' : 'Vendor verification rejected',
    data: { user: user.toSafeObject() },
  })
})

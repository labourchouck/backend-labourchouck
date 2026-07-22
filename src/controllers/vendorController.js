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
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { Wallet } from '../models/Wallet.js'
import { WithdrawalRequest } from '../models/WithdrawalRequest.js'
import { createOtpChallenge, validateOtpChallenge, deleteOtpChallengeDoc } from '../services/otpService.js'
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

export const getVendorJob = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  
  const allocation = await Allocation.findOne({ _id: req.params.id, vendorId: req.user._id })
    .populate({
      path: 'requestId',
      select: 'reference status locationText startDate endDate lines description requirements clientName clientPhone',
    })
    .lean()
    
  if (!allocation) {
    return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  sendSuccess(res, { data: { allocation } })
})

export const acceptVendorJob = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  const allocation = await Allocation.findOne({ _id: req.params.id, vendorId: req.user._id })
  if (!allocation) return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  
  if (allocation.vendorRejectedAt) {
    return sendError(res, { message: 'Job has already been rejected', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  allocation.vendorAcceptedAt = new Date()
  allocation.deployedAt = new Date()
  await allocation.save()
  sendSuccess(res, { data: { allocation } })
})

export const rejectVendorJob = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  
  const allocation = await Allocation.findOne({ _id: req.params.id, vendorId: req.user._id })
  if (!allocation) {
    return sendError(res, { message: 'Job not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  if (allocation.vendorAcceptedAt) {
    return sendError(res, { message: 'Job has already been accepted', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  if (allocation.vendorRejectedAt) {
    return sendError(res, { message: 'Job has already been rejected', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  allocation.vendorRejectedAt = new Date()
  await allocation.save()
  
  sendSuccess(res, { message: 'Job rejected successfully', data: { allocation } })
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

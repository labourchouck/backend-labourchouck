import { User } from '../models/User.js'
import { USER_ROLES, CORPORATE_STATUS } from '../constants/roles.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

function buildSearchOr(searchTrim) {
  const esc = searchTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const or = [
    { fullName: new RegExp(esc, 'i') },
    { email: new RegExp(esc, 'i') },
    { 'corporateProfile.companyName': new RegExp(esc, 'i') },
    { 'corporateProfile.gstNumber': new RegExp(esc, 'i') },
    { 'corporateProfile.panNumber': new RegExp(esc, 'i') },
    { 'corporateProfile.city': new RegExp(esc, 'i') },
    { 'contractorProfile.businessName': new RegExp(esc, 'i') },
    { 'contractorProfile.panNumber': new RegExp(esc, 'i') },
    { 'contractorProfile.gstNumber': new RegExp(esc, 'i') },
    { 'contractorProfile.city': new RegExp(esc, 'i') },
  ]
  const digits = searchTrim.replace(/\D/g, '')
  if (digits.length >= 2) or.push({ phone: { $regex: digits } })
  return { $or: or }
}

function notSubmittedClause(submittedKey) {
  return { $or: [{ [submittedKey]: { $exists: false } }, { [submittedKey]: null }] }
}

function pendingStatusClause(role, statusKey) {
  const pending = role === USER_ROLES.CORPORATE ? CORPORATE_STATUS.PENDING : 'pending'
  return {
    $or: [{ [statusKey]: pending }, { [statusKey]: { $exists: false } }, { [statusKey]: null }],
  }
}

function hasDocumentsClause(documentsKey) {
  return { [`${documentsKey}.0`]: { $exists: true } }
}

function verificationFilterQuery(role, filter) {
  const base = { role }
  const profileKey = role === USER_ROLES.CORPORATE ? 'corporateProfile' : 'contractorProfile'
  const statusKey = role === USER_ROLES.CORPORATE ? 'corporateProfile.status' : 'contractorProfile.verificationStatus'
  const submittedKey = `${profileKey}.documentsSubmittedAt`
  const documentsKey = `${profileKey}.documents`

  if (filter === 'not_submitted') {
    return {
      ...base,
      $and: [notSubmittedClause(submittedKey), pendingStatusClause(role, statusKey)],
    }
  }

  /** Submitted for review OR uploaded docs while still pending (actionable admin queue) */
  if (filter === 'submitted' || filter === 'pending_review' || filter === 'needs_review') {
    return {
      ...base,
      $and: [
        pendingStatusClause(role, statusKey),
        {
          $or: [
            { [submittedKey]: { $exists: true, $ne: null } },
            hasDocumentsClause(documentsKey),
          ],
        },
      ],
    }
  }

  if (filter === 'draft') {
    return {
      ...base,
      $and: [
        notSubmittedClause(submittedKey),
        hasDocumentsClause(documentsKey),
        pendingStatusClause(role, statusKey),
      ],
    }
  }

  if (filter === 'approved') {
    return { ...base, [statusKey]: role === USER_ROLES.CORPORATE ? CORPORATE_STATUS.APPROVED : 'approved' }
  }
  if (filter === 'rejected') {
    return { ...base, [statusKey]: role === USER_ROLES.CORPORATE ? CORPORATE_STATUS.REJECTED : 'rejected' }
  }
  return base
}

function applySearch(query, search) {
  if (!search) return query
  return { $and: [query, buildSearchOr(search)] }
}

async function listByRole(req, res, role) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12))
  const filter = String(req.query.filter || 'submitted').toLowerCase()
  const search = String(req.query.search || '').trim().slice(0, 80)

  const query = applySearch(verificationFilterQuery(role, filter), search)

  const pendingReviewBase =
    role === USER_ROLES.CORPORATE
      ? {
          role,
          'corporateProfile.status': CORPORATE_STATUS.PENDING,
          $or: [
            { 'corporateProfile.documentsSubmittedAt': { $exists: true, $ne: null } },
            { 'corporateProfile.documents.0': { $exists: true } },
          ],
        }
      : {
          role,
          'contractorProfile.verificationStatus': 'pending',
          $or: [
            { 'contractorProfile.documentsSubmittedAt': { $exists: true, $ne: null } },
            { 'contractorProfile.documents.0': { $exists: true } },
          ],
        }

  const [items, total, submittedCount, approvedCount, pendingReviewCount] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('fullName phone email role corporateProfile contractorProfile createdAt isActive')
      .lean(),
    User.countDocuments(query),
    User.countDocuments({
      role,
      ...(role === USER_ROLES.CORPORATE
        ? { 'corporateProfile.documentsSubmittedAt': { $exists: true, $ne: null } }
        : { 'contractorProfile.documentsSubmittedAt': { $exists: true, $ne: null } }),
    }),
    User.countDocuments({
      role,
      ...(role === USER_ROLES.CORPORATE
        ? { 'corporateProfile.status': CORPORATE_STATUS.APPROVED }
        : { 'contractorProfile.verificationStatus': 'approved' }),
    }),
    User.countDocuments(pendingReviewBase),
  ])

  sendSuccess(res, {
    data: {
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats: { submittedCount, approvedCount, pendingReviewCount },
    },
  })
}

export const listCorporateVerificationsAdmin = asyncHandler((req, res) =>
  listByRole(req, res, USER_ROLES.CORPORATE),
)

export const listVendorVerificationsAdmin = asyncHandler((req, res) =>
  listByRole(req, res, USER_ROLES.CONTRACTOR),
)

export const getBusinessVerificationAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (![USER_ROLES.CORPORATE, USER_ROLES.CONTRACTOR].includes(user.role)) {
    return sendError(res, { message: 'Not a business account', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  sendSuccess(res, { data: { user: user.toSafeObject() } })
})

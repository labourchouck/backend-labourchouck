import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourCategoryGroup, LABOUR_GROUP_KIND } from '../models/LabourCategoryGroup.js'
import { KYC_STATUS, ROLE_LIST, USER_ROLES } from '../constants/roles.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { populateLabourCategories } from '../utils/populateLabourCategories.js'
import { isValidAadhaarLength, maskAadhaarLast4, normalizeAadhaar } from '../utils/aadhaar.js'
import { normalizeStoredMediaUrl } from '../utils/mediaUrl.js'

const MAX_KYC_IMAGE_CHARS = 750_000

function validateKycDataUrlImage(value, label) {
  if (typeof value !== 'string' || value.length < 80) {
    return `${label} image is missing or too small`
  }
  if (value.length > MAX_KYC_IMAGE_CHARS) {
    return `${label} image is too large — try a clearer photo under ~4MB before upload`
  }
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)) {
    return `${label} must be a JPEG or PNG data URL from your camera or gallery`
  }
  return null
}

function labourHasKycVideo(lp) {
  return Boolean(lp?.kycVideoUrl?.trim())
}

function normalizePan(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
}

function isValidPan(normalized) {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(normalized)
}

function maskPan(normalized) {
  return `${normalized.slice(0, 5)} XXXX ${normalized.slice(-1)}`
}

function sanitizeKycVideoMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  return {
    publicId: meta.publicId ? String(meta.publicId).slice(0, 512) : undefined,
    resourceType: meta.resourceType ? String(meta.resourceType).slice(0, 32) : undefined,
    format: meta.format ? String(meta.format).slice(0, 32) : undefined,
    bytes: Number.isFinite(Number(meta.bytes)) ? Number(meta.bytes) : undefined,
    duration: Number.isFinite(Number(meta.duration)) ? Number(meta.duration) : undefined,
    uploadedAt: meta.uploadedAt ? new Date(meta.uploadedAt) : undefined,
  }
}

/** PATCH /users/me — update basic profile fields (mobile-first parity with future app) */
export const updateMe = asyncHandler(async (req, res) => {
  const { fullName, profileImageUrl } = req.body
  const user = req.user

  if (fullName != null) user.fullName = String(fullName).trim()

  if (profileImageUrl !== undefined) {
    const raw = profileImageUrl == null ? '' : String(profileImageUrl).trim()
    if (raw) {
      const httpsUrl = normalizeStoredMediaUrl(raw)
      if (httpsUrl) {
        user.profileImageUrl = httpsUrl
      } else if (/^data:image\//i.test(raw)) {
        const imgErr = validateKycDataUrlImage(raw, 'Profile photo')
        if (imgErr) {
          return sendError(res, {
            message: imgErr,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            code: 'INVALID_PROFILE_IMAGE',
          })
        }
        user.profileImageUrl = raw
      } else {
        return sendError(res, {
          message: 'Upload profile photo via /uploads/media (profiles folder) or use a valid https:// URL',
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: 'INVALID_PROFILE_IMAGE',
        })
      }
    } else {
      user.profileImageUrl = null
    }
  }

  if (req.body.labourProfile?.skills && user.role === USER_ROLES.LABOUR) {
    user.labourProfile = user.labourProfile || {}
    user.labourProfile.skills = req.body.labourProfile.skills
  }

  await user.save()
  await populateLabourCategories(user)
  return sendSuccess(res, {
    message: 'Profile updated',
    data: { user: user.toSafeObject() },
  })
})

/** PATCH /users/me/labour-categories — worker trade + profile tags */
export const updateLabourCategories = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, {
      message: 'Only worker accounts use this step',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }

  const { services } = req.body
  const uniqueServices = []
  const uniqueSubcategoryIds = []
  
  if (Array.isArray(services)) {
    const seen = new Set()
    for (const svc of services) {
      if (svc.subcategoryId && !seen.has(String(svc.subcategoryId))) {
        seen.add(String(svc.subcategoryId))
        uniqueSubcategoryIds.push(String(svc.subcategoryId))
        uniqueServices.push({
          subcategoryId: String(svc.subcategoryId),
          minPrice: Number(svc.minPrice) || 0,
          maxPrice: Number(svc.maxPrice) || 0,
        })
      }
    }
  }

  // Dynamically import LabourSubcategory
  const { LabourSubcategory } = await import('../models/LabourSubcategory.js')
  
  const subcategories = await LabourSubcategory.find({
    _id: { $in: uniqueSubcategoryIds },
    isActive: true,
  }).populate('categoryId')

  if (subcategories.length !== uniqueSubcategoryIds.length) {
    return sendError(res, {
      message: 'One or more categories are invalid or inactive',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_CATEGORIES',
    })
  }

  const hasTrade = subcategories.length > 0 // all subcategories act as trade now
  if (!hasTrade) {
    return sendError(res, {
      message:
        'Choose at least one job type (for example plumber, electrician, or construction helper). Profile tags alone are not enough for worksite matching.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'TRADE_REQUIRED',
    })
  }

  const catIds = [...new Set(subcategories.map(s => String(s.categoryId?._id || s.categoryId)))]

  req.user.labourProfile = req.user.labourProfile || {}
  req.user.labourProfile.subcategoryIds = uniqueSubcategoryIds
  req.user.labourProfile.categoryIds = catIds
  req.user.labourProfile.servicePricing = uniqueServices
  await req.user.save()
  await populateLabourCategories(req.user)

  return sendSuccess(res, {
    message: 'Work categories saved',
    data: { user: req.user.toSafeObject() },
  })
})

/** GET /users/me — alias clarity for some clients */
export const getProfile = asyncHandler(async (req, res) => {
  await populateLabourCategories(req.user)
  return sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

/** POST /users/me/labour/kyc/submit — labour: Aadhaar/PAN numbers + recorded video → pending admin review */
export const submitLabourKycDocuments = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return sendError(res, {
      message: 'Only worker accounts can submit KYC here',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }

  if (req.user.labourProfile?.kycStatus === KYC_STATUS.VERIFIED) {
    return sendError(res, {
      message: 'KYC is already approved',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'KYC_ALREADY_VERIFIED',
    })
  }

  const lp = req.user.labourProfile || {}
  const isVideoOnlyResubmit =
    lp.kycStatus === KYC_STATUS.FAILED && Boolean(lp.aadhaarMasked?.trim()) && Boolean(lp.panMasked?.trim())

  const normalizedAadhaar = normalizeAadhaar(req.body.aadhaar)
  const normalizedPan = normalizePan(req.body.pan)
  const hasAadhaarInput = normalizedAadhaar.length > 0
  const hasPanInput = normalizedPan.length > 0

  if (isVideoOnlyResubmit) {
    if (hasAadhaarInput && !isValidAadhaarLength(normalizedAadhaar)) {
      return sendError(res, {
        message: 'Enter a valid 12-digit Aadhaar number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_AADHAAR',
      })
    }
    if (hasPanInput && !isValidPan(normalizedPan)) {
      return sendError(res, {
        message: 'Enter a valid PAN number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_PAN',
      })
    }
  } else {
    if (!isValidAadhaarLength(normalizedAadhaar)) {
      return sendError(res, {
        message: 'Enter a valid 12-digit Aadhaar number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_AADHAAR',
      })
    }
    if (!isValidPan(normalizedPan)) {
      return sendError(res, {
        message: 'Enter a valid PAN number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_PAN',
      })
    }
  }

  const videoUrl = normalizeStoredMediaUrl(req.body.videoUrl)
  if (!videoUrl) {
    return sendError(res, {
      message: 'Record and upload a KYC video before submitting',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_KYC_VIDEO',
    })
  }

  const updateData = {
    'labourProfile.kycStatus': KYC_STATUS.PENDING,
    'labourProfile.kycVideoUrl': videoUrl,
    'labourProfile.kycVideoMeta': sanitizeKycVideoMeta(req.body.videoMeta),
    'labourProfile.kycSubmittedAt': new Date(),
  }
  if (hasAadhaarInput) updateData['labourProfile.aadhaarMasked'] = maskAadhaarLast4(normalizedAadhaar)
  if (hasPanInput) updateData['labourProfile.panMasked'] = maskPan(normalizedPan)

  req.user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateData, $unset: { 'labourProfile.kycReviewNote': 1 } },
    { new: true, runValidators: false }
  )
  await populateLabourCategories(req.user)

  return sendSuccess(res, {
    message: 'KYC video submitted — an admin will review your Aadhaar and PAN shortly.',
    data: { user: req.user.toSafeObject() },
  })
})

/** PATCH /users/:id/labour-kyc-review — admin approve / reject labour KYC */
export const reviewLabourKyc = asyncHandler(async (req, res) => {
  const { decision, note } = req.body
  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  if (user.role !== USER_ROLES.LABOUR) {
    return sendError(res, {
      message: 'KYC review applies to labour accounts only',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_ROLE',
    })
  }

  user.labourProfile = user.labourProfile || {}

  if (decision === 'approved') {
    if (!user.labourProfile.kycSubmittedAt || !labourHasKycVideo(user.labourProfile)) {
      return sendError(res, {
        message: 'This worker has not submitted a KYC video yet',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'NO_KYC_SUBMISSION',
      })
    }
    user.labourProfile.kycStatus = KYC_STATUS.VERIFIED
    user.labourProfile.kycReviewNote = undefined
  } else {
    user.labourProfile.kycStatus = KYC_STATUS.FAILED
    user.labourProfile.kycReviewNote = typeof note === 'string' ? note.trim().slice(0, 500) : ''
  }

  await user.save()
  await populateLabourCategories(user)

  return sendSuccess(res, {
    message: decision === 'approved' ? 'KYC approved for this worker' : 'KYC marked as rejected',
    data: { user: user.toSafeObject({ includeLabourKycImages: true }) },
  })
})

const MAX_SEARCH_LEN = 80
const MAX_PAGE_SIZE = 100

function buildSearchOrClause(searchTrim) {
  const esc = searchTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const or = [{ fullName: new RegExp(esc, 'i') }, { email: new RegExp(esc, 'i') }]
  const digits = searchTrim.replace(/\D/g, '')
  if (digits.length >= 2) {
    or.push({ phone: { $regex: digits } })
  }
  return { $or: or }
}

const KYC_PENDING_CONDITIONS = [
  { labourProfile: { $exists: false } },
  { 'labourProfile.kycStatus': { $exists: false } },
  { 'labourProfile.kycStatus': null },
  { 'labourProfile.kycStatus': KYC_STATUS.PENDING },
]

function mergeAnd(base, extraClauses) {
  const next = { ...base }
  const existing = Array.isArray(next.$and) ? [...next.$and] : []
  next.$and = [...existing, ...extraClauses]
  return next
}

/** Admin: list users with search, role, active/inactive, optional labour KYC filter, pagination */
export const listUsers = asyncHandler(async (req, res) => {
  const { search, role, status, kycStatus, page = 1, limit = 20 } = req.query
  const q = {}
  const andParts = []

  if (role) {
    if (!ROLE_LIST.includes(role)) {
      return sendError(res, {
        message: 'Invalid role filter',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_ROLE',
      })
    }
  }

  if (status === 'active') q.isActive = true
  else if (status === 'inactive') q.isActive = false
  else if (status != null && status !== '' && status !== 'all') {
    return sendError(res, {
      message: 'status must be active, inactive, or all',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_STATUS',
    })
  }

  const searchTrim = typeof search === 'string' ? search.trim() : ''
  if (searchTrim.length > MAX_SEARCH_LEN) {
    return sendError(res, {
      message: `Search must be at most ${MAX_SEARCH_LEN} characters`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'SEARCH_TOO_LONG',
    })
  }

  if (searchTrim) {
    andParts.push(buildSearchOrClause(searchTrim))
  }

  const kycRaw = typeof kycStatus === 'string' ? kycStatus.trim().toLowerCase() : ''
  const kycKey = kycRaw === '' || kycRaw === 'all' ? 'all' : kycRaw
  if (kycKey !== 'all' && !Object.values(KYC_STATUS).includes(kycKey)) {
    return sendError(res, {
      message: 'kycStatus must be all, pending, verified, or failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_KYC_STATUS',
    })
  }

  if (kycKey !== 'all') {
    if (role && role !== USER_ROLES.LABOUR) {
      return sendError(res, {
        message: 'KYC filter applies to labour accounts only — use role=labour or omit role.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'KYC_REQUIRES_LABOUR',
      })
    }
    q.role = USER_ROLES.LABOUR
    if (kycKey === KYC_STATUS.PENDING) {
      andParts.push({ $or: KYC_PENDING_CONDITIONS })
    } else if (kycKey === KYC_STATUS.VERIFIED) {
      andParts.push({ 'labourProfile.kycStatus': KYC_STATUS.VERIFIED })
    } else if (kycKey === KYC_STATUS.FAILED) {
      andParts.push({ 'labourProfile.kycStatus': KYC_STATUS.FAILED })
    }
  } else if (role) {
    q.role = role
  }

  if (andParts.length) {
    q.$and = andParts
  }

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  let labourKycCounts = null
  if (q.role === USER_ROLES.LABOUR) {
    const statsBase = { role: USER_ROLES.LABOUR }
    if (q.isActive !== undefined) statsBase.isActive = q.isActive
    if (searchTrim) {
      statsBase.$and = [buildSearchOrClause(searchTrim)]
    }
    const [pending, verified, failed, labourTotal] = await Promise.all([
      User.countDocuments(mergeAnd(statsBase, [{ $or: KYC_PENDING_CONDITIONS }])),
      User.countDocuments(mergeAnd(statsBase, [{ 'labourProfile.kycStatus': KYC_STATUS.VERIFIED }])),
      User.countDocuments(mergeAnd(statsBase, [{ 'labourProfile.kycStatus': KYC_STATUS.FAILED }])),
      User.countDocuments(statsBase),
    ])
    labourKycCounts = { pending, verified, failed, total: labourTotal }
  }

  const [items, total] = await Promise.all([
    User.find(q)
      .select('-passwordHash')
      .populate({ path: 'labourProfile.categoryIds', select: 'name slug isActive' })
      .sort({ lastLoginAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    User.countDocuments(q),
  ])

  const itemsOut = items.map((u) => {
    if (!u.labourProfile) return u
    const lp = { ...u.labourProfile }
    delete lp.kycFrontImageDataUrl
    delete lp.kycBackImageDataUrl
    return { ...u, labourProfile: lp }
  })

  return sendSuccess(res, {
    data: {
      items: itemsOut,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
      labourKycCounts,
    },
  })
})

/** Admin: get one user (includes KYC document data URLs for review) */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  await populateLabourCategories(user)
  return sendSuccess(res, { data: { user: user.toSafeObject({ includeLabourKycImages: true }) } })
})

function displayNameFromFullName(fullName) {
  const t = (fullName || '').trim()
  if (!t) return 'Worker'
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  const initial = last[0]?.toUpperCase() || ''
  return initial ? `${parts[0]} ${initial}.` : parts[0]
}

function escapeRegexForMongo(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tradeCategoriesFromPopulatedUser(leanUser) {
  const raw = leanUser.labourProfile?.categoryIds
  if (!Array.isArray(raw)) return []
  const out = []
  for (const c of raw) {
    if (!c || typeof c !== 'object' || !c._id) continue
    if (c.isActive === false) continue
    const g = c.group
    if (!g || typeof g !== 'object') continue
    if (g.kind !== LABOUR_GROUP_KIND.TRADE || g.isActive === false) continue
    out.push({
      _id: String(c._id),
      name: c.name,
      subtitle: c.subtitle || '',
      groupId: g._id ? String(g._id) : '',
      groupName: g.name || '',
    })
  }
  return out
}

function labourToPublicCard(leanUser) {
  const trades = tradeCategoriesFromPopulatedUser(leanUser)
  const kyc = leanUser.labourProfile?.kycStatus
  return {
    id: String(leanUser._id),
    displayName: displayNameFromFullName(leanUser.fullName),
    kycVerified: kyc === KYC_STATUS.VERIFIED,
    kycStatus: typeof kyc === 'string' ? kyc : KYC_STATUS.PENDING,
    tradeCategories: trades,
  }
}

function labourToPublicDetail(leanUser) {
  const base = labourToPublicCard(leanUser)
  const created = leanUser.createdAt ? new Date(leanUser.createdAt) : null
  return {
    ...base,
    memberSinceYear: created && !Number.isNaN(created.getTime()) ? created.getFullYear() : null,
  }
}

/** GET /users/discover/labours — app users browse workers (trade categories only; no phone/email) */
export const listDiscoverLabours = asyncHandler(async (req, res) => {
  const groupIdRaw = typeof req.query.groupId === 'string' ? req.query.groupId.trim() : ''
  const categoryIdRaw = typeof req.query.categoryId === 'string' ? req.query.categoryId.trim() : ''
  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : ''
  const lim = Math.min(50, Math.max(1, Number(req.query.limit) || 24))

  const filter = {
    role: USER_ROLES.LABOUR,
    isActive: true,
    'labourProfile.categoryIds.0': { $exists: true },
  }

  if (qRaw) {
    filter.fullName = { $regex: escapeRegexForMongo(qRaw), $options: 'i' }
  }

  if (categoryIdRaw) {
    if (!mongoose.isValidObjectId(categoryIdRaw)) {
      return sendError(res, {
        message: 'Invalid category id',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_CATEGORY',
      })
    }
    const cat = await LabourCategory.findOne({ _id: categoryIdRaw, isActive: true })
      .populate({ path: 'group', select: 'kind isActive' })
      .lean()
    if (!cat || cat.group?.kind !== LABOUR_GROUP_KIND.TRADE || cat.group?.isActive === false) {
      return sendSuccess(res, { data: { items: [] } })
    }
    filter['labourProfile.categoryIds'] = new mongoose.Types.ObjectId(categoryIdRaw)
  } else if (groupIdRaw) {
    if (!mongoose.isValidObjectId(groupIdRaw)) {
      return sendError(res, {
        message: 'Invalid group id',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_GROUP',
      })
    }
    const group = await LabourCategoryGroup.findById(groupIdRaw).lean()
    if (!group || group.kind !== LABOUR_GROUP_KIND.TRADE || !group.isActive) {
      return sendSuccess(res, { data: { items: [] } })
    }
    const catIds = await LabourCategory.find({ group: groupIdRaw, isActive: true }).distinct('_id')
    if (!catIds.length) {
      return sendSuccess(res, { data: { items: [] } })
    }
    filter['labourProfile.categoryIds'] = { $in: catIds }
  }

  const items = await User.find(filter)
    .select('fullName labourProfile.kycStatus labourProfile.categoryIds createdAt')
    .populate({
      path: 'labourProfile.categoryIds',
      match: { isActive: true },
      select: 'name subtitle isActive group',
      populate: { path: 'group', select: 'name kind isActive' },
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(lim)
    .lean()

  const cards = items.map((u) => labourToPublicCard(u)).filter((c) => c.tradeCategories.length > 0)

  return sendSuccess(res, { data: { items: cards } })
})

/** GET /users/discover/labours/:id — public worker detail for homeowner app */
export const getDiscoverLabour = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    role: USER_ROLES.LABOUR,
    isActive: true,
    'labourProfile.categoryIds.0': { $exists: true },
  })
    .select('fullName labourProfile.kycStatus labourProfile.categoryIds createdAt')
    .populate({
      path: 'labourProfile.categoryIds',
      match: { isActive: true },
      select: 'name subtitle isActive group',
      populate: { path: 'group', select: 'name kind isActive' },
    })
    .lean()

  if (!user) {
    return sendError(res, { message: 'Worker not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }

  const detail = labourToPublicDetail(user)
  if (!detail.tradeCategories.length) {
    return sendError(res, { message: 'Worker not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }

  return sendSuccess(res, { data: { labour: detail } })
})

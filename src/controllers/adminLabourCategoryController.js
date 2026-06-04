import { LabourCategoryGroup } from '../models/LabourCategoryGroup.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LABOUR_GROUP_KIND } from '../models/LabourCategoryGroup.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { slugify } from '../utils/slugify.js'
import { normalizeStoredMediaUrl } from '../utils/mediaUrl.js'

function normalizeImageUrl(value) {
  if (value == null) return undefined
  const normalized = normalizeStoredMediaUrl(value)
  if (normalized === null) return null
  return normalized
}

export const listAllGroups = asyncHandler(async (_req, res) => {
  const groups = await LabourCategoryGroup.find().sort({ sortOrder: 1, name: 1 }).lean()
  const cats = await LabourCategory.find().sort({ sortOrder: 1, name: 1 }).lean()
  const byGroup = new Map()
  for (const g of groups) byGroup.set(String(g._id), [])
  for (const c of cats) {
    const k = String(c.group)
    if (byGroup.has(k)) byGroup.get(k).push(c)
  }
  return sendSuccess(res, {
    data: {
      groups: groups.map((g) => ({
        ...g,
        categories: byGroup.get(String(g._id)) ?? [],
      })),
    },
  })
})

export const createGroup = asyncHandler(async (req, res) => {
  const {
    name,
    slug: rawSlug,
    description = '',
    helperText = '',
    kind = LABOUR_GROUP_KIND.TRADE,
    sortOrder = 99,
    imageUrl,
  } = req.body
  const slug = rawSlug ? slugify(rawSlug) : slugify(name)
  const exists = await LabourCategoryGroup.findOne({ slug })
  if (exists) {
    return sendError(res, { message: 'Group slug already exists', statusCode: HTTP_STATUS.CONFLICT, code: 'DUPLICATE' })
  }
  let image = ''
  if (imageUrl != null) {
    const normalized = normalizeImageUrl(imageUrl)
    if (normalized === null) {
      return sendError(res, {
        message: 'imageUrl must be empty or a valid https:// URL (upload via /uploads/media first)',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'VALIDATION',
      })
    }
    image = normalized
  }
  const g = await LabourCategoryGroup.create({
    name: name.trim(),
    slug,
    description,
    helperText,
    kind,
    sortOrder,
    imageUrl: image,
    isActive: true,
  })
  return sendSuccess(res, { message: 'Group created', statusCode: HTTP_STATUS.CREATED, data: { group: g } })
})

export const patchGroup = asyncHandler(async (req, res) => {
  const g = await LabourCategoryGroup.findById(req.params.id)
  if (!g) {
    return sendError(res, { message: 'Group not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  const { name, description, helperText, kind, sortOrder, isActive, imageUrl } = req.body
  if (name != null) g.name = String(name).trim()
  if (description != null) g.description = String(description)
  if (helperText != null) g.helperText = String(helperText)
  if (kind != null) g.kind = kind
  if (sortOrder != null) g.sortOrder = Number(sortOrder)
  if (isActive != null) g.isActive = Boolean(isActive)
  if (imageUrl !== undefined) {
    const normalized = normalizeImageUrl(imageUrl)
    if (normalized === null) {
      return sendError(res, {
        message: 'imageUrl must be empty or a valid https:// URL (upload via /uploads/media first)',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'VALIDATION',
      })
    }
    g.imageUrl = normalized
  }
  await g.save()
  return sendSuccess(res, { message: 'Group updated', data: { group: g } })
})

export const createCategory = asyncHandler(async (req, res) => {
  const { groupId, name, subtitle = '', sortOrder = 0, imageUrl } = req.body
  const group = await LabourCategoryGroup.findById(groupId)
  if (!group) {
    return sendError(res, { message: 'Group not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  const base = slugify(name)
  let slug = `${group.slug}-${base}-${sortOrder}`
  let n = 0
  while (await LabourCategory.findOne({ slug })) {
    n += 1
    slug = `${group.slug}-${base}-${sortOrder}-${n}`
  }
  let image = ''
  if (imageUrl != null) {
    const normalized = normalizeImageUrl(imageUrl)
    if (normalized === null) {
      return sendError(res, {
        message: 'imageUrl must be empty or a valid https:// URL (upload via /uploads/media first)',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'VALIDATION',
      })
    }
    image = normalized
  }

  const c = await LabourCategory.create({
    group: group._id,
    name: name.trim(),
    slug,
    subtitle,
    imageUrl: image,
    sortOrder,
    isActive: true,
  })
  return sendSuccess(res, { message: 'Category created', statusCode: HTTP_STATUS.CREATED, data: { category: c } })
})

export const patchCategory = asyncHandler(async (req, res) => {
  const c = await LabourCategory.findById(req.params.id)
  if (!c) {
    return sendError(res, { message: 'Category not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  const { name, subtitle, sortOrder, isActive, groupId, imageUrl } = req.body
  if (name != null) c.name = String(name).trim()
  if (subtitle != null) c.subtitle = String(subtitle)
  if (sortOrder != null) c.sortOrder = Number(sortOrder)
  if (isActive != null) c.isActive = Boolean(isActive)
  if (imageUrl !== undefined) {
    const normalized = normalizeImageUrl(imageUrl)
    if (normalized === null) {
      return sendError(res, {
        message: 'imageUrl must be empty or a valid https:// URL (upload via /uploads/media first)',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'VALIDATION',
      })
    }
    c.imageUrl = normalized
  }
  if (groupId != null) {
    const g = await LabourCategoryGroup.findById(groupId)
    if (!g) {
      return sendError(res, { message: 'Group not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
    }
    c.group = g._id
  }
  await c.save()
  return sendSuccess(res, { message: 'Category updated', data: { category: c } })
})

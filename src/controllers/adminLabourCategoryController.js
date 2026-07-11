import { LabourCategoryGroup } from '../models/LabourCategoryGroup.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
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
  const subcats = await LabourSubcategory.find().sort({ name: 1 }).lean()
  const services = await LabourService.find().sort({ name: 1 }).lean()

  const servicesBySubcat = new Map()
  for (const s of services) {
    const k = String(s.subcategoryId)
    if (!servicesBySubcat.has(k)) servicesBySubcat.set(k, [])
    servicesBySubcat.get(k).push(s)
  }

  const subcatsByCat = new Map()
  for (const sc of subcats) {
    sc.services = servicesBySubcat.get(String(sc._id)) ?? []
    const k = String(sc.categoryId)
    if (!subcatsByCat.has(k)) subcatsByCat.set(k, [])
    subcatsByCat.get(k).push(sc)
  }

  const byGroup = new Map()
  for (const g of groups) byGroup.set(String(g._id), [])
  for (const c of cats) {
    c.subcategories = subcatsByCat.get(String(c._id)) ?? []
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

export const getCategory = asyncHandler(async (req, res) => {
  const c = await LabourCategory.findById(req.params.id)
  if (!c) {
    return sendError(res, { message: 'Category not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  return sendSuccess(res, { data: { category: c } })
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

export const putCategory = asyncHandler(async (req, res) => {
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
  return sendSuccess(res, { message: 'Category replaced/updated', data: { category: c } })
})

export const createSubcategory = asyncHandler(async (req, res) => {
  const { categoryId, name, description = '', basePrice, estimatedDurationMins = 60, iconUrl } = req.body
  const cat = await LabourCategory.findById(categoryId)
  if (!cat) {
    return sendError(res, { message: 'Category not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  const exists = await LabourSubcategory.findOne({ categoryId: cat._id, name: name.trim() })
  if (exists) {
    return sendError(res, { message: 'Subcategory name already exists in this category', statusCode: HTTP_STATUS.CONFLICT, code: 'DUPLICATE' })
  }
  let image = ''
  if (iconUrl != null) {
    const normalized = normalizeImageUrl(iconUrl)
    if (normalized === null) {
      return sendError(res, {
        message: 'iconUrl must be empty or a valid https:// URL (upload via /uploads/media first)',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'VALIDATION',
      })
    }
    image = normalized
  }
  const sc = await LabourSubcategory.create({
    categoryId: cat._id,
    name: name.trim(),
    description,
    basePrice: Number(basePrice),
    estimatedDurationMins: Number(estimatedDurationMins),
    iconUrl: image,
    isActive: true,
  })
  return sendSuccess(res, { message: 'Subcategory created', statusCode: HTTP_STATUS.CREATED, data: { subcategory: sc } })
})

export const patchSubcategory = asyncHandler(async (req, res) => {
  const sc = await LabourSubcategory.findById(req.params.id)
  if (!sc) {
    return sendError(res, { message: 'Subcategory not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  const { name, description, basePrice, estimatedDurationMins, isActive, iconUrl } = req.body
  if (name != null) sc.name = String(name).trim()
  if (description != null) sc.description = String(description)
  if (basePrice != null) sc.basePrice = Number(basePrice)
  if (estimatedDurationMins != null) sc.estimatedDurationMins = Number(estimatedDurationMins)
  if (isActive != null) sc.isActive = Boolean(isActive)
  if (iconUrl !== undefined) {
    const normalized = normalizeImageUrl(iconUrl)
    if (normalized === null) {
      return sendError(res, {
        message: 'iconUrl must be empty or a valid https:// URL',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'VALIDATION',
      })
    }
    sc.iconUrl = normalized
  }
  await sc.save()
  return sendSuccess(res, { message: 'Subcategory updated', data: { subcategory: sc } })
})

export const createService = asyncHandler(async (req, res) => {
  const { subcategoryId, name, description = '', basePrice = 0, estimatedDurationMins = 60, iconUrl } = req.body
  const subcat = await LabourSubcategory.findById(subcategoryId)
  if (!subcat) {
    return sendError(res, { message: 'Subcategory not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  const exists = await LabourService.findOne({ subcategoryId: subcat._id, name: name.trim() })
  if (exists) {
    return sendError(res, { message: 'Service name already exists in this subcategory', statusCode: HTTP_STATUS.CONFLICT, code: 'DUPLICATE' })
  }
  let image = ''
  if (iconUrl != null) {
    const normalized = normalizeImageUrl(iconUrl)
    if (normalized === null) {
      return sendError(res, {
        message: 'iconUrl must be empty or a valid https:// URL',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'VALIDATION',
      })
    }
    image = normalized
  }
  const s = await LabourService.create({
    subcategoryId: subcat._id,
    name: name.trim(),
    description,
    basePrice: Number(basePrice),
    estimatedDurationMins: Number(estimatedDurationMins),
    iconUrl: image,
    isActive: true,
  })
  return sendSuccess(res, { message: 'Service created', statusCode: HTTP_STATUS.CREATED, data: { service: s } })
})

export const patchService = asyncHandler(async (req, res) => {
  const s = await LabourService.findById(req.params.id)
  if (!s) {
    return sendError(res, { message: 'Service not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  const { name, description, basePrice, estimatedDurationMins, isActive, iconUrl } = req.body
  if (name != null) s.name = String(name).trim()
  if (description != null) s.description = String(description)
  if (basePrice != null) s.basePrice = Number(basePrice)
  if (estimatedDurationMins != null) s.estimatedDurationMins = Number(estimatedDurationMins)
  if (isActive != null) s.isActive = Boolean(isActive)
  if (iconUrl !== undefined) {
    const normalized = normalizeImageUrl(iconUrl)
    if (normalized === null) {
      return sendError(res, {
        message: 'iconUrl must be empty or a valid https:// URL',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'VALIDATION',
      })
    }
    s.iconUrl = normalized
  }
  await s.save()
  return sendSuccess(res, { message: 'Service updated', data: { service: s } })
})

export const deleteCategory = asyncHandler(async (req, res) => {
  const c = await LabourCategory.findByIdAndDelete(req.params.id)
  if (!c) {
    return sendError(res, { message: 'Category not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  return sendSuccess(res, { message: 'Category deleted successfully' })
})

export const deleteSubcategory = asyncHandler(async (req, res) => {
  const sc = await LabourSubcategory.findByIdAndDelete(req.params.id)
  if (!sc) {
    return sendError(res, { message: 'Subcategory not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  return sendSuccess(res, { message: 'Subcategory deleted successfully' })
})

export const deleteService = asyncHandler(async (req, res) => {
  const s = await LabourService.findByIdAndDelete(req.params.id)
  if (!s) {
    return sendError(res, { message: 'Service not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  return sendSuccess(res, { message: 'Service deleted successfully' })
})

export const searchServices = asyncHandler(async (req, res) => {
  const { q = '', page = 1, limit = 10 } = req.query
  const query = {
    name: { $regex: q, $options: 'i' }
  }
  const skip = (Number(page) - 1) * Number(limit)
  
  const services = await LabourService.find(query)
    .populate('subcategoryId', 'name categoryId')
    .sort({ name: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  const total = await LabourService.countDocuments(query)

  return sendSuccess(res, {
    data: {
      services,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    }
  })
})

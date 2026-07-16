import { BuildMartLead } from '../models/BuildMartLead.js'
import { BuildMartProduct } from '../models/BuildMartProduct.js'
import { BuildMartCategory } from '../models/BuildMartCategory.js'
import { BuildMartBanner } from '../models/BuildMartBanner.js'
import { USER_ROLES } from '../constants/roles.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

/** POST /buildmart/quotes — authenticated users submit material quote requests */
export const submitQuoteRequest = asyncHandler(async (req, res) => {
  const {
    productId,
    productName,
    variantId,
    variantLabel,
    name,
    phone,
    siteLocation,
    quantity,
    deliveryDate,
    notes,
  } = req.body

  const lead = await BuildMartLead.create({
    productId,
    productName,
    variantId: variantId || undefined,
    variantLabel: variantLabel || undefined,
    name,
    phone,
    siteLocation,
    quantity,
    deliveryDate: deliveryDate || undefined,
    notes: notes || undefined,
    userId: req.user._id,
    userRole: req.user.role,
    userName: req.user.fullName || name,
  })

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Quote request submitted',
    data: { lead: lead.toObject() },
  })
})

/** GET /admin/buildmart/leads — admin list quote leads */
export const listLeadsAdmin = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20))
  const status = req.query.status?.trim()
  const search = req.query.search?.trim()

  const filter = {}
  if (status && status !== 'all') filter.status = status
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [
      { name: re },
      { phone: re },
      { productName: re },
      { siteLocation: re },
    ]
  }

  const [items, total] = await Promise.all([
    BuildMartLead.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BuildMartLead.countDocuments(filter),
  ])

  return sendSuccess(res, {
    data: {
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  })
})

/** PATCH /admin/buildmart/leads/:id — update lead status */
export const updateLeadStatusAdmin = asyncHandler(async (req, res) => {
  const { status } = req.body
  const allowed = ['new', 'contacted', 'quoted', 'won', 'lost']
  if (!allowed.includes(status)) {
    return sendError(res, {
      message: 'Invalid status',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_STATUS',
    })
  }

  const lead = await BuildMartLead.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true },
  )
  if (!lead) {
    return sendError(res, {
      message: 'Lead not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'NOT_FOUND',
    })
  }

  return sendSuccess(res, {
    message: 'Lead updated',
    data: { lead: lead.toObject() },
  })
})

export const buildWhatsAppLeadUrl = (lead) => {
  const adminPhone = process.env.BUILDMART_ADMIN_WHATSAPP || ''
  if (!adminPhone) return null
  const text = [
    'BuildMart quote lead',
    `Product: ${lead.productName}`,
    lead.variantLabel ? `Variant: ${lead.variantLabel}` : null,
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    `Site: ${lead.siteLocation}`,
    `Qty: ${lead.quantity}`,
    lead.deliveryDate ? `Delivery: ${lead.deliveryDate}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
  const digits = adminPhone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/** GET /buildmart/products — list all seeded products */
export const getBuildMartProducts = asyncHandler(async (req, res) => {
  const products = await BuildMartProduct.find().lean()
  return sendSuccess(res, {
    data: { products },
  })
})

// --- Categories ---

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await BuildMartCategory.find().lean()
  return sendSuccess(res, { data: categories })
})

export const createCategory = asyncHandler(async (req, res) => {
  const category = await BuildMartCategory.create(req.body)
  return sendSuccess(res, { data: category, statusCode: HTTP_STATUS.CREATED })
})

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await BuildMartCategory.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!category) return sendError(res, { message: 'Category not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { data: category })
})

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await BuildMartCategory.findByIdAndDelete(req.params.id)
  if (!category) return sendError(res, { message: 'Category not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { message: 'Category deleted successfully' })
})

// --- Products ---

export const getProducts = asyncHandler(async (req, res) => {
  const products = await BuildMartProduct.find().lean()
  return sendSuccess(res, { data: products })
})

export const createProduct = asyncHandler(async (req, res) => {
  const product = await BuildMartProduct.create(req.body)
  return sendSuccess(res, { data: product, statusCode: HTTP_STATUS.CREATED })
})

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await BuildMartProduct.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!product) return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { data: product })
})

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await BuildMartProduct.findByIdAndDelete(req.params.id)
  if (!product) return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { message: 'Product deleted successfully' })
})

// --- Banners ---

export const getBanners = asyncHandler(async (req, res) => {
  const banners = await BuildMartBanner.find().lean()
  return sendSuccess(res, { data: banners })
})

export const createBanner = asyncHandler(async (req, res) => {
  const banner = await BuildMartBanner.create(req.body)
  return sendSuccess(res, { data: banner, statusCode: HTTP_STATUS.CREATED })
})

export const updateBanner = asyncHandler(async (req, res) => {
  const banner = await BuildMartBanner.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!banner) return sendError(res, { message: 'Banner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { data: banner })
})

export const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await BuildMartBanner.findByIdAndDelete(req.params.id)
  if (!banner) return sendError(res, { message: 'Banner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { message: 'Banner deleted successfully' })
})

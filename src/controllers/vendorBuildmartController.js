import { BuildMartProduct } from '../models/BuildMartProduct.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const createVendorProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body }

  // Sanitize numeric fields from UI to prevent Mongoose CastErrors
  if (payload.supplier && typeof payload.supplier.rating !== 'undefined') {
    payload.supplier.rating = Number(payload.supplier.rating) || 0
  }
  if (Array.isArray(payload.variants)) {
    payload.variants = payload.variants.map(v => ({
      ...v,
      retailPrice: v.retailPrice ? Number(v.retailPrice) : undefined,
      contractorPrice: v.contractorPrice ? Number(v.contractorPrice) : undefined,
      bulkPrice: v.bulkPrice ? Number(v.bulkPrice) : undefined,
      moq: v.moq ? Number(v.moq) : undefined,
    }))
    payload.variantCount = payload.variants.length
  } else {
    payload.variantCount = 0
  }

  // Set vendor ID and force status to PENDING
  payload.vendorId = req.user._id
  payload.status = 'PENDING'
  payload.rejectionReason = '' // Clear out any incoming reasons

  if (!payload.id && payload.name) {
    payload.id = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }
  
  // Check if ID is already taken
  const existingProduct = await BuildMartProduct.findOne({ id: payload.id })
  if (existingProduct) {
    // If it exists, append a random string to make it unique
    payload.id = `${payload.id}-${Math.random().toString(36).substring(2, 7)}`
  }

  const product = await BuildMartProduct.create(payload)
  
  const result = product.toObject()
  delete result.__v
  delete result.supplier
  
  return sendSuccess(res, { 
    data: result, 
    statusCode: HTTP_STATUS.CREATED,
    message: 'Product submitted successfully and is pending admin approval'
  })
})

export const getVendorProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 20))
  
  const [items, total] = await Promise.all([
    BuildMartProduct.find({ vendorId: req.user._id })
      .select('-__v -supplier')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BuildMartProduct.countDocuments({ vendorId: req.user._id }),
  ])
  
  return sendSuccess(res, {
    data: { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) },
  })
})

export const getVendorProductById = asyncHandler(async (req, res) => {
  const product = await BuildMartProduct.findOne({ 
    id: req.params.id, 
    vendorId: req.user._id 
  }).select('-__v -supplier').lean()

  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { data: product })
})

export const updateVendorProduct = asyncHandler(async (req, res) => {
  const payload = { ...req.body }
  
  // Sanitize numeric fields from UI to prevent Mongoose CastErrors
  if (payload.supplier && typeof payload.supplier.rating !== 'undefined') {
    payload.supplier.rating = Number(payload.supplier.rating) || 0
  }
  if (Array.isArray(payload.variants)) {
    payload.variants = payload.variants.map(v => ({
      ...v,
      retailPrice: v.retailPrice ? Number(v.retailPrice) : undefined,
      contractorPrice: v.contractorPrice ? Number(v.contractorPrice) : undefined,
      bulkPrice: v.bulkPrice ? Number(v.bulkPrice) : undefined,
      moq: v.moq ? Number(v.moq) : undefined,
    }))
    payload.variantCount = payload.variants.length
  } else if (payload.variants !== undefined) {
    payload.variantCount = 0
  }

  // Prevent vendor from maliciously changing status, vendorId, or clearing rejection reason manually
  delete payload.vendorId
  delete payload.status
  delete payload.rejectionReason

  // If vendor updates it, it should go back to PENDING if it was REJECTED
  payload.status = 'PENDING'
  payload.rejectionReason = ''

  const product = await BuildMartProduct.findOneAndUpdate(
    { id: req.params.id, vendorId: req.user._id }, 
    payload, 
    { new: true, runValidators: true }
  ).select('-__v -supplier').lean()

  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { 
    data: product,
    message: 'Product updated and resubmitted for admin approval'
  })
})

export const deleteVendorProduct = asyncHandler(async (req, res) => {
  const product = await BuildMartProduct.findOneAndDelete({ 
    id: req.params.id, 
    vendorId: req.user._id 
  })
  
  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  return sendSuccess(res, { message: 'Product deleted successfully' })
})

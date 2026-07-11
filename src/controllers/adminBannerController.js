import { Banner } from '../models/Banner.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendError, sendSuccess, HTTP_STATUS } from '../utils/apiResponse.js'
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js'

export const createBanner = asyncHandler(async (req, res) => {
  const { targetUrl, isActive, sortOrder } = req.body

  if (!req.file) {
    return sendError(res, { message: 'Banner image file is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const asset = await uploadBufferToCloudinary({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    folder: 'banners',
    userId: req.user._id,
    originalName: req.file.originalname,
    resourceType: 'image',
  })

  const banner = await Banner.create({
    imageUrl: asset.url,
    targetUrl,
    isActive: isActive !== undefined ? isActive : true,
    sortOrder: sortOrder || 0
  })

  return sendSuccess(res, { message: 'Banner created successfully', data: { banner } }, HTTP_STATUS.CREATED)
})

export const getAllBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find().sort({ sortOrder: 1, createdAt: -1 })
  return sendSuccess(res, { data: { banners } })
})

export const updateBanner = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { targetUrl, isActive, sortOrder } = req.body

  const banner = await Banner.findById(id)
  if (!banner) {
    return sendError(res, { message: 'Banner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (req.file) {
    const asset = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      folder: 'banners',
      userId: req.user._id,
      originalName: req.file.originalname,
      resourceType: 'image',
    })
    banner.imageUrl = asset.url
  }

  if (targetUrl !== undefined) banner.targetUrl = targetUrl
  if (isActive !== undefined) banner.isActive = isActive
  if (sortOrder !== undefined) banner.sortOrder = sortOrder

  await banner.save()

  return sendSuccess(res, { message: 'Banner updated successfully', data: { banner } })
})

export const deleteBanner = asyncHandler(async (req, res) => {
  const { id } = req.params
  const banner = await Banner.findByIdAndDelete(id)
  
  if (!banner) {
    return sendError(res, { message: 'Banner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { message: 'Banner deleted successfully' })
})


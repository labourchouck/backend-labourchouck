import { Banner } from '../models/Banner.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'

export const getActiveBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find({ isActive: true, $or: [{ panel: 'APP' }, { panel: { $exists: false } }] }).sort({ sortOrder: 1, createdAt: -1 }).lean()
  return sendSuccess(res, { data: { banners } })
})

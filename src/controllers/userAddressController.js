import { UserAddress } from '../models/UserAddress.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

const MAX_ADDRESSES = 20

function toCoord(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** GET /users/me/addresses */
export const listMyAddresses = asyncHandler(async (req, res) => {
  const addresses = await UserAddress.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean()
  return sendSuccess(res, { data: { addresses } })
})

/** POST /users/me/addresses */
export const createMyAddress = asyncHandler(async (req, res) => {
  const count = await UserAddress.countDocuments({ userId: req.user._id })
  if (count >= MAX_ADDRESSES) {
    return sendError(res, {
      message: `You can save up to ${MAX_ADDRESSES} addresses`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'ADDRESS_LIMIT',
    })
  }

  const address = String(req.body.address).trim()
  const existing = await UserAddress.findOne({ userId: req.user._id, address }).lean()
  if (existing) {
    return sendSuccess(res, { message: 'Address already saved', data: { address: existing } })
  }

  const created = await UserAddress.create({
    userId: req.user._id,
    label: String(req.body.label || 'Other').trim() || 'Other',
    address,
    lat: toCoord(req.body.lat),
    lng: toCoord(req.body.lng),
  })
  return sendSuccess(res, {
    message: 'Address saved',
    statusCode: HTTP_STATUS.CREATED,
    data: { address: created.toObject() },
  })
})

/** PATCH /users/me/addresses/:id */
export const updateMyAddress = asyncHandler(async (req, res) => {
  const update = {}
  if (req.body.label != null) update.label = String(req.body.label).trim() || 'Other'
  if (req.body.address != null) update.address = String(req.body.address).trim()
  if (req.body.lat !== undefined) update.lat = toCoord(req.body.lat)
  if (req.body.lng !== undefined) update.lng = toCoord(req.body.lng)

  const address = await UserAddress.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: update },
    { new: true, runValidators: true },
  ).lean()
  if (!address) {
    return sendError(res, { message: 'Address not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  return sendSuccess(res, { message: 'Address updated', data: { address } })
})

/** DELETE /users/me/addresses/:id */
export const deleteMyAddress = asyncHandler(async (req, res) => {
  const result = await UserAddress.deleteOne({ _id: req.params.id, userId: req.user._id })
  if (!result.deletedCount) {
    return sendError(res, { message: 'Address not found', statusCode: HTTP_STATUS.NOT_FOUND, code: 'NOT_FOUND' })
  }
  return sendSuccess(res, { message: 'Address removed', data: { id: req.params.id } })
})

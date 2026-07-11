import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { USER_ROLES } from '../constants/roles.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

/** GET /admin/profile — returns the logged-in admin's safe profile */
export const getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await User.findById(req.user._id).select('+email')
  if (!admin || admin.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  return sendSuccess(res, {
    data: {
      _id: admin._id,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
    },
  })
})

/** PATCH /admin/profile — update admin name and/or email */
export const updateAdminProfile = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body
  const admin = await User.findById(req.user._id)
  if (!admin || admin.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (fullName) admin.fullName = fullName.trim()
  if (email) {
    const existing = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: admin._id } })
    if (existing) {
      return sendError(res, {
        message: 'Email already in use by another account.',
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'EMAIL_TAKEN',
      })
    }
    admin.email = email.trim().toLowerCase()
  }

  await admin.save()
  return sendSuccess(res, {
    message: 'Profile updated',
    data: { fullName: admin.fullName, email: admin.email },
  })
})

/** PATCH /admin/profile/password — change admin password */
export const changeAdminPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const admin = await User.findById(req.user._id).select('+passwordHash')
  if (!admin || admin.role !== USER_ROLES.ADMIN) {
    return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const ok = await admin.comparePassword(currentPassword)
  if (!ok) {
    return sendError(res, {
      message: 'Current password is incorrect.',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'WRONG_PASSWORD',
    })
  }

  if (newPassword.length < 8) {
    return sendError(res, {
      message: 'New password must be at least 8 characters.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'PASSWORD_TOO_SHORT',
    })
  }

  admin.passwordHash = await bcrypt.hash(newPassword, 12)
  await admin.save()
  return sendSuccess(res, { message: 'Password changed successfully.' })
})

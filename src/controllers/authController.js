import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { USER_ROLES, CORPORATE_STATUS } from '../constants/roles.js'
import { createOtpChallenge, validateOtpChallenge, deleteOtpChallengeDoc } from '../services/otpService.js'
import { signAccessToken } from '../services/tokenService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { populateLabourCategories } from '../utils/populateLabourCategories.js'

function buildAuthPayload(user, token) {
  const safe = user.toSafeObject()
  let flags = {}
  if (user.role === USER_ROLES.CORPORATE && user.corporateProfile) {
    flags = {
      corporateApprovalStatus: user.corporateProfile.status,
    }
  }
  return {
    user: safe,
    token,
    flags,
  }
}

/** POST /auth/register/request-otp */
export const registerRequestOtp = asyncHandler(async (req, res) => {
  const { phone, role } = req.body
  const existing = await User.findOne({ phone })
  if (existing) {
    return sendError(res, {
      message: 'An account with this phone already exists. Please login.',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'USER_EXISTS',
    })
  }
  const { challengeId } = await createOtpChallenge(phone, 'register')
  return sendSuccess(res, {
    message: 'OTP sent to your mobile number',
    data: { phone, role, challengeId },
  })
})

/** POST /auth/register/verify */
export const registerVerify = asyncHandler(async (req, res) => {
  const { phone, code, role, fullName, companyName, gstNumber, businessName, challengeId } = req.body

  const existing = await User.findOne({ phone })
  if (existing) {
    return sendError(res, {
      message: 'Account already registered',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'USER_EXISTS',
    })
  }

  const otp = await validateOtpChallenge({ phone, purpose: 'register', code, challengeId })
  if (!otp.ok) {
    const map = {
      INVALID_CHALLENGE: 'OTP session invalid — request a new OTP',
      NO_OTP: 'Request OTP first',
      EXPIRED: 'OTP expired — request a new one',
      TOO_MANY_ATTEMPTS: 'Too many attempts — request a new OTP',
      INVALID_CODE: 'Invalid OTP',
    }
    return sendError(res, {
      message: map[otp.reason] || 'OTP verification failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: otp.reason,
    })
  }

  const doc = {
    phone,
    role,
    fullName,
    isPhoneVerified: true,
    lastLoginAt: new Date(),
  }

  if (role === USER_ROLES.CORPORATE) {
    doc.corporateProfile = {
      companyName,
      gstNumber: gstNumber || undefined,
      status: CORPORATE_STATUS.PENDING,
    }
  }
  if (role === USER_ROLES.CONTRACTOR) {
    doc.contractorProfile = { businessName, verificationStatus: 'pending' }
  }
  if (role === USER_ROLES.LABOUR) {
    doc.labourProfile = {}
  }

  let user
  try {
    user = await User.create(doc)
  } catch (e) {
    if (e?.code === 11000) {
      return sendError(res, {
        message: 'Account already registered',
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'USER_EXISTS',
      })
    }
    return sendError(res, {
      message: 'Could not create account — try again',
      statusCode: HTTP_STATUS.SERVER_ERROR,
      code: 'REGISTER_FAILED',
    })
  }
  await deleteOtpChallengeDoc(otp.doc)
  const token = signAccessToken(user)
  return sendSuccess(res, {
    message: 'Account created',
    statusCode: HTTP_STATUS.CREATED,
    data: buildAuthPayload(user, token),
  })
})

/** POST /auth/login/request-otp */
export const loginRequestOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body
  const user = await User.findOne({ phone })
  if (!user) {
    return sendError(res, {
      message: 'No account found for this number. Please register.',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'USER_NOT_FOUND',
    })
  }
  if (!user.isActive) {
    return sendError(res, {
      message: 'Account is disabled',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ACCOUNT_DISABLED',
    })
  }
  if (user.role === USER_ROLES.ADMIN) {
    return sendError(res, {
      message: 'Admin accounts must use email login on the admin panel',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'USE_ADMIN_LOGIN',
    })
  }
  const { challengeId } = await createOtpChallenge(phone, 'login')
  return sendSuccess(res, {
    message: 'OTP sent to your mobile number',
    data: { phone, role: user.role, challengeId },
  })
})

/** POST /auth/login/verify */
export const loginVerify = asyncHandler(async (req, res) => {
  const { phone, code, challengeId } = req.body
  const user = await User.findOne({ phone })
  if (!user) {
    return sendError(res, {
      message: 'User not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'USER_NOT_FOUND',
    })
  }

  const otp = await validateOtpChallenge({ phone, purpose: 'login', code, challengeId })
  if (!otp.ok) {
    const map = {
      INVALID_CHALLENGE: 'OTP session invalid — request a new OTP',
      NO_OTP: 'Request OTP first',
      EXPIRED: 'OTP expired — request a new one',
      TOO_MANY_ATTEMPTS: 'Too many attempts — request a new OTP',
      INVALID_CODE: 'Invalid OTP',
    }
    return sendError(res, {
      message: map[otp.reason] || 'OTP verification failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: otp.reason,
    })
  }

  user.isPhoneVerified = true
  user.lastLoginAt = new Date()
  await user.save()
  await deleteOtpChallengeDoc(otp.doc)

  const token = signAccessToken(user)
  return sendSuccess(res, {
    message: 'Login successful',
    data: buildAuthPayload(user, token),
  })
})

/** POST /auth/admin/login — web admin panel */
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email, role: USER_ROLES.ADMIN }).select('+passwordHash')
  if (!user || !user.passwordHash) {
    return sendError(res, {
      message: 'Invalid credentials',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'INVALID_CREDENTIALS',
    })
  }
  const ok = await user.comparePassword(password)
  if (!ok) {
    return sendError(res, {
      message: 'Invalid credentials',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'INVALID_CREDENTIALS',
    })
  }
  if (!user.isActive) {
    return sendError(res, {
      message: 'Account disabled',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ACCOUNT_DISABLED',
    })
  }
  user.lastLoginAt = new Date()
  await user.save()
  const token = signAccessToken(user)
  return sendSuccess(res, {
    message: 'Admin login successful',
    data: buildAuthPayload(user, token),
  })
})

/** GET /auth/me */
export const getMe = asyncHandler(async (req, res) => {
  await populateLabourCategories(req.user)
  return sendSuccess(res, { data: { user: req.user.toSafeObject() } })
})

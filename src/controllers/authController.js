import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { USER_ROLES, CORPORATE_STATUS } from '../constants/roles.js'
import { HARDCODED_TEST_ACCOUNTS } from '../utils/phone.js'
import { ensureHardcodedTestUser } from '../services/hardcodedTestUsersService.js'
import { createOtpChallenge, validateOtpChallenge, deleteOtpChallengeDoc } from '../services/otpService.js'
import { signAccessToken } from '../services/tokenService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { populateLabourCategories } from '../utils/populateLabourCategories.js'
import { attachReferral, ensureReferralCode } from '../services/referralService.js'

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

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

/** POST /auth/register/request-otp */
export const registerRequestOtp = asyncHandler(async (req, res) => {
  const { phone, role, scope, gstNumber } = req.body
  const cleanGst = gstNumber ? String(gstNumber).trim().toUpperCase() : undefined
  if (cleanGst && !GST_RE.test(cleanGst)) {
    return sendError(res, {
      message: 'Please enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5) or leave it blank.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_GSTIN',
    })
  }

  const existing = await User.findOne({ phone })
  if (existing) {
    const b2bRoles = [USER_ROLES.CORPORATE, USER_ROLES.CONTRACTOR]
    const isExistingB2B = b2bRoles.includes(existing.role)
    const isRegisteringB2B = b2bRoles.includes(role) || scope === 'b2b'

    if (isRegisteringB2B && !isExistingB2B) {
      return sendError(res, {
        message: 'This mobile number is already registered as a Personal account. Please use your business mobile number.',
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'ROLE_MISMATCH',
      })
    }
    if (!isRegisteringB2B && isExistingB2B) {
      return sendError(res, {
        message: 'This mobile number is already registered as a Business account. Please use your personal mobile number.',
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'ROLE_MISMATCH',
      })
    }

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
  const {
    phone,
    code,
    role,
    fullName,
    companyName,
    gstNumber,
    businessName,
    challengeId,
    referralCode,
  } = req.body

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

  const cleanGst = gstNumber ? String(gstNumber).trim().toUpperCase() : undefined
  if (cleanGst && !GST_RE.test(cleanGst)) {
    return sendError(res, {
      message: 'Please enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5) or leave it blank.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_GSTIN',
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
      gstNumber: cleanGst || undefined,
      status: CORPORATE_STATUS.PENDING,
    }
  }
  if (role === USER_ROLES.CONTRACTOR) {
    doc.contractorProfile = {
      businessName,
      gstNumber: cleanGst || undefined,
      verificationStatus: 'pending',
    }
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

  // Refer & Earn. Never let this break a signup that already succeeded.
  let referral = { attached: false, reason: 'NO_CODE' }
  try {
    await ensureReferralCode(user)
    if (referralCode) {
      referral = await attachReferral({ refereeUser: user, code: referralCode })
    }
  } catch (err) {
    console.error('[referral] attach on signup failed:', err?.message || err)
  }

  const token = signAccessToken(user)
  return sendSuccess(res, {
    message: 'Account created',
    statusCode: HTTP_STATUS.CREATED,
    data: {
      ...buildAuthPayload(user, token),
      referral: { applied: Boolean(referral.attached), reason: referral.reason },
    },
  })
})

/** POST /auth/login/request-otp */
export const loginRequestOtp = asyncHandler(async (req, res) => {
  const { phone, scope } = req.body
  let user = await User.findOne({ phone })
  if (HARDCODED_TEST_ACCOUNTS[phone]) {
    user = await ensureHardcodedTestUser(phone)
  }
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

  const b2bRoles = [USER_ROLES.CORPORATE, USER_ROLES.CONTRACTOR]
  const b2cRoles = [USER_ROLES.INDIVIDUAL, USER_ROLES.LABOUR]

  if (scope === 'b2b' && !b2bRoles.includes(user.role)) {
    return sendError(res, {
      message: 'This mobile number is already registered as a Personal account. Please sign in with your business mobile number.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ROLE_MISMATCH',
    })
  }
  if (scope === 'b2c' && !b2cRoles.includes(user.role)) {
    return sendError(res, {
      message: 'This mobile number is already registered as a Business account. Please sign in with your personal mobile number.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ROLE_MISMATCH',
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
  const { phone, code, challengeId, scope } = req.body
  let user = await User.findOne({ phone })
  if (HARDCODED_TEST_ACCOUNTS[phone]) {
    user = await ensureHardcodedTestUser(phone)
  }
  if (!user) {
    return sendError(res, {
      message: 'User not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'USER_NOT_FOUND',
    })
  }

  const b2bRoles = [USER_ROLES.CORPORATE, USER_ROLES.CONTRACTOR]
  const b2cRoles = [USER_ROLES.INDIVIDUAL, USER_ROLES.LABOUR]

  if (scope === 'b2b' && !b2bRoles.includes(user.role)) {
    return sendError(res, {
      message: 'This mobile number is already registered as a Personal account. Please sign in with your business mobile number.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ROLE_MISMATCH',
    })
  }
  if (scope === 'b2c' && !b2cRoles.includes(user.role)) {
    return sendError(res, {
      message: 'This mobile number is already registered as a Business account. Please sign in with your personal mobile number.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ROLE_MISMATCH',
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

/** POST /auth/logout */
export const logout = asyncHandler(async (req, res) => {
  // Currently JWT is stateless, so we just return success.
  // In the future, we could invalidate the token here (e.g., blocklist).
  return sendSuccess(res, { message: 'Logged out successfully' })
})

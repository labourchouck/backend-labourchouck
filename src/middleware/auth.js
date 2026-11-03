import { verifyAccessToken } from '../services/tokenService.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError } from '../utils/apiResponse.js'
import { KYC_STATUS, USER_ROLES } from '../constants/roles.js'

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    console.log(`[Auth Error] Missing or invalid header. Request URL: ${req.originalUrl}, Header: ${header}`)
    return sendError(res, {
      message: 'Authentication required',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'UNAUTHORIZED',
    })
  }
  const token = header.slice(7)
  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    return sendError(res, {
      message: 'Invalid or expired token',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'INVALID_TOKEN',
    })
  }

  const user = await User.findById(payload.sub)
  if (!user || !user.isActive) {
    return sendError(res, {
      message: 'User not found or inactive',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'UNAUTHORIZED',
    })
  }

  req.user = user
  req.tokenPayload = payload
  next()
})

export function restrictTo(...roles) {
  const lowerRoles = roles.map(r => String(r).toLowerCase())
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, {
        message: 'Authentication required',
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: 'UNAUTHORIZED',
      })
    }

    if (!lowerRoles.includes(String(req.user.role).toLowerCase())) {
      return sendError(res, {
        message: 'You do not have permission for this action',
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: 'FORBIDDEN',
      })
    }
    next()
  }
}

/** A labour worker only takes part in jobs once the admin has approved their KYC. Other roles are not affected. */
export const isLabourKycApproved = (user) =>
  String(user?.role).toLowerCase() !== USER_ROLES.LABOUR || user?.labourProfile?.kycStatus === KYC_STATUS.VERIFIED

/** Route guard: labour without approved KYC cannot see or act on broadcasts, assignments or jobs. */
export function requireLabourKyc(req, res, next) {
  if (isLabourKycApproved(req.user)) return next()
  console.log(`[KYC] blocked ${req.method} ${req.originalUrl} for labour ${req.user?._id} (kycStatus=${req.user?.labourProfile?.kycStatus || 'pending'})`)
  return sendError(res, {
    message: 'Complete your KYC and wait for admin approval to receive and accept jobs.',
    statusCode: HTTP_STATUS.FORBIDDEN,
    code: 'KYC_REQUIRED',
  })
}

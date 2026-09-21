import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'
import {
  findReferrerByCode,
  getReferralConfig,
  getReferralOverview,
} from '../services/referralService.js'

/** GET /referrals/me — code, share copy, stats and the caller's referral list. */
export const getMyReferrals = asyncHandler(async (req, res) => {
  const overview = await getReferralOverview(req.user)
  return sendSuccess(res, { data: overview })
})

/**
 * POST /referrals/validate — public. Lets the signup screen tell the user
 * whose code they are about to use before they burn an OTP on it.
 */
export const validateReferralCode = asyncHandler(async (req, res) => {
  const config = await getReferralConfig()
  if (!config.isActive) {
    return sendSuccess(res, { data: { valid: false, reason: 'REFERRALS_DISABLED' } })
  }

  const referrer = await findReferrerByCode(req.body?.code)
  if (!referrer) {
    return sendSuccess(res, { data: { valid: false, reason: 'INVALID_CODE' } })
  }

  return sendSuccess(res, {
    data: {
      valid: true,
      referrerName: referrer.fullName || 'a LaborChowck user',
      refereeReward: config.refereeReward,
    },
  })
})

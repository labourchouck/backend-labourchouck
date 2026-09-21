import { Router } from 'express'
import { body } from 'express-validator'
import { protect } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import * as referral from '../controllers/referralController.js'

const router = Router()

// Public: checked from the signup screen before the user has a token.
router.post(
  '/validate',
  [body('code').trim().notEmpty().withMessage('Referral code is required')],
  validateRequest,
  referral.validateReferralCode,
)

router.get('/me', protect, referral.getMyReferrals)

export default router

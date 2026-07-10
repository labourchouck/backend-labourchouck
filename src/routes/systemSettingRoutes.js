import { Router } from 'express'
import { body } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as settings from '../controllers/systemSettingController.js'

const router = Router()

// Only Admins can manage System Settings
router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/', settings.getSystemSettings)

router.patch(
  '/platform-fees',
  [
    body('type').optional().isIn(['fixed', 'percentage']),
    body('value').optional().isNumeric(),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  settings.updatePlatformFees,
)

router.patch(
  '/commission',
  [
    body('type').optional().isIn(['global', 'category', 'service']),
    body('globalPercentage').optional().isNumeric(),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  settings.updateCommission,
)

router.patch(
  '/wallet-limit',
  [
    body('walletLimit').isNumeric().withMessage('Wallet limit is required'),
  ],
  validateRequest,
  settings.updateWalletLimit,
)

router.patch(
  '/gst',
  [
    body('gstPercentage').isNumeric().withMessage('GST percentage is required'),
  ],
  validateRequest,
  settings.updateGstPercentage,
)

router.patch(
  '/penalty',
  [
    body('cancellationPenalty').isNumeric().withMessage('Cancellation penalty is required'),
  ],
  validateRequest,
  settings.updateCancellationPenalty,
)

export default router

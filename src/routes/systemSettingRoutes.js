import { Router } from 'express'
import { body } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as settings from '../controllers/systemSettingController.js'

const router = Router()

// Public route — returns only the time slots (no auth required)
router.get('/public', async (req, res) => {
  try {
    const { SystemSetting } = await import('../models/SystemSetting.js')
    const { sendSuccess } = await import('../utils/apiResponse.js')
    let settings = await SystemSetting.findOne({ configKey: 'master_config' })
    const timeSlots = settings?.timeSlots || ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM']
    return sendSuccess(res, { data: { timeSlots } })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Could not load time slots' })
  }
})

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

router.patch(
  '/time-slots',
  [
    body('timeSlots').isArray({ min: 1 }).withMessage('timeSlots must be a non-empty array'),
    body('timeSlots.*').isString().trim().notEmpty().withMessage('Each time slot must be a non-empty string'),
  ],
  validateRequest,
  settings.updateTimeSlots,
)

export default router

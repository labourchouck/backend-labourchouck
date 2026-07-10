import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as zoneController from '../controllers/zoneController.js'

const router = Router()

// Only LABOUR/CONTRACTOR can update their location via this route
router.post(
  '/update',
  protect,
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  zoneController.updateLabourLocation
)

router.post(
  '/status',
  protect,
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  zoneController.updateLabourStatus
)

export default router

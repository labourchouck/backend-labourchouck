import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as broadcast from '../controllers/broadcastController.js'

const router = Router()

router.use(protect)

// Only Labourers/Contractors can interact with broadcasts directly
router.post(
  '/:logId/accept',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  broadcast.acceptBroadcast,
)

router.post(
  '/:logId/reject',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  broadcast.rejectBroadcast,
)

export default router

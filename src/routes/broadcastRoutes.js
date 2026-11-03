import { Router } from 'express'
import { protect, restrictTo, requireLabourKyc } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as broadcast from '../controllers/broadcastController.js'

const router = Router()

router.use(protect)

// Only Labourers/Contractors can interact with broadcasts directly
router.get('/pending', restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR), requireLabourKyc, broadcast.getPendingBroadcasts)

router.post(
  '/:bookingId/accept',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  requireLabourKyc,
  broadcast.acceptBroadcast,
)

router.post(
  '/:bookingId/reject',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  requireLabourKyc,
  broadcast.rejectBroadcast,
)

export default router

import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as adminReferral from '../controllers/adminReferralController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/', adminReferral.listReferrals)

router.patch(
  '/:id/reject',
  [param('id').isMongoId(), body('note').optional().isString()],
  validateRequest,
  adminReferral.rejectReferral,
)

export default router

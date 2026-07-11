import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as adminWallet from '../controllers/adminWalletController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/withdrawals', adminWallet.getAllWithdrawalRequests)

router.patch(
  '/withdrawals/:id',
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED'),
    body('adminRemarks').optional().isString(),
  ],
  validateRequest,
  adminWallet.processWithdrawalRequest,
)

export default router

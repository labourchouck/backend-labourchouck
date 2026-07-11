import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as adminComplaint from '../controllers/adminComplaintController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/', adminComplaint.getAllComplaints)

router.patch(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid complaint id'),
    body('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).withMessage('Invalid status'),
    body('adminRemarks').optional().isString(),
  ],
  validateRequest,
  adminComplaint.updateComplaintStatus,
)

export default router

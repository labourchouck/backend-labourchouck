import { Router } from 'express'
import { body } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as adminProfile from '../controllers/adminProfileController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

// GET /admin/profile
router.get('/', adminProfile.getAdminProfile)

// PATCH /admin/profile — update name / email
router.patch(
  '/',
  [
    body('fullName').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2–120 characters'),
    body('email').optional().trim().isEmail().withMessage('Invalid email address'),
  ],
  validateRequest,
  adminProfile.updateAdminProfile,
)

// PATCH /admin/profile/password — change password
router.patch(
  '/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  validateRequest,
  adminProfile.changeAdminPassword,
)

export default router

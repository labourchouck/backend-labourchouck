import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import * as user from '../controllers/userController.js'
import { USER_ROLES } from '../constants/roles.js'
import { validateUserIdParam } from '../validators/authValidators.js'

const router = Router()

router.get(
  '/discover/labours',
  [
    query('groupId').optional().isMongoId().withMessage('groupId must be a valid id'),
    query('categoryId').optional().isMongoId().withMessage('categoryId must be a valid id'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1–50'),
  ],
  validateRequest,
  user.listDiscoverLabours,
)

router.get(
  '/discover/labours/:id',
  [param('id').isMongoId().withMessage('Invalid user id')],
  validateRequest,
  user.getDiscoverLabour,
)

router.use(protect)

router.get('/me', user.getProfile)
router.delete('/me', user.deleteMe)
router.patch(
  '/me',
  [
    body('fullName').optional().trim().isLength({ min: 2, max: 120 }),
    body('phone').optional().trim().matches(/^\d{10}$/).withMessage('Enter a valid 10-digit phone number'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Enter a valid email address'),
    body('labourProfile.skills').optional().isArray(),
    body('labourProfile.skills.*').optional().trim().isLength({ min: 1, max: 64 }),
  ],
  validateRequest,
  user.updateMe,
)

router.patch(
  '/me/labour-categories',
  [
    body('services').isArray({ min: 1 }).withMessage('Select at least one category'),
    body('services.*.serviceId').isMongoId().withMessage('Invalid service ID'),
    body('services.*.subcategoryId').optional().isMongoId(),
    body('services.*.minPrice').optional().isNumeric(),
    body('services.*.maxPrice').optional().isNumeric(),
  ],
  validateRequest,
  user.updateLabourCategories,
)

router.patch(
  '/me/labour/schedule',
  restrictTo(USER_ROLES.LABOUR),
  [
    body('schedule').isArray({ min: 7, max: 7 }).withMessage('Schedule must contain exactly 7 days'),
    body('schedule.*.day').isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).withMessage('Invalid day'),
    body('schedule.*.startTime').isString().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid start time format (HH:mm)'),
    body('schedule.*.endTime').isString().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid end time format (HH:mm)'),
    body('schedule.*.isAvailable').isBoolean().withMessage('isAvailable must be boolean'),
  ],
  validateRequest,
  user.updateLabourSchedule,
)

router.post(
  '/me/labour/kyc/submit',
  restrictTo(USER_ROLES.LABOUR),
  [
    body('aadhaar').optional({ values: 'falsy' }).isString().trim(),
    body('pan').optional({ values: 'falsy' }).isString().trim(),
    body('videoUrl')
      .isString()
      .trim()
      .isURL({ protocols: ['https'], require_protocol: true })
      .withMessage('KYC video URL is required'),
    body('videoMeta').optional().isObject().withMessage('videoMeta must be an object'),
  ],
  validateRequest,
  user.submitLabourKycDocuments,
)


router.get('/', restrictTo(USER_ROLES.ADMIN), user.listUsers)

router.patch(
  '/:id/labour-kyc-review',
  restrictTo(USER_ROLES.ADMIN),
  validateUserIdParam,
  [
    body('decision').isIn(['approved', 'rejected']).withMessage('decision must be approved or rejected'),
    body('note').optional().trim().isLength({ max: 500 }),
  ],
  validateRequest,
  user.reviewLabourKyc,
)

router.get('/:id', restrictTo(USER_ROLES.ADMIN), validateUserIdParam, validateRequest, user.getUserById)

router.delete('/:id', restrictTo(USER_ROLES.ADMIN), validateUserIdParam, validateRequest, user.deleteUser)

export default router

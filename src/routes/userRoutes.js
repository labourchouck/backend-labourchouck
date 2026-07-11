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
router.patch(
  '/me',
  [
    body('fullName').optional().trim().isLength({ min: 2, max: 120 }),
    body('labourProfile.skills').optional().isArray(),
    body('labourProfile.skills.*').optional().trim().isLength({ min: 1, max: 64 }),
  ],
  validateRequest,
  user.updateMe,
)

router.patch(
  '/me/labour-categories',
  [body('categoryIds').isArray({ min: 1 }).withMessage('Select at least one category'), body('categoryIds.*').isMongoId()],
  validateRequest,
  user.updateLabourCategories,
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

export default router

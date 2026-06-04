import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import { LABOUR_GROUP_KIND } from '../models/LabourCategoryGroup.js'
import * as admin from '../controllers/adminLabourCategoryController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/labour-category-groups', admin.listAllGroups)

router.post(
  '/labour-category-groups',
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('slug').optional().trim(),
    body('description').optional().trim(),
    body('helperText').optional().trim(),
    body('kind').optional().isIn(Object.values(LABOUR_GROUP_KIND)),
    body('sortOrder').optional().isInt({ min: 0, max: 9999 }),
    body('imageUrl').optional().isString(),
  ],
  validateRequest,
  admin.createGroup,
)

router.patch(
  '/labour-category-groups/:id',
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('imageUrl').optional().isString(),
  ],
  validateRequest,
  admin.patchGroup,
)

router.post(
  '/labour-categories',
  [
    body('groupId').isMongoId().withMessage('Valid group required'),
    body('name').trim().notEmpty().withMessage('Name required'),
    body('subtitle').optional().trim(),
    body('imageUrl').optional().isString(),
    body('sortOrder').optional().isInt({ min: 0, max: 9999 }),
  ],
  validateRequest,
  admin.createCategory,
)

router.patch(
  '/labour-categories/:id',
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('imageUrl').optional().isString(),
  ],
  validateRequest,
  admin.patchCategory,
)

export default router

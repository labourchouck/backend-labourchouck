import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as adminBanner from '../controllers/adminBannerController.js'
import { uploadMediaMulter, handleMulterError } from '../middleware/uploadMiddleware.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

// Wrapper to handle multer parsing for image upload
const uploadImage = (req, res, next) => {
  uploadMediaMulter(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next)
    next()
  })
}

router.post(
  '/',
  uploadImage,
  [
    body('targetUrl').optional().trim(),
    body('isActive').optional().isBoolean(),
    body('sortOrder').optional().isInt(),
  ],
  validateRequest,
  adminBanner.createBanner,
)

router.get('/', adminBanner.getAllBanners)

router.patch(
  '/:id',
  uploadImage,
  [
    param('id').isMongoId().withMessage('Invalid banner id'),
    body('targetUrl').optional().trim(),
    body('isActive').optional().isBoolean(),
    body('sortOrder').optional().isInt(),
  ],
  validateRequest,
  adminBanner.updateBanner,
)

router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid banner id')],
  validateRequest,
  adminBanner.deleteBanner,
)

export default router

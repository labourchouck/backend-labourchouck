import { Router } from 'express'
import { param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { uploadMediaMulter, handleMulterError } from '../middleware/uploadMiddleware.js'
import { USER_ROLES } from '../constants/roles.js'
import * as adminBanner from '../controllers/adminBannerController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

/** Banner images arrive as multipart under the field name `file`. */
function acceptBannerImage(req, res, next) {
  uploadMediaMulter(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next)
    next()
  })
}

router.get('/', adminBanner.getAllBanners)

router.post('/', acceptBannerImage, adminBanner.createBanner)

router.patch(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid banner id')],
  validateRequest,
  acceptBannerImage,
  adminBanner.updateBanner,
)

router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid banner id')],
  validateRequest,
  adminBanner.deleteBanner,
)

export default router;
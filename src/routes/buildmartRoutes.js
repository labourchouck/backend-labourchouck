import { Router } from 'express'
import { submitQuoteRequest } from '../controllers/buildmartController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { submitQuoteValidators } from '../validators/buildmartValidators.js'
import { APP_ROLES } from '../constants/roles.js'

const router = Router()

router.post(
  '/quotes',
  protect,
  restrictTo(...APP_ROLES),
  submitQuoteValidators,
  validateRequest,
  submitQuoteRequest,
)

export default router

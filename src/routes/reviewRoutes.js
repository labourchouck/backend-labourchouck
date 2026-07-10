import { Router } from 'express'
import { body } from 'express-validator'
import { protect } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import * as review from '../controllers/reviewController.js'

const router = Router()

router.use(protect)

router.post(
  '/',
  [
    body('bookingId').isMongoId().withMessage('bookingId is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().isString()
  ],
  validateRequest,
  review.submitReview,
)

router.get('/user/:userId', review.getReviews)

export default router

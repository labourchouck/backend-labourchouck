import { Router } from 'express'
import { body } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as booking from '../controllers/bookingController.js'

const router = Router()

router.use(protect)

router.post(
  '/calculate',
  [
    body('serviceId').isMongoId().withMessage('Valid service ID required'),
  ],
  validateRequest,
  booking.calculateBill,
)

router.post(
  '/',
  [
    body('serviceId').isMongoId().withMessage('Valid service ID required'),
    body('type').isIn(['INSTANT', 'SCHEDULED']).withMessage('Invalid booking type'),
    body('locationText').trim().notEmpty().withMessage('Location is required'),
    body('paymentMethod').isIn(['ONLINE', 'CASH']).withMessage('Invalid payment method'),
  ],
  validateRequest,
  booking.createBooking,
)

router.get('/me', booking.getMyBookings)
router.get('/:id', booking.getBookingStatus)

router.patch(
  '/:id/status',
  [
    body('status').isIn(['EN_ROUTE', 'STARTED', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status'),
  ],
  validateRequest,
  booking.updateBookingStatus,
)

export default router

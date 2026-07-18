import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import * as adminBookingController from '../controllers/adminBookingController.js'
import { USER_ROLES } from '../constants/roles.js'

const router = Router()

// All admin booking routes require admin authentication
router.use(protect, restrictTo(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN))

router.route('/')
  .get(adminBookingController.getAllBookings)
  .post(adminBookingController.createBookingAdmin)

router.route('/:id')
  .get(adminBookingController.getBookingDetails)
  .put(adminBookingController.updateBookingAdmin)
  .delete(adminBookingController.deleteBookingAdmin)

router.route('/:id/status')
  .patch(adminBookingController.updateBookingStatusAdmin)

router.route('/:id/assign')
  .patch(adminBookingController.assignLabourerManually)

export default router

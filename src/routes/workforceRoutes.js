import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES, APP_ROLES } from '../constants/roles.js'
import {
  createRequest,
  listMyRequests,
  getRequest,
  mockPayRequest
} from '../controllers/requestController.js'
import {
  listLabourAssignments,
  respondToAssignment,
} from '../controllers/allocationController.js'
import {
  checkIn,
  checkOut,
  listAttendance,
  markAttendanceVendor,
} from '../controllers/attendanceController.js'

const router = Router()

router.use(protect)

router.post('/requests', restrictTo(USER_ROLES.INDIVIDUAL, USER_ROLES.CORPORATE, USER_ROLES.ADMIN, 'super_admin'), createRequest)
router.get('/requests', restrictTo(...APP_ROLES, USER_ROLES.ADMIN, 'super_admin'), listMyRequests)
router.get('/requests/:id', restrictTo(...APP_ROLES, USER_ROLES.ADMIN), getRequest)
router.post('/requests/:id/mock-pay', restrictTo(USER_ROLES.CORPORATE, USER_ROLES.ADMIN, 'super_admin'), mockPayRequest)

router.get('/assignments', restrictTo(USER_ROLES.LABOUR), listLabourAssignments)
router.patch('/assignments/:id/respond', restrictTo(USER_ROLES.LABOUR), respondToAssignment)


router.get('/attendance', restrictTo(...APP_ROLES, USER_ROLES.ADMIN), listAttendance)
router.post('/attendance/vendor-mark', restrictTo(USER_ROLES.CONTRACTOR), markAttendanceVendor)

export default router

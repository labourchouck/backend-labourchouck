import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import { listVendorsAndCrew } from '../controllers/adminVendorController.js'

const router = Router()

// Only ADMIN can access these routes
router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/crew', listVendorsAndCrew)

export default router

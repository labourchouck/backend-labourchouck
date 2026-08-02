import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import { listVendorsAndCrew, updateVendorCrewVerification, deleteVendorCrew, getVendorCrewById } from '../controllers/adminVendorController.js'

const router = Router()

// Only ADMIN can access these routes
router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/crew', listVendorsAndCrew)
router.get('/crew-labour/:id', getVendorCrewById)
router.patch('/crew-labour/:id/verification', updateVendorCrewVerification)
router.delete('/crew-labour/:id', deleteVendorCrew)

export default router

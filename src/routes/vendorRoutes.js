import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getVendorMe,
  patchVendorMe,
  addVendorDocument,
  submitVendorVerification,
  removeVendorDocument,
  listVendorCrew,
  linkVendorCrew,
  getVendorDashboard,
  listVendorJobs,
  acceptVendorJob,
  listVendorSettlements,
} from '../controllers/vendorController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.CONTRACTOR))

router.get('/me', getVendorMe)
router.patch('/me', patchVendorMe)
router.post('/documents', addVendorDocument)
router.delete('/documents/:docId', removeVendorDocument)
router.post('/verification/submit', submitVendorVerification)
router.get('/dashboard', getVendorDashboard)
router.get('/crew', listVendorCrew)
router.post('/crew/link', linkVendorCrew)
router.get('/jobs', listVendorJobs)
router.post('/jobs/:id/accept', acceptVendorJob)
router.get('/settlements', listVendorSettlements)

export default router

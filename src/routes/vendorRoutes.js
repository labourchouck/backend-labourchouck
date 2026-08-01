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
  verifyLinkVendorCrewOtp,
  unlinkVendorCrew,
  getVendorDashboard,
  listVendorJobs,
  getVendorJob,
  acceptVendorJob,
  rejectVendorJob,
  getVendorAnalytics,
  listVendorWithdrawals,
  requestVendorWithdrawal,
  listVendorSettlements,
  getVendorDirectRequests,
  assignVendorCrew,
  replaceVendorCrew,
  toggleAcceptingRequests,
  getVendorBanners,
  getSubscriptionPlans,
  subscribeToPlan,
} from '../controllers/vendorController.js'
import {
  requestOtp,
  verifyOtp,
  createCrewLabour,
  getAllCrewLabour,
  getCrewLabourById,
  updateCrewLabour,
  patchCrewLabour,
  deleteCrewLabour
} from '../controllers/vendorCrewLabourController.js'

const router = Router()

router.use(protect)

router.get('/subscriptions/plans', getSubscriptionPlans)
router.post('/subscriptions/subscribe', subscribeToPlan)

router.use(restrictTo(USER_ROLES.CONTRACTOR, USER_ROLES.ADMIN))

router.get('/me', getVendorMe)
router.patch('/me', patchVendorMe)
router.post('/documents', addVendorDocument)
router.delete('/documents/:docId', removeVendorDocument)
router.post('/verification/submit', submitVendorVerification)
router.get('/dashboard', getVendorDashboard)

// Original link crew routes (deprecated/unused by frontend now, or could be kept if needed for other places)
router.get('/crew', listVendorCrew)
router.post('/crew/link', linkVendorCrew)
router.post('/crew/link/verify', verifyLinkVendorCrewOtp)
router.delete('/crew/:workerId', unlinkVendorCrew)

// New Vendor Crew Labour CRUD routes
router.post('/crew-labour/request-otp', requestOtp)
router.post('/crew-labour/verify-otp', verifyOtp)
router.post('/crew-labour', createCrewLabour)
router.get('/crew-labour', getAllCrewLabour)
router.get('/crew-labour/:id', getCrewLabourById)
router.put('/crew-labour/:id', updateCrewLabour)
router.patch('/crew-labour/:id', patchCrewLabour)
router.delete('/crew-labour/:id', deleteCrewLabour)

router.get('/jobs', listVendorJobs)
router.get('/jobs/:id', getVendorJob)
router.post('/jobs/:id/accept', acceptVendorJob)
router.post('/jobs/:id/assign-crew', assignVendorCrew)
router.post('/jobs/:id/replace-crew', replaceVendorCrew)
router.patch('/toggle-availability', toggleAcceptingRequests)
router.get('/direct-requests', getVendorDirectRequests)
router.post('/jobs/:id/reject', rejectVendorJob)
router.get('/analytics', getVendorAnalytics)
router.get('/withdrawals', listVendorWithdrawals)
router.post('/withdrawals/request', requestVendorWithdrawal)
router.get('/settlements', listVendorSettlements)
router.get('/banners', getVendorBanners)


export default router

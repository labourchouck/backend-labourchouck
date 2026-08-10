import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getCorporateMe,
  patchCorporateMe,
  addCorporateDocument,
  submitCorporateVerification,
  removeCorporateDocument,
  getCorporateDashboard,
  listCorporateInvoices,
  getCorporateAnalytics,
  getCorporateTransactions,
  createCorporateComplaint,
  listCorporateComplaints,
  rateCorporateAssignment,
  getCorporateVendorAttendance,
  toggleCorporateAttendance,
  searchVendors,
  listCorporateVendors,
  getCorporateBanners,
  listCorporateProjects,
  createCorporateProject,
  getCorporateProject,
  addProjectSite,
} from '../controllers/corporateController.js'

import {
  getCorporatePlans,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getMySubscription
} from '../controllers/userSubscriptionController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.CORPORATE, USER_ROLES.ADMIN, 'super_admin'))

router.get('/me', getCorporateMe)
router.patch('/me', patchCorporateMe)
router.post('/documents', addCorporateDocument)
router.delete('/documents/:docId', removeCorporateDocument)
router.post('/verification/submit', submitCorporateVerification)
router.get('/dashboard', getCorporateDashboard)
router.get('/banners', getCorporateBanners)
router.get('/vendor-attendance', getCorporateVendorAttendance)
router.get('/attendance', getCorporateVendorAttendance)
router.post('/attendance/toggle', toggleCorporateAttendance)
router.get('/vendors', listCorporateVendors)
router.get('/invoices', listCorporateInvoices)
router.get('/analytics', getCorporateAnalytics)
router.get('/transactions', getCorporateTransactions)
router.post('/complaints', createCorporateComplaint)
router.get('/complaints', listCorporateComplaints)
router.post('/assignments/:assignmentId/rate', rateCorporateAssignment)
router.post('/vendors/search', searchVendors)

router.get('/projects', listCorporateProjects)
router.post('/projects', createCorporateProject)
router.get('/projects/:id', getCorporateProject)
router.post('/projects/:projectId/sites', addProjectSite)

// Subscription Routes
router.get('/subscription/plans', getCorporatePlans)
router.get('/subscription/my-subscription', getMySubscription)
router.post('/subscription/order', createRazorpayOrder)
router.post('/subscription/verify', verifyRazorpayPayment)

export default router

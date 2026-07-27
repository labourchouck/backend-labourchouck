import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getCorporateMe,
  patchCorporateMe,
  addCorporateDocument,
  submitCorporateVerification,
  removeCorporateDocument,
  listCorporateProjects,
  createCorporateProject,
  getCorporateProject,
  addCorporateSite,
  getCorporateDashboard,
  listCorporateInvoices,
  getCorporateAnalytics,
  getCorporateTransactions,
  createCorporateComplaint,
  listCorporateComplaints,
  rateCorporateAssignment,
  getCorporateVendorAttendance,
  searchVendors,
  listCorporateVendors,
  getCorporateBanners,
} from '../controllers/corporateController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.CORPORATE))

router.get('/me', getCorporateMe)
router.patch('/me', patchCorporateMe)
router.post('/documents', addCorporateDocument)
router.delete('/documents/:docId', removeCorporateDocument)
router.post('/verification/submit', submitCorporateVerification)
router.get('/dashboard', getCorporateDashboard)
router.get('/banners', getCorporateBanners)
router.get('/vendor-attendance', getCorporateVendorAttendance)
router.get('/vendors', listCorporateVendors)
router.get('/projects', listCorporateProjects)
router.post('/projects', createCorporateProject)
router.get('/projects/:id', getCorporateProject)
router.post('/projects/:projectId/sites', addCorporateSite)
router.get('/invoices', listCorporateInvoices)
router.get('/analytics', getCorporateAnalytics)
router.get('/transactions', getCorporateTransactions)
router.post('/complaints', createCorporateComplaint)
router.get('/complaints', listCorporateComplaints)
router.post('/assignments/:assignmentId/rate', rateCorporateAssignment)
router.post('/vendors/search', searchVendors)

export default router

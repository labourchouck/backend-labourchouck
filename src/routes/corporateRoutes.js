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
} from '../controllers/corporateController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.CORPORATE))

router.get('/me', getCorporateMe)
router.patch('/me', patchCorporateMe)
router.post('/documents', addCorporateDocument)
router.delete('/documents/:docId', removeCorporateDocument)
router.post('/verification/submit', submitCorporateVerification)
router.get('/dashboard', getCorporateDashboard)
router.get('/projects', listCorporateProjects)
router.post('/projects', createCorporateProject)
router.get('/projects/:id', getCorporateProject)
router.post('/projects/:projectId/sites', addCorporateSite)
router.get('/invoices', listCorporateInvoices)

export default router

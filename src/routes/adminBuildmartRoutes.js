import { Router } from 'express'
import {
  listLeadsAdmin,
  updateLeadStatusAdmin,
} from '../controllers/buildmartController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'

const ADMIN_ROLES = [USER_ROLES.ADMIN]

const router = Router()

// All routes here are mounted at /admin/buildmart

router.use(protect, restrictTo(...ADMIN_ROLES))

router.get('/leads', listLeadsAdmin)
router.patch('/leads/:id', updateLeadStatusAdmin)

export default router

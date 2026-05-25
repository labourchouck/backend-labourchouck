import { Router } from 'express'
import { body } from 'express-validator'
import { listLeadsAdmin, updateLeadStatusAdmin } from '../controllers/buildmartController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/buildmart/leads', listLeadsAdmin)
router.patch(
  '/buildmart/leads/:id',
  [body('status').isIn(['new', 'contacted', 'quoted', 'won', 'lost'])],
  validateRequest,
  updateLeadStatusAdmin,
)

export default router

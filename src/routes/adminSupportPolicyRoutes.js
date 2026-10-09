import { Router } from 'express'
import { getSupportPolicies, updateSupportPolicy } from '../controllers/adminSupportPolicyController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'

const router = Router()

router.use(protect)
router.use(restrictTo(USER_ROLES.ADMIN))

router.get('/', getSupportPolicies)
router.put('/:role', updateSupportPolicy)

export default router

import express from 'express'
import { getPrivacyPolicies, updatePrivacyPolicy } from '../controllers/adminPrivacyPolicyController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'

const router = express.Router()

router.use(protect)
router.use(restrictTo(USER_ROLES.ADMIN))

router.get('/', getPrivacyPolicies)
router.put('/:role', updatePrivacyPolicy)

export default router

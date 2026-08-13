import { Router } from 'express'
import { getTerms, updateTerms } from '../controllers/adminTermsController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'

const router = Router()

router.use(protect)
router.use(restrictTo(USER_ROLES.ADMIN))

router.route('/')
  .get(getTerms)

router.route('/:role')
  .put(updateTerms)

export default router

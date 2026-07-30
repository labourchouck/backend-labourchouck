import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getIndividualPlans,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getMySubscription
} from '../controllers/userSubscriptionController.js'

const router = Router()

router.get('/plans', getIndividualPlans)

router.use(protect)

// Assuming INDIVIDUAL role, but maybe others can purchase too, let's just restrict to INDIVIDUAL
router.use(restrictTo(USER_ROLES.INDIVIDUAL))

router.get('/my-subscription', getMySubscription)
router.post('/order', createRazorpayOrder)
router.post('/verify', verifyRazorpayPayment)

export default router

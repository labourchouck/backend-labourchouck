import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  createSubscriptionPlan,
  getSubscriptionPlans,
  getSubscriptionPlanById,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getVendorSubscriptions,
  getUserSubscriptions,
  getCorporateSubscriptions
} from '../controllers/adminSubscriptionController.js'

const router = Router()

router.use(protect)
router.use(restrictTo(USER_ROLES.ADMIN))

router.route('/plans')
  .get(getSubscriptionPlans)
  .post(createSubscriptionPlan)

router.route('/plans/:id')
  .get(getSubscriptionPlanById)
  .put(updateSubscriptionPlan)
  .delete(deleteSubscriptionPlan)

router.route('/vendors')
  .get(getVendorSubscriptions)

router.route('/users')
  .get(getUserSubscriptions)

router.route('/corporate')
  .get(getCorporateSubscriptions)

export default router

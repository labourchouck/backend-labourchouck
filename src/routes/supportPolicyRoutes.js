import { Router } from 'express'
import { getSupportPolicy } from '../controllers/supportPolicyController.js'

const router = Router()

router.get('/public', getSupportPolicy)

export default router

import { Router } from 'express'
import { getTermsByRole } from '../controllers/termsController.js'
import { protect } from '../middleware/auth.js'

const router = Router()

// Protected route to fetch terms based on authenticated user's role
router.get('/', protect, getTermsByRole)

export default router

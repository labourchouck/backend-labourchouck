import { Router } from 'express'
import { getTermsByRole } from '../controllers/termsController.js'
import { protect } from '../middleware/auth.js'

const router = Router()

// Public (website + signed-out users): pass ?role=. Privacy policy is already public the same way.
router.get('/public', getTermsByRole)

// Protected route to fetch terms based on authenticated user's role
router.get('/', protect, getTermsByRole)

export default router

import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as zoneController from '../controllers/zoneController.js'

const router = Router()

// Only ADMIN can access these zone settings and stats
router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/settings', zoneController.getZoneSettings)
router.put('/settings', zoneController.updateZoneSettings)
router.get('/statistics', zoneController.getZoneStatistics)

export default router

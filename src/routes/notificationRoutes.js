import { Router } from 'express'
import { protect } from '../middleware/auth.js'
import * as notifications from '../controllers/notificationController.js'

const router = Router()

router.use(protect)

router.get('/', notifications.getMyNotifications)
router.post('/token', notifications.registerFcmToken)
router.post('/test', notifications.sendTestNotification)
router.delete('/token', notifications.unregisterFcmToken)
router.patch('/read-all', notifications.markAllAsRead)
router.patch('/:id/read', notifications.markAsRead)

export default router

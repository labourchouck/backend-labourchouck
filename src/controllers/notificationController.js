import { Notification } from '../models/Notification.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendError, sendSuccess, HTTP_STATUS } from '../utils/apiResponse.js'
import { registerToken, removeToken, sendToUser } from '../services/notificationService.js'
import { isFirebaseReady } from '../config/firebase.js'

const ALLOWED_PLATFORMS = ['web', 'app', 'android', 'ios']

/**
 * POST /notifications/token — register the caller's FCM device token.
 * Two token types are supported:
 *  - platform: 'web'              → FCM web token (browser)
 *  - platform: 'app' | 'android' | 'ios' → FCM app/mobile token
 *    ('android'/'ios' are stored as type 'app' with the OS recorded)
 */
export const registerFcmToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body
  if (!token || typeof token !== 'string') {
    return sendError(res, { message: 'token is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const resolvedPlatform = String(platform || 'web').toLowerCase()
  if (!ALLOWED_PLATFORMS.includes(resolvedPlatform)) {
    return sendError(res, {
      message: `platform must be one of: ${ALLOWED_PLATFORMS.join(', ')}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }
  await registerToken(req.user._id, token, resolvedPlatform)
  return sendSuccess(res, { message: 'Token registered' })
})

/** DELETE /notifications/token — remove a token (logout) */
export const unregisterFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body
  if (!token || typeof token !== 'string') {
    return sendError(res, { message: 'token is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  await removeToken(req.user._id, token)
  return sendSuccess(res, { message: 'Token removed' })
})

/** GET /notifications — paginated inbox + unread count */
export const getMyNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100)
  const filter = { userId: req.user._id }
  if (req.query.unread === 'true') filter.read = false

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ])

  return sendSuccess(res, {
    data: {
      notifications,
      unreadCount,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    },
  })
})

/** PATCH /notifications/:id/read — mark one as read */
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { read: true, readAt: new Date() },
    { new: true },
  )
  if (!notification) {
    return sendError(res, { message: 'Notification not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  return sendSuccess(res, { data: { notification } })
})

/**
 * POST /notifications/test — send the caller a test push notification.
 * Useful to verify FCM setup end-to-end (permission, token, delivery).
 */
export const sendTestNotification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+fcmTokens').lean()
  const webCount = user?.fcmTokens?.web?.length || 0
  const appCount = user?.fcmTokens?.app?.length || 0

  if (!isFirebaseReady()) {
    return sendError(res, {
      message: 'Push notifications are not configured on the server (Firebase Admin not initialized)',
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE || 503,
    })
  }
  if (webCount + appCount === 0) {
    return sendError(res, {
      message: 'No device tokens registered for your account. Allow notifications in your browser/app first.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  await sendToUser(req.user._id, {
    title: 'Test notification 🔔',
    body: `Hi ${req.user.fullName || 'there'}! Push notifications are working on your account.`,
    type: 'TEST',
    data: { link: '/app/profile' },
  })

  return sendSuccess(res, {
    message: `Test notification sent to ${webCount + appCount} device(s)`,
    data: { devices: { web: webCount, app: appCount } },
  })
})

/** PATCH /notifications/read-all — mark everything as read */
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, read: false },
    { read: true, readAt: new Date() },
  )
  return sendSuccess(res, { message: 'All notifications marked as read' })
})

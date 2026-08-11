import { Notification } from '../models/Notification.js'
import { User } from '../models/User.js'
import { USER_ROLES } from '../constants/roles.js'
import { emitToUser } from '../socket.js'
import { getMessaging, isFirebaseReady } from '../config/firebase.js'

/**
 * Unified notification service.
 *
 * Every call does three things (each independently fail-safe):
 *  1. Persists a Notification document (in-app inbox / unread count)
 *  2. Emits a `NOTIFICATION` socket event to the user's room (live UI update)
 *  3. Sends an FCM push to all of the user's registered device tokens,
 *     pruning tokens Firebase reports as dead.
 *
 * All functions swallow their own errors — a notification failure must never
 * break the business flow that triggered it.
 */

/** FCM data payloads only accept flat string values */
const toStringData = (data = {}) => {
  const out = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    out[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  return out
}

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

/** Normalize any incoming platform value to the two supported token types. */
export const normalizePlatform = (platform) => {
  const p = String(platform || 'web').toLowerCase()
  if (p === 'web') return { platform: 'web', deviceOs: undefined }
  if (p === 'app') return { platform: 'app', deviceOs: undefined }
  // 'android' / 'ios' (or anything else mobile-ish) → app token, keep the OS detail
  return { platform: 'app', deviceOs: p }
}

/** 1) FCM WEB message — browser delivery via the webpush protocol */
const buildWebMessage = (tokens, { title, body, data, type }) => ({
  tokens,
  data: { ...toStringData(data), type: type || 'GENERAL', title, body: body || '' },
  notification: { title, body: body || '' },
  webpush: {
    headers: { Urgency: 'high' },
    fcmOptions: data?.link ? { link: String(data.link) } : undefined,
    notification: {
      title,
      body: body || '',
      icon: '/logo.svg',
      badge: '/favicon.svg',
    },
  },
})

/** 2) FCM APP message — Android/iOS delivery via android + apns configs */
const buildAppMessage = (tokens, { title, body, data, type }) => ({
  tokens,
  data: { ...toStringData(data), type: type || 'GENERAL', title, body: body || '' },
  notification: { title, body: body || '' },
  android: {
    priority: 'high',
    notification: {
      sound: 'default',
      channelId: 'labourchowk_default',
      clickAction: 'FLUTTER_NOTIFICATION_CLICK',
    },
  },
  apns: {
    headers: { 'apns-priority': '10' },
    payload: {
      aps: {
        sound: 'default',
        contentAvailable: true,
      },
    },
  },
})

/**
 * Send an FCM push to a set of devices, batching separately per token type
 * (web vs app) so each gets the correct platform config.
 * @param {Array<{token: string, platform: 'web'|'app'}>} devices
 * @returns {Promise<string[]>} dead tokens found
 */
const sendFcm = async (devices, payload) => {
  if (!isFirebaseReady() || devices.length === 0) return []
  const messaging = getMessaging()

  const webTokens = devices.filter((d) => d.platform !== 'app').map((d) => d.token)
  const appTokens = devices.filter((d) => d.platform === 'app').map((d) => d.token)

  const batches = []
  // FCM multicast caps at 500 tokens per call
  for (let i = 0; i < webTokens.length; i += 500) {
    batches.push(buildWebMessage(webTokens.slice(i, i + 500), payload))
  }
  for (let i = 0; i < appTokens.length; i += 500) {
    batches.push(buildAppMessage(appTokens.slice(i, i + 500), payload))
  }

  const deadTokens = []
  for (const message of batches) {
    try {
      const response = await messaging.sendEachForMulticast(message)
      response.responses.forEach((res, idx) => {
        if (!res.success && DEAD_TOKEN_CODES.has(res.error?.code)) {
          deadTokens.push(message.tokens[idx])
        }
      })
    } catch (error) {
      console.error('[notify] FCM send failed:', error.message)
    }
  }
  return deadTokens
}

/** Flatten a user's separated token stores into [{token, platform}] for sending. */
const collectDevices = (fcmTokens) => {
  const store = fcmTokens || {}
  return [
    ...(store.web || []).map((t) => ({ token: t.token, platform: 'web' })),
    ...(store.app || []).map((t) => ({ token: t.token, platform: 'app' })),
  ]
}

const pruneTokens = async (deadTokens) => {
  if (deadTokens.length === 0) return
  try {
    await User.updateMany(
      {
        $or: [
          { 'fcmTokens.web.token': { $in: deadTokens } },
          { 'fcmTokens.app.token': { $in: deadTokens } },
        ],
      },
      {
        $pull: {
          'fcmTokens.web': { token: { $in: deadTokens } },
          'fcmTokens.app': { token: { $in: deadTokens } },
        },
      },
    )
  } catch (error) {
    console.error('[notify] Failed to prune dead FCM tokens:', error.message)
  }
}

/**
 * Notify a single user.
 * @param {string|ObjectId} userId
 * @param {{title: string, body?: string, type: string, data?: object}} payload
 */
export const sendToUser = async (userId, { title, body, type, data = {} }) => {
  // Accept raw ids, populated documents, or {_id} objects
  userId = userId?._id || userId
  if (!userId || !title || !type) return
  try {
    // 1. Persist
    let notification = null
    try {
      notification = await Notification.create({ userId, title, body, type, data })
    } catch (error) {
      console.error('[notify] Failed to persist notification:', error.message)
    }

    // 2. Live socket event (generic channel consumed by all panels)
    emitToUser(userId, 'NOTIFICATION', {
      _id: notification?._id,
      title,
      body,
      type,
      data,
      createdAt: notification?.createdAt || new Date(),
    })

    // 3. FCM push (web + app token stores, batched per type)
    const user = await User.findById(userId).select('+fcmTokens').lean()
    const devices = collectDevices(user?.fcmTokens)
    const deadTokens = await sendFcm(devices, { title, body, data, type })
    await pruneTokens(deadTokens)
  } catch (error) {
    console.error('[notify] sendToUser failed:', error.message)
  }
}

/**
 * Notify many users with the same payload (bulk insert + single multicast).
 * @param {Array<string|ObjectId>} userIds
 */
export const sendToUsers = async (userIds, { title, body, type, data = {} }) => {
  const ids = (userIds || []).map((u) => u?._id || u).filter(Boolean)
  if (ids.length === 0 || !title || !type) return
  try {
    // 1. Persist for everyone
    let docs = []
    try {
      docs = await Notification.insertMany(
        ids.map((userId) => ({ userId, title, body, type, data })),
        { ordered: false },
      )
    } catch (error) {
      console.error('[notify] Bulk persist failed:', error.message)
    }

    // 2. Socket to each user's room
    const byUser = new Map(docs.map((d) => [String(d.userId), d]))
    for (const userId of ids) {
      const doc = byUser.get(String(userId))
      emitToUser(userId, 'NOTIFICATION', {
        _id: doc?._id,
        title,
        body,
        type,
        data,
        createdAt: doc?.createdAt || new Date(),
      })
    }

    // 3. FCM to all devices of all recipients (sendFcm batches per type and per 500)
    const users = await User.find({ _id: { $in: ids } }).select('+fcmTokens').lean()
    const devices = users.flatMap((u) => collectDevices(u.fcmTokens))
    const deadTokens = await sendFcm(devices, { title, body, data, type })
    await pruneTokens(deadTokens)
  } catch (error) {
    console.error('[notify] sendToUsers failed:', error.message)
  }
}

/** Notify every active admin (approval queues, ops alerts, withdrawal requests...). */
export const notifyAdmins = async (payload) => {
  try {
    const admins = await User.find({ role: USER_ROLES.ADMIN, isActive: true }).select('_id').lean()
    await sendToUsers(admins.map((a) => a._id), payload)
  } catch (error) {
    console.error('[notify] notifyAdmins failed:', error.message)
  }
}

/**
 * Register (upsert) an FCM device token for a user, storing it in the correct
 * bucket: fcmTokens.web (browser) or fcmTokens.app (Android/iOS).
 * @param {'web'|'app'|'android'|'ios'} platform — 'android'/'ios' are stored in
 *   the app bucket with the OS kept in deviceOs.
 */
export const registerToken = async (userId, token, platform = 'web') => {
  const normalized = normalizePlatform(platform)

  // Remove this token from every account and both buckets first (shared
  // devices, or a device switching between web and app), then insert fresh.
  await User.updateMany(
    {
      $or: [
        { 'fcmTokens.web.token': token },
        { 'fcmTokens.app.token': token },
      ],
    },
    {
      $pull: {
        'fcmTokens.web': { token },
        'fcmTokens.app': { token },
      },
    },
  )

  const entry =
    normalized.platform === 'app'
      ? { token, ...(normalized.deviceOs ? { deviceOs: normalized.deviceOs } : {}), updatedAt: new Date() }
      : { token, updatedAt: new Date() }

  await User.updateOne(
    { _id: userId },
    { $push: { [`fcmTokens.${normalized.platform}`]: entry } },
  )
}

/** Remove an FCM device token from both buckets (logout / permission revoked). */
export const removeToken = async (userId, token) => {
  await User.updateOne(
    { _id: userId },
    {
      $pull: {
        'fcmTokens.web': { token },
        'fcmTokens.app': { token },
      },
    },
  )
}

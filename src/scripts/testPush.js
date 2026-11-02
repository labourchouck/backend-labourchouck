import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { isFirebaseReady } from '../config/firebase.js'
import { sendToUser } from '../services/notificationService.js'

/**
 * Sends a real test push to one user and prints exactly what FCM answered.
 *
 *   npm run test:push -- 7828394005
 */
const phone = process.argv[2]
if (!phone) {
  console.error('Usage: npm run test:push -- <10-digit phone>')
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI)
console.log('Firebase Admin ready:', isFirebaseReady() ? 'YES' : 'NO  <-- service account file missing/invalid; no push can be sent')

const user = await User.findOne({ phone }).select('+fcmTokens fullName role').lean()
if (!user) {
  console.error('No user with that phone.')
  process.exit(1)
}
const web = user.fcmTokens?.web?.length || 0
const app = user.fcmTokens?.app?.length || 0
console.log(`User: ${user.fullName || phone} (${user.role}) — registered devices: web=${web}, app=${app}`)
if (!web && !app) console.log('No device tokens: open the app while logged in and allow notifications, then try again.')

await sendToUser(user._id, {
  title: 'Mappto test notification',
  body: 'If you can see this, push notifications work.',
  type: 'TEST_PUSH',
  data: { link: '/app' },
})
console.log('Done. Check the [notify] lines above for per-device results.')
await mongoose.disconnect()
process.exit(0)

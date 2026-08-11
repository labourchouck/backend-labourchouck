// Temporary debug script: check stored FCM tokens and send a real test push,
// printing FCM's raw per-token response. Run: node debug_push.mjs
import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from './src/models/User.js'
import { getMessaging, isFirebaseReady } from './src/config/firebase.js'

console.log('firebase ready:', isFirebaseReady())

await mongoose.connect(process.env.MONGODB_URI)
console.log('mongo connected')

const users = await User.find({
  $or: [
    { 'fcmTokens.web.0': { $exists: true } },
    { 'fcmTokens.app.0': { $exists: true } },
  ],
}).select('+fcmTokens phone role fullName').lean()

console.log(`users with tokens: ${users.length}`)
for (const u of users) {
  const web = u.fcmTokens?.web || []
  const app = u.fcmTokens?.app || []
  console.log(`- ${u.fullName || u.phone} (${u.role}): web=${web.length} app=${app.length}`)
  web.forEach(t => console.log(`    web token: ${t.token.slice(0, 24)}... (updated ${t.updatedAt})`))
}

const allWebTokens = users.flatMap(u => (u.fcmTokens?.web || []).map(t => t.token))
if (allWebTokens.length === 0) {
  console.log('NO WEB TOKENS IN DB — frontend registration never happened')
  process.exit(0)
}

const messaging = getMessaging()

// Variant A: exactly what notificationService sends (includes fcmOptions.link with a RELATIVE url)
try {
  const resA = await messaging.sendEachForMulticast({
    tokens: allWebTokens,
    notification: { title: 'Variant A (relative link)', body: 'service-style message' },
    data: { type: 'TEST', link: '/app/profile', title: 'Variant A', body: 'x' },
    webpush: {
      headers: { Urgency: 'high' },
      fcmOptions: { link: '/app/profile' },
      notification: { title: 'Variant A', body: 'service-style message', icon: '/logo.svg', badge: '/favicon.svg' },
    },
  })
  console.log(`A: success=${resA.successCount} fail=${resA.failureCount}`)
  resA.responses.forEach((r, i) => { if (!r.success) console.log(`  A[${i}] FAIL code=${r.error?.code} msg=${r.error?.message}`) })
} catch (e) {
  console.log('A threw:', e.message)
}

// Variant B: same but with an ABSOLUTE link
try {
  const resB = await messaging.sendEachForMulticast({
    tokens: allWebTokens,
    notification: { title: 'Variant B (absolute link)', body: 'absolute-link message' },
    data: { type: 'TEST', link: '/app/profile', title: 'Variant B', body: 'x' },
    webpush: {
      headers: { Urgency: 'high' },
      fcmOptions: { link: 'http://localhost:5173/app/profile' },
      notification: { title: 'Variant B', body: 'absolute-link message', icon: '/logo.svg' },
    },
  })
  console.log(`B: success=${resB.successCount} fail=${resB.failureCount}`)
  resB.responses.forEach((r, i) => { if (!r.success) console.log(`  B[${i}] FAIL code=${r.error?.code} msg=${r.error?.message}`) })
} catch (e) {
  console.log('B threw:', e.message)
}

process.exit(0)

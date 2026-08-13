import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getMessaging as getAdminMessaging } from 'firebase-admin/messaging'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Firebase Admin SDK bootstrap.
 * Reads the service account from FIREBASE_SERVICE_ACCOUNT_PATH if set,
 * otherwise falls back to the local labourchowck.json in this folder.
 * If the file is missing or invalid the app still boots — push sending
 * is simply disabled (isFirebaseReady() returns false).
 */
let firebaseApp = null

const resolveServiceAccountPath = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  }
  return path.join(__dirname, 'labourchowck.json')
}

try {
  const serviceAccountPath = resolveServiceAccountPath()
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    })
    console.info('[firebase] Admin SDK initialized for project:', serviceAccount.project_id)
  } else {
    console.warn('[firebase] Service account file not found at', serviceAccountPath, '— push notifications disabled')
  }
} catch (error) {
  console.error('[firebase] Failed to initialize Admin SDK — push notifications disabled:', error.message)
}

export const isFirebaseReady = () => firebaseApp !== null

export const getMessaging = () => {
  if (!firebaseApp) return null
  return getAdminMessaging(firebaseApp)
}

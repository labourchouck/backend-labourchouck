import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { USER_ROLES } from '../constants/roles.js'

const DEFAULT_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@labourchowck.local'
const DEFAULT_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@123'
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE || '8999999999'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12)
  await User.findOneAndUpdate(
    { email: DEFAULT_EMAIL },
    {
      $set: {
        email: DEFAULT_EMAIL,
        passwordHash,
        role: USER_ROLES.ADMIN,
        fullName: 'System Admin',
        phone: ADMIN_PHONE,
        isPhoneVerified: true,
        isActive: true,
      },
    },
    { upsert: true, new: true },
  )

  console.log('Admin seeded:', DEFAULT_EMAIL, '(change password in production)')
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

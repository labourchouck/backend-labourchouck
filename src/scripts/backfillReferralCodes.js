import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { generateReferralCode } from '../utils/referralCode.js'

/**
 * Gives every existing user a referral code.
 * New users get one during registration; this covers everyone who signed up
 * before Refer & Earn shipped. Safe to re-run.
 *
 *   npm run backfill:referral-codes
 */
async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  const users = await User.find({
    $or: [{ referralCode: { $exists: false } }, { referralCode: null }],
  }).select('_id phone role')

  console.log(`Users without a referral code: ${users.length}`)
  let assigned = 0
  let failed = 0

  for (const user of users) {
    let done = false
    for (let attempt = 0; attempt < 6 && !done; attempt += 1) {
      const code = generateReferralCode()
      try {
        await User.updateOne({ _id: user._id }, { $set: { referralCode: code } })
        assigned += 1
        done = true
      } catch (err) {
        if (err?.code !== 11000) throw err
      }
    }
    if (!done) {
      failed += 1
      console.warn(`Could not allocate a code for user ${user._id}`)
    }
  }

  console.log(`Assigned: ${assigned}, failed: ${failed}`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

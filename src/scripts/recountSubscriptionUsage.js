import 'dotenv/config'
import mongoose from 'mongoose'
import { UserSubscription } from '../models/UserSubscription.js'
import { Booking } from '../models/Booking.js'
import { isBillableBooking } from '../services/subscriptionUsageService.js'

/**
 * Repairs B2C subscription usage that was inflated by failed / cancelled bookings.
 *
 * A plan's `bookingsUsed` should only count bookings that are COMPLETED and paid (cash jobs count once completed).
 * For every ACTIVE plan this recounts those bookings made since the plan started, links every booking made since
 * then to the plan (so in-progress ones reserve a slot), and marks the billable ones as counted.
 *
 *   npm run recount:subscription-usage            # dry run: prints what would change, writes nothing
 *   npm run recount:subscription-usage -- --apply # writes the corrected numbers
 */
const APPLY = process.argv.includes('--apply')

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes)'}`)

  const subs = await UserSubscription.find({ status: 'active' })
  let changed = 0
  for (const sub of subs) {
    const bookings = await Booking.find({ userId: sub.user, createdAt: { $gte: sub.startDate } })
      .select('status paymentMethod paymentStatus subscriptionId subscriptionCounted')
      .lean()
    const billable = bookings.filter(isBillableBooking)
    const allowed = sub.snapshotPlanDetails?.allowedBookings || 0
    const wrong = sub.bookingsUsed !== billable.length
    const byStatus = bookings.reduce((m, b) => ((m[b.status] = (m[b.status] || 0) + 1), m), {})
    console.log(
      `${wrong ? 'FIX ' : 'ok  '} plan ${sub._id} user ${sub.user} used ${sub.bookingsUsed} -> ${billable.length} of ${allowed} allowed | bookings since start: ${JSON.stringify(byStatus)}`,
    )
    if (!wrong && bookings.every((b) => String(b.subscriptionId || '') === String(sub._id))) continue
    changed++
    if (!APPLY) continue

    await UserSubscription.updateOne({ _id: sub._id }, { $set: { bookingsUsed: billable.length } })
    await Booking.updateMany({ _id: { $in: bookings.map((b) => b._id) } }, { $set: { subscriptionId: sub._id, subscriptionCounted: false } })
    if (billable.length) {
      await Booking.updateMany({ _id: { $in: billable.map((b) => b._id) } }, { $set: { subscriptionCounted: true } })
    }
  }
  console.log(`\n${APPLY ? 'Updated' : 'Would update'} ${changed} of ${subs.length} active plan(s).`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

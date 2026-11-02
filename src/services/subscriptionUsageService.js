import { Booking } from '../models/Booking.js'
import { UserSubscription } from '../models/UserSubscription.js'

/** Bookings that still hold a place in the plan but have not been billed yet. */
const IN_FLIGHT_STATUSES = ['CREATED', 'BROADCASTING', 'ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED']

/**
 * A booking uses up a subscription slot only once the job is done and paid for:
 * COMPLETED, and either paid online or a cash job (cash is collected at completion).
 * Failed, cancelled, expired and unpaid-online bookings never count.
 */
export function isBillableBooking(booking) {
  if (!booking || booking.status !== 'COMPLETED') return false
  return booking.paymentStatus === 'PAID' || booking.paymentMethod === 'CASH'
}

/**
 * Counts a finished booking against the subscription it was booked under. Safe to call repeatedly and from
 * several places (job completion, online payment): the booking is claimed atomically, so it is counted once.
 */
export async function countBookingTowardSubscription(bookingOrId) {
  const booking = bookingOrId?._id ? bookingOrId : await Booking.findById(bookingOrId)
  if (!booking) return false
  if (!booking.subscriptionId) return false
  if (!isBillableBooking(booking)) {
    console.log(`[SUBSCRIPTION] booking ${booking._id} not counted yet (status=${booking.status}, payment=${booking.paymentMethod}/${booking.paymentStatus})`)
    return false
  }

  const claimed = await Booking.findOneAndUpdate(
    { _id: booking._id, subscriptionCounted: { $ne: true } },
    { $set: { subscriptionCounted: true } },
  )
  if (!claimed) return false

  await UserSubscription.updateOne({ _id: booking.subscriptionId }, { $inc: { bookingsUsed: 1 } })
  console.log(`[SUBSCRIPTION] booking ${booking._id} counted toward plan ${booking.subscriptionId}`)
  return true
}

/**
 * Bookings under this plan that are still in progress (or done but not yet billed, e.g. awaiting online payment).
 * They reserve a slot so a user cannot book more than the plan allows, but they are not "used" until billable.
 */
export async function countReservedBookings(subscriptionId) {
  return Booking.countDocuments({
    subscriptionId,
    subscriptionCounted: { $ne: true },
    $or: [
      { status: { $in: IN_FLIGHT_STATUSES } },
      { status: 'COMPLETED', paymentMethod: 'ONLINE', paymentStatus: { $ne: 'PAID' } },
    ],
  })
}

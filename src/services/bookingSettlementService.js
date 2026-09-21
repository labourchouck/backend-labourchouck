import { Booking } from '../models/Booking.js'
import { creditSelfBalance } from './walletService.js'

/**
 * Money that has to move when a booking ends in a particular way.
 *
 * Both helpers are idempotent: they claim their job with a conditional update
 * on the booking first, so the many code paths that can end a booking cannot
 * pay twice between them. Neither ever throws into the caller.
 */

/**
 * Give the customer their wallet credit back when a booking will never happen
 * (cancelled, failed, expired).
 * @param {any} booking a Booking document or lean object
 */
export async function refundBookingWalletDiscount(booking, reason = 'cancelled') {
  try {
    const amount = Number(booking?.walletDiscount) || 0
    if (amount <= 0 || booking.walletRefundedAt) return false

    const claimed = await Booking.findOneAndUpdate(
      { _id: booking._id, walletRefundedAt: { $exists: false } },
      { $set: { walletRefundedAt: new Date() } },
      { new: true },
    )
    if (!claimed) return false

    await creditSelfBalance({
      userId: booking.userId,
      amount,
      context: 'BOOKING',
      referenceId: booking._id,
      description: `Wallet refund — booking ${reason}`,
    })
    return true
  } catch (err) {
    console.error('[wallet] booking refund failed:', err?.message || err)
    return false
  }
}

/**
 * CASH booking with a wallet discount: the customer handed the worker less cash
 * than the job is worth, while the worker still owes the platform the full fees.
 * Top the worker up so the platform absorbs the discount, not the worker.
 * @param {any} booking a Booking document
 */
export async function topUpWorkerForCashDiscount(booking) {
  try {
    const amount = Number(booking?.walletDiscount) || 0
    if (amount <= 0 || booking.paymentMethod !== 'CASH' || booking.walletTopUpAt) return false
    if (!booking.laborId) return false

    const claimed = await Booking.findOneAndUpdate(
      { _id: booking._id, walletTopUpAt: { $exists: false } },
      { $set: { walletTopUpAt: new Date() } },
      { new: true },
    )
    if (!claimed) return false

    await creditSelfBalance({
      userId: booking.laborId,
      amount,
      context: 'BOOKING',
      referenceId: booking._id,
      description: 'Platform top-up for customer wallet discount',
    })
    return true
  } catch (err) {
    console.error('[wallet] cash top-up failed:', err?.message || err)
    return false
  }
}

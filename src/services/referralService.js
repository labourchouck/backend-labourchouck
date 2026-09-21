import { Referral, REFERRAL_STATUS } from '../models/Referral.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { User } from '../models/User.js'
import { generateReferralCode, normalizeReferralCode } from '../utils/referralCode.js'
import { creditSelfBalance } from './walletService.js'
import { sendToUser } from './notificationService.js'

export const REWARD_TRIGGER = {
  SIGNUP: 'SIGNUP',
  FIRST_BOOKING: 'FIRST_BOOKING',
}

const DEFAULT_REFERRAL_CONFIG = {
  isActive: false,
  rewardTrigger: REWARD_TRIGGER.FIRST_BOOKING,
  referrerReward: 100,
  refereeReward: 0,
  minBookingAmount: 0,
  maxRewardsPerReferrer: 0,
}

/** Read the admin-configured referral block off the singleton settings doc. */
export async function getReferralConfig() {
  const settings = await SystemSetting.findOne({ configKey: 'master_config' }).lean()
  const referral = settings?.referral ?? {}
  return {
    isActive: referral.isActive ?? DEFAULT_REFERRAL_CONFIG.isActive,
    rewardTrigger: referral.rewardTrigger ?? DEFAULT_REFERRAL_CONFIG.rewardTrigger,
    referrerReward: Number(referral.referrerReward ?? DEFAULT_REFERRAL_CONFIG.referrerReward),
    refereeReward: Number(referral.refereeReward ?? DEFAULT_REFERRAL_CONFIG.refereeReward),
    minBookingAmount: Number(referral.minBookingAmount ?? DEFAULT_REFERRAL_CONFIG.minBookingAmount),
    maxRewardsPerReferrer: Number(
      referral.maxRewardsPerReferrer ?? DEFAULT_REFERRAL_CONFIG.maxRewardsPerReferrer,
    ),
  }
}

/**
 * Give a user a referral code if they do not have one yet.
 * Retries on the unique-index collision rather than pre-checking.
 * @param {any} user a User document
 * @returns {Promise<string>} the user's code
 */
export async function ensureReferralCode(user) {
  if (user?.referralCode) return user.referralCode

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateReferralCode()
    try {
      const updated = await User.findOneAndUpdate(
        { _id: user._id, $or: [{ referralCode: { $exists: false } }, { referralCode: null }] },
        { $set: { referralCode: code } },
        { new: true },
      )
      // Someone else already assigned one in a parallel request.
      if (!updated) {
        const fresh = await User.findById(user._id).select('referralCode').lean()
        if (fresh?.referralCode) return fresh.referralCode
        continue
      }
      user.referralCode = updated.referralCode
      return updated.referralCode
    } catch (err) {
      if (err?.code === 11000) continue
      throw err
    }
  }
  throw new Error('Could not allocate a unique referral code')
}

/** Look up the owner of a referral code. Returns null when the code is unusable. */
export async function findReferrerByCode(code) {
  const normalized = normalizeReferralCode(code)
  if (!normalized) return null
  return User.findOne({ referralCode: normalized, isActive: true })
}

/**
 * Pay out a referral that is allowed to be rewarded.
 *
 * The PENDING/QUALIFIED -> REWARDED flip happens first and conditionally, so a
 * second concurrent call gets `null` back and pays nothing.
 *
 * @param {any} referral the Referral document
 * @param {{ referrerReward: number, refereeReward: number }} amounts
 * @param {{ bookingId?: any }} [meta]
 */
async function payoutReferral(referral, amounts, meta = {}) {
  const claimed = await Referral.findOneAndUpdate(
    {
      _id: referral._id,
      status: { $in: [REFERRAL_STATUS.PENDING, REFERRAL_STATUS.QUALIFIED] },
    },
    {
      $set: {
        status: REFERRAL_STATUS.REWARDED,
        referrerReward: amounts.referrerReward,
        refereeReward: amounts.refereeReward,
        rewardedAt: new Date(),
        ...(meta.bookingId ? { qualifyingBookingId: meta.bookingId } : {}),
      },
    },
    { new: true },
  )

  if (!claimed) return null

  try {
    if (amounts.referrerReward > 0) {
      await creditSelfBalance({
        userId: claimed.referrerId,
        amount: amounts.referrerReward,
        context: 'REFERRAL',
        referenceId: claimed._id,
        description: 'Referral reward',
      })
    }
    if (amounts.refereeReward > 0) {
      await creditSelfBalance({
        userId: claimed.refereeId,
        amount: amounts.refereeReward,
        context: 'REFERRAL',
        referenceId: claimed._id,
        description: 'Referral signup bonus',
      })
    }
  } catch (err) {
    // Put it back so a later run can retry instead of silently losing the reward.
    await Referral.updateOne(
      { _id: claimed._id, status: REFERRAL_STATUS.REWARDED },
      { $set: { status: REFERRAL_STATUS.QUALIFIED, note: 'Wallet credit failed, will retry' }, $unset: { rewardedAt: '' } },
    )
    throw err
  }

  // Notifications must never break the payout.
  if (amounts.referrerReward > 0) {
    sendToUser(claimed.referrerId, {
      title: 'Referral reward credited',
      body: `₹${amounts.referrerReward} has been added to your wallet.`,
      type: 'REFERRAL_REWARDED',
      data: { referralId: String(claimed._id), link: '/app/wallet' },
    }).catch(() => {})
  }
  if (amounts.refereeReward > 0) {
    sendToUser(claimed.refereeId, {
      title: 'Welcome bonus credited',
      body: `₹${amounts.refereeReward} has been added to your wallet.`,
      type: 'REFERRAL_REWARDED',
      data: { referralId: String(claimed._id), link: '/app/wallet' },
    }).catch(() => {})
  }

  return claimed
}

/** How many referrals this referrer has already been paid for. */
async function rewardedCountFor(referrerId) {
  return Referral.countDocuments({ referrerId, status: REFERRAL_STATUS.REWARDED })
}

/**
 * Link a freshly created user to whoever referred them.
 *
 * Safe to call with a missing or bad code, in which case it does nothing and
 * returns a reason. Never throws into the registration path.
 *
 * @param {object} options
 * @param {any} options.refereeUser the newly created User document
 * @param {string} options.code the code they typed / the link carried
 */
export async function attachReferral({ refereeUser, code }) {
  const config = await getReferralConfig()
  if (!config.isActive) return { attached: false, reason: 'REFERRALS_DISABLED' }

  const normalized = normalizeReferralCode(code)
  if (!normalized) return { attached: false, reason: 'NO_CODE' }

  const referrer = await findReferrerByCode(normalized)
  if (!referrer) return { attached: false, reason: 'INVALID_CODE' }
  if (String(referrer._id) === String(refereeUser._id)) {
    return { attached: false, reason: 'SELF_REFERRAL' }
  }

  let referral
  try {
    referral = await Referral.create({
      referrerId: referrer._id,
      refereeId: refereeUser._id,
      code: normalized,
      status: REFERRAL_STATUS.PENDING,
    })
  } catch (err) {
    // Unique index on refereeId: this user was already referred by someone.
    if (err?.code === 11000) return { attached: false, reason: 'ALREADY_REFERRED' }
    throw err
  }

  await User.updateOne(
    { _id: refereeUser._id },
    { $set: { referredBy: referrer._id, referredByCode: normalized } },
  )
  refereeUser.referredBy = referrer._id
  refereeUser.referredByCode = normalized

  sendToUser(referrer._id, {
    title: 'Someone joined with your code',
    body: `${refereeUser.fullName || 'A new user'} signed up using your referral code.`,
    type: 'REFERRAL_JOINED',
    data: { referralId: String(referral._id), link: '/app/refer' },
  }).catch(() => {})

  if (config.rewardTrigger === REWARD_TRIGGER.SIGNUP) {
    if (config.maxRewardsPerReferrer > 0) {
      const already = await rewardedCountFor(referrer._id)
      if (already >= config.maxRewardsPerReferrer) {
        return { attached: true, rewarded: false, reason: 'REFERRER_CAP_REACHED', referral }
      }
    }
    const paid = await payoutReferral(referral, {
      referrerReward: config.referrerReward,
      refereeReward: config.refereeReward,
    })
    return { attached: true, rewarded: Boolean(paid), referral: paid ?? referral }
  }

  return { attached: true, rewarded: false, referral }
}

/**
 * Called when a booking reaches COMPLETED. Pays the referral out if this was
 * the referred user's first completed booking and everything else checks out.
 *
 * Swallows its own errors: a referral problem must never fail a job completion.
 *
 * @param {any} booking a Booking document
 */
export async function qualifyReferralForBooking(booking) {
  try {
    if (!booking?.userId) return { rewarded: false, reason: 'NO_CUSTOMER' }

    const config = await getReferralConfig()
    if (!config.isActive) return { rewarded: false, reason: 'REFERRALS_DISABLED' }
    if (config.rewardTrigger !== REWARD_TRIGGER.FIRST_BOOKING) {
      return { rewarded: false, reason: 'TRIGGER_NOT_BOOKING' }
    }

    const referral = await Referral.findOne({
      refereeId: booking.userId,
      status: { $in: [REFERRAL_STATUS.PENDING, REFERRAL_STATUS.QUALIFIED] },
    })
    if (!referral) return { rewarded: false, reason: 'NO_PENDING_REFERRAL' }

    const amount = Number(booking.totalAmount) || 0
    if (config.minBookingAmount > 0 && amount < config.minBookingAmount) {
      return { rewarded: false, reason: 'BELOW_MIN_BOOKING_AMOUNT' }
    }

    if (config.maxRewardsPerReferrer > 0) {
      const already = await rewardedCountFor(referral.referrerId)
      if (already >= config.maxRewardsPerReferrer) {
        return { rewarded: false, reason: 'REFERRER_CAP_REACHED' }
      }
    }

    const paid = await payoutReferral(
      referral,
      { referrerReward: config.referrerReward, refereeReward: config.refereeReward },
      { bookingId: booking._id },
    )
    return { rewarded: Boolean(paid), referral: paid }
  } catch (err) {
    console.error('[referral] qualifyReferralForBooking failed:', err?.message || err)
    return { rewarded: false, reason: 'ERROR' }
  }
}

/**
 * Everything the "Refer & Earn" screen needs for one user.
 * @param {any} user a User document
 */
export async function getReferralOverview(user) {
  const [config, code] = await Promise.all([getReferralConfig(), ensureReferralCode(user)])

  const referrals = await Referral.find({ referrerId: user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('refereeId', 'fullName phone createdAt')
    .lean()

  const rewarded = referrals.filter((r) => r.status === REFERRAL_STATUS.REWARDED)
  const totalEarned = rewarded.reduce((sum, r) => sum + (r.referrerReward || 0), 0)

  return {
    code,
    config: {
      isActive: config.isActive,
      rewardTrigger: config.rewardTrigger,
      referrerReward: config.referrerReward,
      refereeReward: config.refereeReward,
      minBookingAmount: config.minBookingAmount,
    },
    stats: {
      invited: referrals.length,
      rewarded: rewarded.length,
      pending: referrals.filter((r) => r.status !== REFERRAL_STATUS.REWARDED && r.status !== REFERRAL_STATUS.REJECTED).length,
      totalEarned,
    },
    referrals: referrals.map((r) => ({
      _id: r._id,
      status: r.status,
      referrerReward: r.referrerReward,
      createdAt: r.createdAt,
      rewardedAt: r.rewardedAt,
      referee: r.refereeId
        ? {
            fullName: r.refereeId.fullName || 'New user',
            phone: maskPhone(r.refereeId.phone),
          }
        : null,
    })),
  }
}

/** 9876543210 -> 98XXXXXX10 */
function maskPhone(phone) {
  const p = String(phone || '')
  if (p.length < 6) return p
  return `${p.slice(0, 2)}${'X'.repeat(p.length - 4)}${p.slice(-2)}`
}

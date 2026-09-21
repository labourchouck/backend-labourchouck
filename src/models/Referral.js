import mongoose from 'mongoose'

export const REFERRAL_STATUS = {
  PENDING: 'PENDING',
  QUALIFIED: 'QUALIFIED',
  REWARDED: 'REWARDED',
  REJECTED: 'REJECTED',
}

/**
 * One row per person who signed up with someone else's referral code.
 *
 * `refereeId` is unique, so a user can only ever be counted once no matter how
 * many times a reward path runs. The PENDING -> REWARDED transition is done
 * with a conditional update so two concurrent requests cannot both pay out.
 */
const referralSchema = new mongoose.Schema(
  {
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refereeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    /** The code as it was used at signup (snapshot, in case the user changes it later) */
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    status: {
      type: String,
      enum: Object.values(REFERRAL_STATUS),
      default: REFERRAL_STATUS.PENDING,
      index: true,
    },
    /** Amounts actually credited. Snapshotted so later settings changes do not rewrite history. */
    referrerReward: { type: Number, default: 0, min: 0 },
    refereeReward: { type: Number, default: 0, min: 0 },
    /** Which booking made this referral qualify (absent for SIGNUP trigger) */
    qualifyingBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    rewardedAt: Date,
    /** Why it was rejected / reversed by an admin */
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
)

referralSchema.index({ referrerId: 1, createdAt: -1 })

export const Referral = mongoose.model('Referral', referralSchema)

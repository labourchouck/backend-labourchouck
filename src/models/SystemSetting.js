import mongoose from 'mongoose'

const platformFeeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      required: true,
      default: 'fixed',
    },
    value: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
)

const commissionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['global', 'category', 'service'],
      required: true,
      default: 'global',
    },
    globalPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },
    // Allows overriding commission per category if needed in future, currently just global is managed here
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
)

/** Refer & Earn payout rules. Every amount is in rupees. */
const referralSchema = new mongoose.Schema(
  {
    isActive: { type: Boolean, default: false },
    /**
     * SIGNUP pays the moment the referred user registers.
     * FIRST_BOOKING waits until their first booking is completed (harder to game).
     */
    rewardTrigger: {
      type: String,
      enum: ['SIGNUP', 'FIRST_BOOKING'],
      default: 'FIRST_BOOKING',
    },
    /** Credited to the person who shared the code */
    referrerReward: { type: Number, min: 0, default: 100 },
    /** Credited to the person who used the code. 0 disables the joining bonus. */
    refereeReward: { type: Number, min: 0, default: 0 },
    /** Booking total below which a FIRST_BOOKING referral does not qualify. 0 = no floor. */
    minBookingAmount: { type: Number, min: 0, default: 0 },
    /** Lifetime cap on paid referrals per referrer. 0 = unlimited. */
    maxRewardsPerReferrer: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
)

const systemSettingSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      unique: true,
      required: true,
      index: true,
      default: 'master_config',
    },
    platformFee: {
      type: platformFeeSchema,
      default: () => ({}),
    },
    b2bPlatformFee: {
      type: platformFeeSchema,
      default: () => ({}),
    },
    commission: {
      type: commissionSchema,
      default: () => ({}),
    },

    walletLimit: {
      type: Number,
      min: 0,
      default: 100,
    },
    labourCashLimit: {
      type: Number,
      min: 0,
      default: 500,
    },
    cancellationPenalty: {
      type: Number,
      min: 0,
      default: 50,
    },
    bookingBroadcastRadius: {
      type: Number,
      min: 1,
      default: 10,
    },
    b2bBroadcastRadius: {
      type: Number,
      min: 1,
      default: 50, // Vendors usually cover larger areas
    },
    timeSlots: {
      type: [String],
      default: ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM'],
    },
    isUserSubscriptionEnabled: { type: Boolean, default: false },
    referral: {
      type: referralSchema,
      default: () => ({}),
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema)

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
    commission: {
      type: commissionSchema,
      default: () => ({}),
    },
    walletLimit: {
      type: Number,
      min: 0,
      default: 100,
    },
    gstPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
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
    timeSlots: {
      type: [String],
      default: ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM'],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema)

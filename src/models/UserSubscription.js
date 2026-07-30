import mongoose from 'mongoose'

const userSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  startDate: { type: Date, default: Date.now },
  bookingsUsed: { type: Number, default: 0 },
  snapshotPlanDetails: {
    name: String,
    price: Number,
    allowedBookings: Number,
  }
}, {
  timestamps: true
})

export const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema)

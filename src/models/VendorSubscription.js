import mongoose from 'mongoose'

const vendorSubscriptionSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date }
}, {
  timestamps: true
})

export const VendorSubscription = mongoose.model('VendorSubscription', vendorSubscriptionSchema)

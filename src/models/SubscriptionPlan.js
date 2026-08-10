import mongoose from 'mongoose'

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, default: '' },
  features: [{ type: String }],
  buttonText: { type: String, default: 'Subscribe Now' },
  recommended: { type: Boolean, default: false },
  gradient: { type: String, default: 'from-[#7a280e] to-[#c45c26]' },
  shadow: { type: String, default: 'shadow-orange-500/20' },
  isActive: { type: Boolean, default: true },
  planType: { type: String, enum: ['vendor', 'individual', 'corporate'], default: 'vendor' },
  allowedBookings: { type: Number, default: 0 }
}, {
  timestamps: true
})

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema)

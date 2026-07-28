import mongoose from 'mongoose'

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: String, default: 'per month' },
  description: { type: String, default: '' },
  features: [{ type: String }],
  buttonText: { type: String, default: 'Subscribe Now' },
  recommended: { type: Boolean, default: false },
  gradient: { type: String, default: 'from-[#7a280e] to-[#c45c26]' },
  shadow: { type: String, default: 'shadow-orange-500/20' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
})

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema)

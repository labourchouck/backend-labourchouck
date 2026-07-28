import { SubscriptionPlan } from '../models/SubscriptionPlan.js'
import { VendorSubscription } from '../models/VendorSubscription.js'

export const createSubscriptionPlan = async (req, res, next) => {
  try {
    const { name, price, duration, description, features, buttonText, recommended, gradient, shadow } = req.body
    
    let parsedFeatures = []
    if (Array.isArray(features)) {
      parsedFeatures = features
    } else if (typeof features === 'string') {
      parsedFeatures = features.split(',').map(f => f.trim()).filter(f => f)
    }

    const plan = await SubscriptionPlan.create({
      name,
      price,
      duration,
      description,
      features: parsedFeatures,
      buttonText,
      recommended,
      gradient: gradient || 'from-[#7a280e] to-[#c45c26]',
      shadow: shadow || 'shadow-orange-500/20'
    })

    res.status(201).json({ success: true, plan })
  } catch (error) {
    next(error)
  }
}

export const getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 })
    res.status(200).json({ success: true, plans })
  } catch (error) {
    next(error)
  }
}

export const getSubscriptionPlanById = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id)
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' })
    res.status(200).json({ success: true, plan })
  } catch (error) {
    next(error)
  }
}

export const updateSubscriptionPlan = async (req, res, next) => {
  try {
    const { name, price, duration, description, features, buttonText, recommended, gradient, shadow } = req.body
    
    let parsedFeatures = []
    if (Array.isArray(features)) {
      parsedFeatures = features
    } else if (typeof features === 'string') {
      parsedFeatures = features.split(',').map(f => f.trim()).filter(f => f)
    }

    const updateData = {
      name, price, duration, description, features: parsedFeatures, buttonText, recommended, gradient, shadow
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, updateData, { new: true })
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' })

    res.status(200).json({ success: true, plan })
  } catch (error) {
    next(error)
  }
}

export const deleteSubscriptionPlan = async (req, res, next) => {
  try {
    // Instead of hard delete, we can soft delete or actually delete
    // The user asked to "delete", so we'll hard delete
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id)
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' })

    res.status(200).json({ success: true, message: 'Plan deleted successfully' })
  } catch (error) {
    next(error)
  }
}

export const getVendorSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await VendorSubscription.find()
      .populate('vendor', 'fullName phone contractorProfile')
      .populate('plan', 'name price duration')
      .sort({ createdAt: -1 })
    
    res.status(200).json({ success: true, subscriptions })
  } catch (error) {
    next(error)
  }
}

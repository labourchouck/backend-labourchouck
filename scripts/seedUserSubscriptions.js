// scripts/seedUserSubscriptions.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { SubscriptionPlan } from '../src/models/SubscriptionPlan.js'
import { SystemSetting } from '../src/models/SystemSetting.js'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const plans = [
  {
    name: 'Basic Plan',
    price: 19,
    duration: '1 Month',
    description: 'Perfect for minimal usage',
    features: ['Book up to 3 services', 'Standard support'],
    buttonText: 'Subscribe ₹19',
    recommended: false,
    gradient: 'from-[#2e3192] to-[#1bffff]',
    shadow: 'shadow-blue-500/20',
    planType: 'individual',
    allowedBookings: 3
  },
  {
    name: 'Standard Plan',
    price: 39,
    duration: '1 Month',
    description: 'Most popular for regular users',
    features: ['Book up to 7 services', 'Priority support', 'Verified workers'],
    buttonText: 'Subscribe ₹39',
    recommended: true,
    gradient: 'from-[#ff758c] to-[#ff7eb3]',
    shadow: 'shadow-pink-500/20',
    planType: 'individual',
    allowedBookings: 7
  },
  {
    name: 'Premium Plan',
    price: 59,
    duration: '1 Month',
    description: 'For heavy users and pros',
    features: ['Book up to 15 services', '24/7 Premium support', 'Top-rated workers'],
    buttonText: 'Subscribe ₹59',
    recommended: false,
    gradient: 'from-[#f12711] to-[#f5af19]',
    shadow: 'shadow-orange-500/20',
    planType: 'individual',
    allowedBookings: 15
  }
]

async function seedUserSubscriptions() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB')

    // First delete any existing individual plans
    await SubscriptionPlan.deleteMany({ planType: 'individual' })
    console.log('Cleared existing individual plans')

    // Insert new plans
    await SubscriptionPlan.insertMany(plans)
    console.log('Inserted default individual plans')

    // Ensure toggle is created in SystemSettings
    let settings = await SystemSetting.findOne({ configKey: 'master_config' })
    if (!settings) {
      settings = new SystemSetting({ configKey: 'master_config', isUserSubscriptionEnabled: true })
      await settings.save()
    } else {
      settings.isUserSubscriptionEnabled = true
      await settings.save()
    }
    console.log('Enabled isUserSubscriptionEnabled in SystemSettings')

    console.log('Seeding completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('Error seeding data:', error)
    process.exit(1)
  }
}

seedUserSubscriptions()

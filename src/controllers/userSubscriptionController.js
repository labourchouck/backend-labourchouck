import { createOrder, verifyPaymentSignature } from '../services/paymentService.js'
import { SubscriptionPlan } from '../models/SubscriptionPlan.js'
import { UserSubscription } from '../models/UserSubscription.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const getIndividualPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true, planType: 'individual' }).sort({ price: 1 })
  return sendSuccess(res, { data: { plans } })
})

export const getCorporatePlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true, planType: 'corporate' }).sort({ price: 1 })
  return sendSuccess(res, { data: { plans } })
})

export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { planId } = req.body
  const plan = await SubscriptionPlan.findById(planId)
  
  if (!plan || !['individual', 'corporate'].includes(plan.planType)) {
    return sendError(res, { message: 'Invalid subscription plan', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const order = await createOrder(plan.price, 'INR', `sub_${Date.now()}`)
  return sendSuccess(res, { data: { order, keyId: process.env.RAZORPAY_KEY_ID || 'mock_key' } })
})

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body

  if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return sendError(res, { message: 'Payment verification failed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const plan = await SubscriptionPlan.findById(planId)
  if (!plan) {
    return sendError(res, { message: 'Plan not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Find existing active subscriptions to calculate remaining bookings
  const existingSubscriptions = await UserSubscription.find({ user: req.user.id, status: 'active' }).populate('plan')
  let carriedOverBookings = 0

  if (existingSubscriptions && existingSubscriptions.length > 0) {
    for (const sub of existingSubscriptions) {
      const allowed = sub.snapshotPlanDetails?.allowedBookings || sub.plan?.allowedBookings || 0
      const used = sub.bookingsUsed || 0
      const remaining = Math.max(0, allowed - used)
      carriedOverBookings += remaining
    }
  }

  // Deactivate any existing active subscriptions for this user
  await UserSubscription.updateMany(
    { user: req.user.id, status: 'active' },
    { $set: { status: 'expired' } }
  )

  const newSubscription = await UserSubscription.create({
    user: req.user.id,
    plan: plan._id,
    status: 'active',
    startDate: new Date(),
    bookingsUsed: 0,
    snapshotPlanDetails: {
      name: plan.name,
      price: plan.price,
      allowedBookings: plan.allowedBookings + carriedOverBookings
    }
  })

  return sendSuccess(res, { message: 'Subscription purchased successfully', data: { subscription: newSubscription } })
})

export const getMySubscription = asyncHandler(async (req, res) => {
  const subscription = await UserSubscription.findOne({ user: req.user.id, status: 'active' })
    .populate('plan', 'name price allowedBookings')
  
  return sendSuccess(res, { data: { subscription } })
})

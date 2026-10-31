import Razorpay from 'razorpay'
import crypto from 'crypto'

let razorpayInstance = null

/** Returns null when keys are missing so local development can fall back to mock orders. */
export const getRazorpayInstance = () => {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.warn('Razorpay keys not found in environment. Using mock mode.')
      return null
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  }
  return razorpayInstance
}

export const createOrder = async (amount, currency = 'INR', receipt = 'receipt#1') => {
  const instance = getRazorpayInstance()

  if (!instance) {
    return {
      id: `order_mock_${Date.now()}`,
      amount: Math.round(amount * 100),
      currency,
      receipt,
      status: 'created',
      mock: true,
    }
  }

  return instance.orders.create({
    amount: Math.round(amount * 100), // smallest currency unit (paise)
    currency,
    receipt,
  })
}

export const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return true // Mock mode (no keys configured)
  if (!orderId || !paymentId || !signature) return false

  const digest = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  const a = Buffer.from(digest)
  const b = Buffer.from(String(signature))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

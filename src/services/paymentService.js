import Razorpay from 'razorpay'
import crypto from 'crypto'

let razorpayInstance = null

const getRazorpayInstance = () => {
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
    // Mock successful order creation for MVP if keys are missing
    return {
      id: `order_mock_${Date.now()}`,
      amount: amount * 100,
      currency,
      receipt,
      status: 'created',
      mock: true
    }
  }

  const options = {
    amount: amount * 100, // amount in the smallest currency unit
    currency,
    receipt,
  }

  return await instance.orders.create(options)
}

export const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return true // Mock mode

  const shasum = crypto.createHmac('sha256', secret)
  shasum.update(`${orderId}|${paymentId}`)
  const digest = shasum.digest('hex')

  return digest === signature
}

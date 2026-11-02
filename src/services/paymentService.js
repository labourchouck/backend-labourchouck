import Razorpay from 'razorpay'
import crypto from 'crypto'

const isProduction = () => process.env.NODE_ENV === 'production'

/** Public key id (safe to send to the browser) — the same key that creates the orders. */
export const getKeyId = () => process.env.RAZORPAY_KEY_ID || null

export const isRazorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)

/** "rzp_test_Ab…" — enough to tell test from live in the logs without exposing the key. */
const maskKey = (id) => (id ? `${id.slice(0, 12)}…` : '(none)')

/** Thrown for payment set-up problems so the API can answer with a clear message instead of a vague 500. */
export class PaymentConfigError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'PaymentConfigError'
    this.statusCode = statusCode
  }
}

let startupLogged = false
const logStartupOnce = () => {
  if (startupLogged) return
  startupLogged = true
  if (isRazorpayConfigured()) {
    const mode = String(process.env.RAZORPAY_KEY_ID).startsWith('rzp_live_') ? 'LIVE' : 'TEST'
    console.log(`[PAYMENT] Razorpay ready in ${mode} mode (key ${maskKey(process.env.RAZORPAY_KEY_ID)})`)
  } else {
    console.warn(
      `[PAYMENT] Razorpay keys are NOT set (RAZORPAY_KEY_ID=${process.env.RAZORPAY_KEY_ID ? 'set' : 'missing'}, ` +
        `RAZORPAY_KEY_SECRET=${process.env.RAZORPAY_KEY_SECRET ? 'set' : 'missing'}). ` +
        (isProduction() ? 'Online payments are DISABLED in production until they are added.' : 'Using mock payments (development only).'),
    )
  }
}

let razorpayInstance = null

/** Returns null when keys are missing (development then falls back to mock orders; production refuses). */
export const getRazorpayInstance = () => {
  logStartupOnce()
  if (!razorpayInstance) {
    if (!isRazorpayConfigured()) return null
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
    // A fake order on a live server would let people "pay" without paying, so production refuses.
    if (isProduction()) {
      throw new PaymentConfigError('Online payments are not set up on the server yet. Please contact support.')
    }
    return {
      id: `order_mock_${Date.now()}`,
      amount: Math.round(amount * 100),
      currency,
      receipt,
      status: 'created',
      mock: true,
    }
  }

  try {
    const order = await instance.orders.create({
      amount: Math.round(amount * 100), // smallest currency unit (paise)
      currency,
      receipt,
    })
    console.log(`[PAYMENT] order ${order.id} created for ₹${amount} (key ${maskKey(process.env.RAZORPAY_KEY_ID)})`)
    return order
  } catch (error) {
    const detail = error?.error?.description || error?.message || 'unknown error'
    console.error(`[PAYMENT] Razorpay refused the order (HTTP ${error?.statusCode ?? '?'}): ${detail}`)
    // 401 = wrong/mismatched key id + secret; surface it clearly in the API instead of a blank 500.
    throw new PaymentConfigError(
      error?.statusCode === 401
        ? 'Payment gateway rejected the server keys. Please contact support.'
        : `Could not start the payment: ${detail}`,
      502,
    )
  }
}

export const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return !isProduction() // no secret: development mock mode only, never in production
  if (!orderId || !paymentId || !signature) return false

  const digest = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  const a = Buffer.from(digest)
  const b = Buffer.from(String(signature))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

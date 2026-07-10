import { PaymentTransaction } from '../models/PaymentTransaction.js'
import { Booking } from '../models/Booking.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { createOrder, verifyPaymentSignature } from '../services/paymentService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const initPayment = asyncHandler(async (req, res) => {
  const { amount, purpose, bookingId } = req.body

  if (purpose === 'BOOKING' && !bookingId) {
    return sendError(res, { message: 'bookingId is required for BOOKING purpose', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Generate Razorpay Order
  const receiptId = `rcpt_${req.user._id.toString().slice(-4)}_${Date.now().toString().slice(-4)}`
  const order = await createOrder(amount, 'INR', receiptId)

  // Record Transaction intent
  const pTx = await PaymentTransaction.create({
    userId: req.user._id,
    bookingId: purpose === 'BOOKING' ? bookingId : undefined,
    razorpayOrderId: order.id,
    amount,
    purpose,
    status: 'CREATED'
  })

  return sendSuccess(res, { data: { order, paymentTransactionId: pTx._id } })
})

export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body

  const pTx = await PaymentTransaction.findOne({ razorpayOrderId })
  if (!pTx) {
    return sendError(res, { message: 'Payment transaction not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)

  if (!isValid) {
    pTx.status = 'FAILED'
    await pTx.save()
    return sendError(res, { message: 'Payment verification failed', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  pTx.razorpayPaymentId = razorpayPaymentId
  pTx.razorpaySignature = razorpaySignature
  pTx.status = 'CAPTURED'
  await pTx.save()

  // Handle side-effects based on purpose
  if (pTx.purpose === 'BOOKING' && pTx.bookingId) {
    const booking = await Booking.findById(pTx.bookingId)
    if (booking) {
      booking.paymentStatus = 'PAID'
      await booking.save()
      
      // In Phase 4, Online Payment commission handling:
      // Since platform receives the money, the labor's selfWallet is credited the laborShare
      if (booking.status === 'COMPLETED') {
         let wallet = await Wallet.findOne({ userId: booking.laborId })
         if (!wallet) wallet = new Wallet({ userId: booking.laborId })
         wallet.selfBalance += booking.laborShare
         await wallet.save()

         await WalletTransaction.create({
            walletId: wallet._id,
            amount: booking.laborShare,
            type: 'CREDIT',
            targetWallet: 'SELF',
            context: 'PAYOUT',
            referenceId: booking._id,
            description: 'Online Payment Payout for Booking'
         })
      }
    }
  } else if (pTx.purpose === 'WALLET_CLEARANCE') {
    let wallet = await Wallet.findOne({ userId: req.user._id })
    if (wallet) {
      wallet.adminBalance = Math.max(0, wallet.adminBalance - pTx.amount)
      await wallet.save()

      await WalletTransaction.create({
        walletId: wallet._id,
        amount: pTx.amount,
        type: 'DEBIT',
        targetWallet: 'ADMIN',
        context: 'CLEARANCE',
        referenceId: pTx._id,
        description: 'Online Payment Clearance'
      })
    }
  }

  return sendSuccess(res, { message: 'Payment verified successfully', data: { pTx } })
})

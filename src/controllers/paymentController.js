import { PaymentTransaction } from '../models/PaymentTransaction.js'
import { Booking } from '../models/Booking.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { createOrder, verifyPaymentSignature } from '../services/paymentService.js'
import { sendToUser } from '../services/notificationService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const initPayment = asyncHandler(async (req, res) => {
  const { amount, purpose, bookingId } = req.body

  if (purpose === 'BOOKING' && !bookingId) {
    return sendError(res, { message: 'bookingId is required for BOOKING purpose', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (purpose === 'INVOICE' && !req.body.invoiceId) {
    return sendError(res, { message: 'invoiceId is required for INVOICE purpose', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (purpose === 'SUBSCRIPTION' && !req.body.planId) {
    return sendError(res, { message: 'planId is required for SUBSCRIPTION purpose', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (purpose === 'WORKFORCE_REQUEST' && !req.body.requestId) {
    return sendError(res, { message: 'requestId is required for WORKFORCE_REQUEST purpose', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Generate Razorpay Order
  const receiptId = `rcpt_${req.user._id.toString().slice(-4)}_${Date.now().toString().slice(-4)}`
  const order = await createOrder(amount, 'INR', receiptId)

  // Record Transaction intent
  const pTx = await PaymentTransaction.create({
    userId: req.user._id,
    bookingId: purpose === 'BOOKING' ? bookingId : undefined,
    invoiceId: purpose === 'INVOICE' ? req.body.invoiceId : undefined,
    planId: purpose === 'SUBSCRIPTION' ? req.body.planId : undefined,
    requestId: purpose === 'WORKFORCE_REQUEST' ? req.body.requestId : undefined,
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

    sendToUser(req.user._id, {
      title: 'Payment failed',
      body: `Your payment of ₹${pTx.amount} could not be verified. If money was deducted it will be refunded automatically.`,
      type: 'PAYMENT_FAILED',
      data: { paymentTransactionId: String(pTx._id) },
    }).catch(err => console.error('Push notify (payment failed) failed:', err))

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

         sendToUser(booking.laborId, {
            title: 'Payment received 💰',
            body: `₹${booking.laborShare} has been credited to your wallet for the completed job.`,
            type: 'WALLET_CREDITED',
            data: { bookingId: String(booking._id), amount: booking.laborShare, link: '/app/wallet' },
         }).catch(err => console.error('Push notify (payout) failed:', err))
      }

      sendToUser(booking.userId, {
        title: 'Payment successful',
        body: `Your payment of ₹${pTx.amount} for the booking was successful.`,
        type: 'PAYMENT_SUCCESS',
        data: { bookingId: String(booking._id), link: '/app/my-bookings' },
      }).catch(err => console.error('Push notify (payment success) failed:', err))
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
  } else if (pTx.purpose === 'INVOICE' && pTx.invoiceId) {
    const Invoice = (await import('../models/Invoice.js')).Invoice
    const invoice = await Invoice.findById(pTx.invoiceId)
    if (invoice) {
      invoice.status = 'paid'
      invoice.paidAt = new Date()
      await invoice.save()
    }
  } else if (pTx.purpose === 'SUBSCRIPTION' && pTx.planId) {
    const VendorSubscription = (await import('../models/VendorSubscription.js')).VendorSubscription
    const SubscriptionPlan = (await import('../models/SubscriptionPlan.js')).SubscriptionPlan
    const plan = await SubscriptionPlan.findById(pTx.planId)
    if (plan) {
      const durationLower = plan.duration?.toLowerCase() || ''
      let days = 30
      if (durationLower.includes('year')) days = 365
      else if (durationLower.includes('quarter')) days = 90
      
      await VendorSubscription.create({
        vendor: req.user._id,
        plan: plan._id,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      })
    }
  } else if (pTx.purpose === 'WORKFORCE_REQUEST' && pTx.requestId) {
    const WorkforceRequest = (await import('../models/WorkforceRequest.js')).WorkforceRequest
    const Invoice = (await import('../models/Invoice.js')).Invoice
    const Assignment = (await import('../models/Assignment.js')).Assignment
    
    const request = await WorkforceRequest.findById(pTx.requestId)
    if (request) {
      const baseAmount = (request.lines || []).reduce((sum, l) => sum + (l.adminPrice || 500) * (l.quantity || 1), 0)
      
      request.paymentStatus = 'PAID'
      request.status = 'completed'
      request.totalAmount = pTx.amount
      request.platformFee = pTx.amount - baseAmount - (request.taxAmount || 0)
      await request.save()
      
      const { generateInvoiceNumber } = await import('../models/Invoice.js')
      const existingInvoice = await Invoice.findOne({ requestId: request._id, corporateId: request.clientId })
      
      if (!existingInvoice) {
        await Invoice.create({
          invoiceNumber: generateInvoiceNumber(),
          corporateId: request.clientId,
          requestId: request._id,
          projectId: request.projectId,
          type: 'advance',
          status: 'paid',
          paidAt: new Date(),
          total: pTx.amount || 0,
          subtotal: baseAmount || 0,
          gstTotal: request.taxAmount || 0,
          lines: (request.lines || []).map(l => ({
            description: `Booking for ${l.quantity || 1}x Labour`,
            categoryId: l.categoryId,
            billableUnits: l.quantity || 1,
            amount: (l.adminPrice || 500) * (l.quantity || 1)
          }))
        })
      } else {
        await Invoice.updateMany({ requestId: request._id }, { status: 'paid', paidAt: new Date() })
      }
      
      await Assignment.updateMany({ requestId: request._id }, { status: 'COMPLETED' })

      if (request.sourceType === 'corporate') {
        const UserSubscription = (await import('../models/UserSubscription.js')).UserSubscription
        const activeSub = await UserSubscription.findOne({ user: request.clientId, status: 'active' })
        if (activeSub) {
          activeSub.bookingsUsed += 1
          await activeSub.save()
        }
      }
    }
  }

  return sendSuccess(res, { message: 'Payment verified successfully', data: { pTx } })
})

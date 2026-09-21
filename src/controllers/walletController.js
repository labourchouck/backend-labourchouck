import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { WithdrawalRequest } from '../models/WithdrawalRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import {
  creditSelfBalance,
  debitSelfBalance,
  getOrCreateWallet,
  getSelfBalance,
  listWalletTransactions,
} from '../services/walletService.js'
import { USER_ROLES } from '../constants/roles.js'
import mongoose from 'mongoose'

export const getMyWallet = asyncHandler(async (req, res) => {
  const wallet = await getOrCreateWallet(req.user._id)
  return sendSuccess(res, { data: { wallet } })
})

/** GET /wallets/transactions — the caller's own ledger, newest first. */
export const getMyTransactions = asyncHandler(async (req, res) => {
  const { page, limit } = req.query
  const result = await listWalletTransactions(req.user._id, { page, limit })
  return sendSuccess(res, { data: result })
})

export const clearAdminDues = asyncHandler(async (req, res) => {
  const { amount } = req.body
  const numAmount = Number(amount)

  if (isNaN(numAmount) || numAmount <= 0) {
    return sendError(res, { message: 'Valid positive amount is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const wallet = await Wallet.findOne({ userId: req.user._id })
  if (!wallet || wallet.adminBalance <= 0) {
    return sendError(res, { message: 'No pending dues to clear', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (numAmount > wallet.adminBalance) {
    return sendError(res, { message: `Cannot pay more than the pending due amount: ${wallet.adminBalance}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Simulate payment gateway logic here (In Phase 4 this would be replaced with actual gateway integration)
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    wallet.adminBalance -= numAmount
    await wallet.save({ session })

    await WalletTransaction.create([{
      walletId: wallet._id,
      amount: numAmount,
      type: 'DEBIT',
      targetWallet: 'ADMIN',
      context: 'CLEARANCE',
      description: 'Cleared admin dues via online payment'
    }], { session })

    await session.commitTransaction()
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }

  return sendSuccess(res, { message: 'Admin dues cleared successfully', data: { wallet } })
})

// Used internally by the Broadcast Engine / Booking Completion flow
export const checkWalletEligibility = async (userId) => {
  const wallet = await Wallet.findOne({ userId })
  if (!wallet) return true // New labor, no dues

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  
  // Need to know if they are a vendor or labour to apply the correct limit
  const User = mongoose.model('User')
  const user = await User.findById(userId).select('role')
  
  let limit = settings?.walletLimit ?? 100
  if (user && user.role === 'labour') {
    limit = settings?.labourCashLimit ?? 500
  } else if (user && user.role === 'contractor') {
    return true // Vendors no longer use cash limits
  }

  const currentDues = wallet.adminBalance || 0
  return currentDues <= limit
}

/**
 * Smallest payout we will process, in rupees. Applies to every role that
 * withdraws from a wallet, so a bank transfer is always worth the fee.
 */
export const MIN_WITHDRAWAL_AMOUNT = 100

/**
 * Customer payout. Unlike the labour flow this enforces the balance strictly
 * and moves the money with an atomic debit, so the ledger always explains the
 * balance and the same rupee cannot be withdrawn twice.
 */
async function requestUserWithdrawal(req, res) {
  const { amount, bankDetails } = req.body
  const numAmount = Number(amount)

  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return sendError(res, { message: 'Valid positive amount is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (numAmount < MIN_WITHDRAWAL_AMOUNT) {
    return sendError(res, {
      message: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL_AMOUNT}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'BELOW_MIN_AMOUNT',
    })
  }

  const { accountNumber, ifscCode, accountHolderName, bankName, qrCodeUrl } = bankDetails || {}
  if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
    return sendError(res, { message: 'Incomplete bank details', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const pending = await WithdrawalRequest.findOne({ userId: req.user._id, status: 'PENDING' })
  if (pending) {
    return sendError(res, {
      message: 'You already have a withdrawal request awaiting approval',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'PENDING_EXISTS',
    })
  }

  // Atomic: the balance check lives in the query, so this cannot overdraw.
  const debit = await debitSelfBalance({
    userId: req.user._id,
    amount: numAmount,
    context: 'WITHDRAWAL',
    description: 'Withdrawal requested — amount on hold',
  })
  if (!debit) {
    const balance = await getSelfBalance(req.user._id)
    return sendError(res, {
      message: `Insufficient wallet balance. You have ₹${balance}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INSUFFICIENT_BALANCE',
    })
  }

  let request
  try {
    request = await WithdrawalRequest.create({
      userId: req.user._id,
      requesterRole: USER_ROLES.INDIVIDUAL,
      amount: numAmount,
      bankDetails: { accountNumber, ifscCode, accountHolderName, bankName, qrCodeUrl },
      status: 'PENDING',
    })
  } catch (err) {
    // Never keep the hold if the request itself could not be recorded.
    await creditSelfBalance({
      userId: req.user._id,
      amount: numAmount,
      context: 'WITHDRAWAL',
      description: 'Withdrawal request failed — amount returned',
    }).catch((e) => console.error('[wallet] withdrawal rollback failed:', e?.message || e))
    throw err
  }

  import('../services/notificationService.js').then(({ notifyAdmins }) => {
    notifyAdmins({
      title: 'New customer withdrawal request',
      body: `${req.user.fullName || 'A customer'} requested a withdrawal of ₹${numAmount}.`,
      type: 'WITHDRAWAL_REQUESTED',
      data: { withdrawalId: String(request._id), link: '/admin/user-wallet' },
    }).catch((err) => console.error('Push notify (user withdrawal) failed:', err))
  })

  return sendSuccess(res, {
    message: 'Withdrawal request submitted successfully',
    statusCode: HTTP_STATUS.CREATED,
    data: { request, wallet: debit.wallet },
  })
}

export const requestWithdrawal = asyncHandler(async (req, res) => {
  if (req.user.role === USER_ROLES.INDIVIDUAL) {
    return requestUserWithdrawal(req, res)
  }

  const { amount, bankDetails } = req.body
  const numAmount = Number(amount)

  if (isNaN(numAmount) || numAmount <= 0) {
    return sendError(res, { message: 'Valid positive amount is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  if (numAmount < MIN_WITHDRAWAL_AMOUNT) {
    return sendError(res, {
      message: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL_AMOUNT}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'BELOW_MIN_AMOUNT',
    })
  }

  const { accountNumber, ifscCode, accountHolderName, bankName, qrCodeUrl } = bankDetails || {}

  if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
    return sendError(res, { message: 'Incomplete bank details', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  /**
   * Hold the amount. The balance check lives in the query filter, so the check
   * and the deduction are a single atomic step: a worker can never withdraw
   * more than they have, and two requests sent at once cannot both succeed on
   * the same rupees.
   *
   * No ledger row is written here on purpose. This flow records the DEBIT when
   * an admin approves the payout, and a rejection simply returns the hold.
   */
  const wallet = await Wallet.findOneAndUpdate(
    { userId: req.user._id, selfBalance: { $gte: numAmount } },
    { $inc: { selfBalance: -numAmount } },
    { new: true },
  )

  if (!wallet) {
    const existing = await Wallet.findOne({ userId: req.user._id }).select('selfBalance').lean()
    if (!existing) {
      return sendError(res, {
        message: 'Wallet not found',
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: 'WALLET_NOT_FOUND',
      })
    }
    return sendError(res, {
      message: `Insufficient wallet balance. You have ₹${existing.selfBalance || 0}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INSUFFICIENT_BALANCE',
    })
  }

  let request
  try {
    request = await WithdrawalRequest.create({
      labourId: req.user._id,
      requesterRole: req.user.role,
      amount: numAmount,
      bankDetails: { accountNumber, ifscCode, accountHolderName, bankName, qrCodeUrl },
      status: 'PENDING',
    })
  } catch (err) {
    // Release the hold rather than stranding the worker's money.
    await Wallet.updateOne({ userId: req.user._id }, { $inc: { selfBalance: numAmount } }).catch(
      (e) => console.error('[wallet] withdrawal hold rollback failed:', e?.message || e),
    )
    throw err
  }

  import('../services/notificationService.js').then(({ notifyAdmins }) => {
    notifyAdmins({
      title: 'New withdrawal request',
      body: `${req.user.fullName || 'A user'} requested a withdrawal of ₹${numAmount}.`,
      type: 'WITHDRAWAL_REQUESTED',
      data: { withdrawalId: String(request._id), link: '/admin/labour-wallet' },
    }).catch(err => console.error('Push notify (withdrawal request) failed:', err))
  })

  return sendSuccess(res, {
    message: 'Withdrawal request submitted successfully',
    data: { request, wallet },
  })
})

export const getMyWithdrawals = asyncHandler(async (req, res) => {
  // One user can only ever own rows through one of these fields, so an $or is
  // safe and keeps every role on a single endpoint.
  const requests = await WithdrawalRequest.find({
    $or: [
      { labourId: req.user._id },
      { vendorId: req.user._id },
      { userId: req.user._id },
    ],
  }).sort({ createdAt: -1 })
  return sendSuccess(res, { data: { requests } })
})

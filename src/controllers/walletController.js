import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { WithdrawalRequest } from '../models/WithdrawalRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import mongoose from 'mongoose'

export const getMyWallet = asyncHandler(async (req, res) => {
  let wallet = await Wallet.findOne({ userId: req.user._id })
  
  if (!wallet) {
    wallet = await Wallet.create({ userId: req.user._id })
  }

  return sendSuccess(res, { data: { wallet } })
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
  const limit = settings?.walletLimit ?? 100
  const currentDues = wallet.adminBalance || 0

  return currentDues <= limit
}

export const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankDetails } = req.body
  const numAmount = Number(amount)

  if (isNaN(numAmount) || numAmount <= 0) {
    return sendError(res, { message: 'Valid positive amount is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode) {
    return sendError(res, { message: 'Incomplete bank details', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const wallet = await Wallet.findOne({ userId: req.user._id }).session(session)
    if (!wallet) {
      throw new Error('Wallet not found')
    }

    if (wallet.selfBalance < numAmount) {
      throw new Error(`Insufficient wallet balance. You have ₹${wallet.selfBalance}`)
    }

    // Deduct amount immediately to hold it
    wallet.selfBalance -= numAmount
    await wallet.save({ session })

    // Create request
    const request = await WithdrawalRequest.create([{
      labourId: req.user._id,
      amount: numAmount,
      bankDetails,
      status: 'PENDING'
    }], { session })

    await session.commitTransaction()
    return sendSuccess(res, { message: 'Withdrawal request submitted successfully', data: { request: request[0], wallet } })
  } catch (error) {
    await session.abortTransaction()
    return sendError(res, { message: error.message, statusCode: HTTP_STATUS.BAD_REQUEST })
  } finally {
    session.endSession()
  }
})

export const getMyWithdrawals = asyncHandler(async (req, res) => {
  const requests = await WithdrawalRequest.find({ labourId: req.user._id }).sort({ createdAt: -1 })
  return sendSuccess(res, { data: { requests } })
})

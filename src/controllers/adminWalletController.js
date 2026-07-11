import { WithdrawalRequest } from '../models/WithdrawalRequest.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import mongoose from 'mongoose'

export const getAllWithdrawalRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const query = status ? { status } : {}
  const skip = (Number(page) - 1) * Number(limit)

  const requests = await WithdrawalRequest.find(query)
    .populate('labourId', 'name phone')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  const total = await WithdrawalRequest.countDocuments(query)

  return sendSuccess(res, {
    data: {
      requests,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    },
  })
})

export const processWithdrawalRequest = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, adminRemarks } = req.body

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return sendError(res, { message: 'Status must be APPROVED or REJECTED', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const request = await WithdrawalRequest.findById(id).session(session)
    if (!request) {
      throw new Error('Withdrawal request not found')
    }

    if (request.status !== 'PENDING') {
      throw new Error(`Request is already ${request.status}`)
    }

    const wallet = await Wallet.findOne({ userId: request.labourId }).session(session)
    if (!wallet) {
      throw new Error('Wallet not found for this user')
    }

    request.status = status
    if (adminRemarks) request.adminRemarks = adminRemarks

    if (status === 'REJECTED') {
      // Refund the held amount back to the labour's wallet
      wallet.selfBalance += request.amount
      await wallet.save({ session })
    } else if (status === 'APPROVED') {
      // Amount is already deducted, just create the transaction log
      await WalletTransaction.create([{
        walletId: wallet._id,
        amount: request.amount,
        type: 'DEBIT',
        targetWallet: 'BANK',
        context: 'WITHDRAWAL',
        description: `Withdrawal approved to bank. Remarks: ${adminRemarks || 'N/A'}`
      }], { session })
    }

    await request.save({ session })
    await session.commitTransaction()

    return sendSuccess(res, { message: `Withdrawal request ${status.toLowerCase()} successfully`, data: { request } })
  } catch (error) {
    await session.abortTransaction()
    return sendError(res, { message: error.message, statusCode: HTTP_STATUS.BAD_REQUEST })
  } finally {
    session.endSession()
  }
})

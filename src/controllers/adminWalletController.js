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
    .populate('labourId', 'fullName phone')
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

export const getAllVendorWithdrawalRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const query = status ? { status, vendorId: { $exists: true } } : { vendorId: { $exists: true } }
  const skip = (Number(page) - 1) * Number(limit)

  const requests = await WithdrawalRequest.find(query)
    .populate('vendorId', 'fullName phone companyName')
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

export const getVendorWalletStats = asyncHandler(async (req, res) => {
  const { Invoice } = await import('../models/Invoice.js')
  
  // 1. Get all vendor invoices
  const invoices = await Invoice.find({ vendorId: { $exists: true }, type: 'attendance' }).lean()
  
  // 2. Get all vendor withdrawals
  const withdrawals = await WithdrawalRequest.find({ vendorId: { $exists: true } }).lean()
  
  // 3. Calculate total booked amount
  let totalBooked = 0
  const balanceMap = new Map()

  invoices.forEach(inv => {
    const amount = inv.total || inv.totalAmount || 0
    totalBooked += amount
    const vId = inv.vendorId.toString()
    balanceMap.set(vId, (balanceMap.get(vId) || 0) + amount)
  })

  let totalPaidOut = 0
  let pendingAmount = 0

  withdrawals.forEach(w => {
    if (w.status === 'APPROVED') {
      totalPaidOut += (w.amount || 0)
      const vId = w.vendorId.toString()
      if (balanceMap.has(vId)) {
        balanceMap.set(vId, Math.max(0, balanceMap.get(vId) - w.amount))
      }
    } else if (w.status === 'PENDING') {
      pendingAmount += (w.amount || 0)
    }
  })

  const totalUnpaid = Math.max(0, totalBooked - totalPaidOut)

  // Populate vendor names for top balances
  const { User } = await import('../models/User.js')
  const vendorIds = Array.from(balanceMap.keys())
  const vendors = await User.find({ _id: { $in: vendorIds } }, 'fullName companyName').lean()
  
  const vendorNameMap = {}
  vendors.forEach(v => {
    vendorNameMap[v._id.toString()] = v.companyName || v.fullName || 'Unknown Vendor'
  })

  const topBalances = Array.from(balanceMap.entries())
    .map(([vId, balance]) => ({ name: vendorNameMap[vId] || 'Unknown Vendor', balance }))
    .filter(v => v.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)

  sendSuccess(res, {
    data: {
      stats: {
        totalUnpaid,
        pendingAmount,
        totalPaidOut,
        vendorBalances: topBalances
      }
    }
  })
})

export const getCollectedCommissionAmount = asyncHandler(async (req, res) => {
  const { AdminWallet } = await import('../models/AdminWallet.js')
  let adminWallet = await AdminWallet.findOne().lean()

  if (!adminWallet) {
    adminWallet = {
      totalCommissionsCollected: 0,
      totalPlatformFeesCollected: 0,
      totalServiceAmountCollected: 0,
    }
  }

  sendSuccess(res, {
    data: {
      commissionAmount: adminWallet.totalCommissionsCollected,
      platformFeesAmount: adminWallet.totalPlatformFeesCollected,
      serviceAmount: adminWallet.totalServiceAmountCollected,
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

    if (request.vendorId) {
      // Vendor logic: Vendors don't have a strict Wallet document that gets deducted.
      // Their balance is dynamically calculated. We just update the status.
      request.status = status
      if (adminRemarks) request.adminRemarks = adminRemarks
      await request.save({ session })
      await session.commitTransaction()
      return sendSuccess(res, { message: `Vendor withdrawal request ${status.toLowerCase()} successfully`, data: { request } })
    }

    // Labour logic: Labours have a Wallet document
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

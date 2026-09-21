import { WithdrawalRequest } from '../models/WithdrawalRequest.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { sendToUser } from '../services/notificationService.js'
import { creditSelfBalance } from '../services/walletService.js'
import mongoose from 'mongoose'

export const getAllWithdrawalRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  // Labour payouts only — vendor and customer requests have their own lists.
  const query = status
    ? { status, labourId: { $exists: true } }
    : { labourId: { $exists: true } }
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

/**
 * GET /admin/wallets/user-withdrawals — customer payout requests, plus the
 * headline numbers the admin page shows above the table.
 */
export const getAllUserWithdrawalRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const base = { userId: { $exists: true } }
  const query = status ? { ...base, status } : base
  const skip = (Number(page) - 1) * Number(limit)

  const [requests, total, summaryRows] = await Promise.all([
    WithdrawalRequest.find(query)
      .populate('userId', 'fullName phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    WithdrawalRequest.countDocuments(query),
    WithdrawalRequest.aggregate([
      { $match: base },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
  ])

  const summary = { pending: 0, pendingAmount: 0, approved: 0, paidOut: 0, rejected: 0 }
  for (const row of summaryRows) {
    if (row._id === 'PENDING') {
      summary.pending = row.count
      summary.pendingAmount = row.amount
    } else if (row._id === 'APPROVED') {
      summary.approved = row.count
      summary.paidOut = row.amount
    } else if (row._id === 'REJECTED') {
      summary.rejected = row.count
    }
  }

  return sendSuccess(res, {
    data: {
      requests,
      summary,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.max(1, Math.ceil(total / Number(limit))),
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

  /**
   * Customer payouts. The hold and its ledger row were written when the request
   * was made, so approving only records the decision and rejecting returns the
   * money. Claiming the row conditionally makes a double click harmless.
   */
  const existing = await WithdrawalRequest.findById(id).select('userId status').lean()
  if (existing?.userId) {
    const claimed = await WithdrawalRequest.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      {
        $set: {
          status,
          adminRemarks: adminRemarks || '',
          processedAt: new Date(),
          processedBy: req.user._id,
        },
      },
      { new: true },
    )
    if (!claimed) {
      return sendError(res, {
        message: 'This request has already been processed',
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'ALREADY_PROCESSED',
      })
    }

    if (status === 'REJECTED') {
      await creditSelfBalance({
        userId: claimed.userId,
        amount: claimed.amount,
        context: 'WITHDRAWAL',
        referenceId: claimed._id,
        description: `Withdrawal rejected — amount returned.${adminRemarks ? ` Remarks: ${adminRemarks}` : ''}`,
      })
    }

    sendToUser(claimed.userId, {
      title: status === 'APPROVED' ? 'Withdrawal approved' : 'Withdrawal rejected',
      body:
        status === 'APPROVED'
          ? `Your withdrawal of ₹${claimed.amount} has been approved and will be transferred to your bank.`
          : `Your withdrawal of ₹${claimed.amount} was rejected and returned to your wallet.${adminRemarks ? ` Remarks: ${adminRemarks}` : ''}`,
      type: `WITHDRAWAL_${status}`,
      data: { withdrawalId: String(claimed._id), link: '/app/wallet' },
    }).catch((err) => console.error('Push notify (customer withdrawal decision) failed:', err))

    return sendSuccess(res, {
      message: `Withdrawal request ${status.toLowerCase()} successfully`,
      data: { request: claimed },
    })
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

      sendToUser(request.labourId, {
        title: status === 'APPROVED' ? 'Withdrawal approved' : 'Withdrawal rejected',
        body: status === 'APPROVED'
          ? `Your withdrawal of ₹${request.amount} has been approved and will be transferred to your bank.`
          : `Your withdrawal of ₹${request.amount} was rejected.${adminRemarks ? ` Remarks: ${adminRemarks}` : ''}`,
        type: `WITHDRAWAL_${status}`,
        data: { withdrawalId: String(request._id), link: '/vendor/earnings' },
      }).catch(err => console.error('Push notify (vendor withdrawal decision) failed:', err))

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

    sendToUser(request.labourId, {
      title: status === 'APPROVED' ? 'Withdrawal approved' : 'Withdrawal rejected',
      body: status === 'APPROVED'
        ? `Your withdrawal of ₹${request.amount} has been approved and will be transferred to your bank.`
        : `Your withdrawal of ₹${request.amount} was rejected and refunded to your wallet.${adminRemarks ? ` Remarks: ${adminRemarks}` : ''}`,
      type: `WITHDRAWAL_${status}`,
      data: { withdrawalId: String(request._id), link: '/app/wallet' },
    }).catch(err => console.error('Push notify (withdrawal decision) failed:', err))

    return sendSuccess(res, { message: `Withdrawal request ${status.toLowerCase()} successfully`, data: { request } })
  } catch (error) {
    await session.abortTransaction()
    return sendError(res, { message: error.message, statusCode: HTTP_STATUS.BAD_REQUEST })
  } finally {
    session.endSession()
  }
})

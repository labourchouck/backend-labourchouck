import { Booking } from '../models/Booking.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { Wallet } from '../models/Wallet.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const calculateBill = asyncHandler(async (req, res) => {
  const { subcategoryId } = req.body
  const subcategory = await LabourSubcategory.findById(subcategoryId)
  if (!subcategory) {
    return sendError(res, { message: 'Subcategory not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = await SystemSetting.create({ configKey: 'master_config' })
  }

  const basePrice = subcategory.basePrice
  let platformFee = 0

  if (settings.platformFee.isActive) {
    if (settings.platformFee.type === 'fixed') {
      platformFee = settings.platformFee.value
    } else if (settings.platformFee.type === 'percentage') {
      platformFee = (basePrice * settings.platformFee.value) / 100
    }
  }

  const baseAmount = basePrice + platformFee
  let taxes = 0

  if (settings.gstPercentage > 0) {
    taxes = (baseAmount * settings.gstPercentage) / 100
  }

  const totalAmount = baseAmount + taxes

  // Also pre-calculate commission to show to admin internally, but user doesn't necessarily need to see it
  let commissionAmount = 0
  if (settings.commission.isActive && settings.commission.type === 'global') {
    commissionAmount = (totalAmount * settings.commission.globalPercentage) / 100
  }

  return sendSuccess(res, {
    data: {
      basePrice,
      platformFee,
      taxes,
      totalAmount,
      commissionAmount, // Internal calculation preview
      laborShare: baseAmount - commissionAmount
    }
  })
})

export const createBooking = asyncHandler(async (req, res) => {
  const { subcategoryId, type, scheduledAt, locationText, paymentMethod } = req.body

  if (type === 'SCHEDULED' && !scheduledAt) {
    return sendError(res, { message: 'scheduledAt is required for SCHEDULED bookings', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const subcategory = await LabourSubcategory.findById(subcategoryId)
  if (!subcategory || !subcategory.isActive) {
    return sendError(res, { message: 'Valid and active Subcategory required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  
  const basePrice = subcategory.basePrice
  let platformFee = 0
  if (settings?.platformFee?.isActive) {
    platformFee = settings.platformFee.type === 'fixed' 
      ? settings.platformFee.value 
      : (basePrice * settings.platformFee.value) / 100
  }
  
  const baseAmount = basePrice + platformFee
  let taxes = 0
  if (settings?.gstPercentage > 0) {
    taxes = (baseAmount * settings.gstPercentage) / 100
  }
  
  const totalAmount = baseAmount + taxes

  let commissionAmount = 0
  if (settings?.commission?.isActive && settings.commission.type === 'global') {
    commissionAmount = (totalAmount * settings.commission.globalPercentage) / 100
  }

  const laborShare = baseAmount - commissionAmount

  const booking = await Booking.create({
    userId: req.user._id,
    subcategoryId,
    type,
    scheduledAt: type === 'SCHEDULED' ? new Date(scheduledAt) : undefined,
    address: { locationText },
    basePrice,
    platformFee,
    taxes,
    totalAmount,
    commissionAmount,
    laborShare,
    paymentMethod,
    status: 'CREATED'
  })

  // Phase 3: Trigger the Broadcast Engine asynchronously
  // We use setImmediate or just fire and forget the async function
  import('../services/broadcastService.js').then(({ startBroadcastCycle }) => {
    startBroadcastCycle(booking._id).catch(err => console.error('Broadcast Error:', err))
  })

  return sendSuccess(res, { message: 'Booking created successfully', statusCode: HTTP_STATUS.CREATED, data: { booking } })
})

export const getBookingStatus = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('subcategoryId').populate('laborId', 'name phone profilePic').populate('userId', 'name phone')
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  return sendSuccess(res, { data: { booking } })
})

export const getMyBookings = asyncHandler(async (req, res) => {
  const { role, _id } = req.user
  
  // If user is a customer, fetch bookings they created
  // If user is a labor, fetch bookings assigned to them
  let query = {}
  if (role === 'USER') {
    query = { userId: _id }
  } else if (role === 'LABOUR' || role === 'CONTRACTOR') {
    query = { laborId: _id, status: { $in: ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED', 'COMPLETED', 'CANCELLED'] } }
  } else {
    return sendError(res, { message: 'Unauthorized role for fetching bookings', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const bookings = await Booking.find(query)
    .populate('subcategoryId')
    .populate('userId', 'name phone')
    .populate('laborId', 'name phone profilePic')
    .sort({ createdAt: -1 })
    .lean()

  return sendSuccess(res, { data: { bookings } })
})

export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status } = req.body
  const booking = await Booking.findById(id)
  
  if (!booking) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  
  if (String(booking.laborId) !== String(req.user._id) && String(booking.userId) !== String(req.user._id)) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const validTransitions = {
    'ACCEPTED': ['EN_ROUTE', 'CANCELLED'],
    'EN_ROUTE': ['STARTED', 'CANCELLED'],
    'STARTED': ['COMPLETED']
  }

  if (!validTransitions[booking.status]?.includes(status)) {
    return sendError(res, { message: `Invalid transition from ${booking.status} to ${status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  booking.status = status
  await booking.save()

  // Phase 4: Handle Commission if Cash Payment and Completed
  if (status === 'COMPLETED') {
    let wallet = await Wallet.findOne({ userId: booking.laborId })
    if (!wallet) wallet = new Wallet({ userId: booking.laborId })

    if (booking.paymentMethod === 'CASH') {
      // Increment labor's admin wallet liability
      wallet.adminBalance += booking.commissionAmount
      await wallet.save()

      import('../models/WalletTransaction.js').then(({ WalletTransaction }) => {
        WalletTransaction.create({
          walletId: wallet._id,
          amount: booking.commissionAmount,
          type: 'CREDIT',
          targetWallet: 'ADMIN',
          context: 'BOOKING',
          referenceId: booking._id,
          description: 'Commission for Cash Booking'
        }).catch(err => console.error('WalletTx error:', err))
      })
    } else if (booking.paymentMethod === 'ONLINE') {
      // Add laborShare to labor's self wallet
      wallet.selfBalance += booking.laborShare
      await wallet.save()

      import('../models/WalletTransaction.js').then(({ WalletTransaction }) => {
        WalletTransaction.create({
          walletId: wallet._id,
          amount: booking.laborShare,
          type: 'CREDIT',
          targetWallet: 'SELF',
          context: 'PAYOUT',
          referenceId: booking._id,
          description: 'Payout for Online Booking'
        }).catch(err => console.error('WalletTx error:', err))
      })
    }
  }

  // Phase 4: Handle Penalty if Cancelled by Labor after accepting
  if (status === 'CANCELLED' && String(req.user._id) === String(booking.laborId)) {
    let wallet = await Wallet.findOne({ userId: booking.laborId })
    if (!wallet) wallet = new Wallet({ userId: booking.laborId })
    
    const settings = await SystemSetting.findOne({ configKey: 'master_config' })
    const penaltyAmount = settings?.cancellationPenalty ?? 50
    wallet.adminBalance += penaltyAmount
    await wallet.save()
  }

  // Notify customer
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status })
  }).catch(err => console.error(err))

  return sendSuccess(res, { message: `Booking marked as ${status}`, data: { booking } })
})

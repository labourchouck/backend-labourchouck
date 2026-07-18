import { Booking } from '../models/Booking.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { Wallet } from '../models/Wallet.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { parseISTDateTime } from '../utils/dateHelper.js'

export const calculateBill = asyncHandler(async (req, res) => {
  const { serviceId, durationDays = 1 } = req.body
  const service = await LabourService.findById(serviceId)
  let basePrice = 0
  
  if (service) {
    basePrice = service.basePrice * durationDays
  } else {
    const { LabourCategory } = await import('../models/LabourCategory.js')
    const category = await LabourCategory.findById(serviceId)
    if (category) {
      basePrice = 800 * durationDays
    } else {
      return sendError(res, { message: 'Service or Category not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = await SystemSetting.create({ configKey: 'master_config' })
  }


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
  const { serviceId, type, scheduledAt, timeSlot, locationText, lat, lng, paymentMethod, notes, durationKind = 'full_day', durationDays = 1, imageNames = [] } = req.body

  if (!serviceId || !type || !locationText || !paymentMethod) {
    return sendError(res, { message: 'Missing required fields', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (lat === undefined || lng === undefined) {
    return sendError(res, { message: 'Latitude and Longitude are required for accurate matching', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (type === 'SCHEDULED' && (!scheduledAt || !timeSlot)) {
    return sendError(res, { message: 'scheduledAt date and timeSlot are required for SCHEDULED bookings', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const service = await LabourService.findById(serviceId)
  if (!service || !service.isActive) {
    return sendError(res, { message: 'Valid and active Service required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  
  const basePrice = service.basePrice * (durationKind === 'multi_day' ? durationDays : 1)
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

  const startOtp = Math.floor(1000 + Math.random() * 9000).toString()
  const completionOtp = Math.floor(1000 + Math.random() * 9000).toString()

  const booking = await Booking.create({
    userId: req.user._id,
    subcategoryId: service.subcategoryId,
    serviceId: service._id,
    type,
    scheduledAt: type === 'SCHEDULED' ? parseISTDateTime(scheduledAt, timeSlot) : undefined,
    timeSlot: type === 'SCHEDULED' ? timeSlot : undefined,
    images: Array.isArray(imageNames) ? imageNames : [],
    notes,
    durationKind,
    durationDays,
    address: { 
      locationText,
      coordinates: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)] // GeoJSON uses [longitude, latitude]
      }
    },
    basePrice,
    platformFee,
    taxes,
    totalAmount,
    commissionAmount,
    laborShare,
    paymentMethod,
    status: 'CREATED',
    startOtp,
    completionOtp
  })

  // Phase 3: Trigger the Broadcast Engine asynchronously
  // Only trigger immediately for INSTANT bookings.
  // SCHEDULED bookings will be handled by the broadcastCron job 30 mins before the time.
  if (type === 'INSTANT') {
    import('../services/broadcastService.js').then(({ startBroadcastCycle }) => {
      startBroadcastCycle(booking._id).catch(err => console.error('Broadcast Error:', err))
    })
  } else {
    // For scheduled, we can emit a socket event to let the user know it is confirmed and queued
    import('../socket.js').then(({ emitToUser }) => {
      emitToUser(booking.userId, 'BOOKING_SCHEDULED_QUEUED', { bookingId: booking._id, scheduledAt: booking.scheduledAt })
    }).catch(err => console.error(err))
  }

  // Save the address for future use if requested
  if (req.body.saveAddress) {
    import('../models/User.js').then(({ User }) => {
      User.findByIdAndUpdate(req.user._id, {
        'savedAddress.text': locationText,
        'savedAddress.lat': lat,
        'savedAddress.lng': lng
      }).catch(err => console.error('Update savedAddress error:', err))
    })
  }

  return sendSuccess(res, { message: 'Booking created successfully', statusCode: HTTP_STATUS.CREATED, data: { booking } })
})

export const getBookingStatus = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('subcategoryId')
    .populate('serviceId')
    .populate('laborId', 'fullName phone profileImageUrl')
    .populate('userId', 'fullName phone')
    .lean()

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Hide OTPs from labourer
  if (['labour', 'contractor'].includes(req.user.role)) {
    delete booking.startOtp
    delete booking.completionOtp
  }

  return sendSuccess(res, { data: { booking } })
})

export const getMyBookings = asyncHandler(async (req, res) => {
  const { role, _id } = req.user
  
  let query = {}
  if (role === 'individual' || role === 'corporate') {
    query = { userId: _id }
  } else if (role === 'labour' || role === 'contractor') {
    query = { laborId: _id, status: { $in: ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED', 'COMPLETED', 'CANCELLED'] } }
  } else {
    return sendError(res, { message: 'Unauthorized role for fetching bookings', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const bookings = await Booking.find(query)
    .populate('subcategoryId')
    .populate('serviceId')
    .populate('userId', 'fullName phone')
    .populate('laborId', 'fullName phone profileImageUrl')
    .sort({ createdAt: -1 })
    .lean()

  if (['labour', 'contractor'].includes(role)) {
    bookings.forEach(b => {
      delete b.startOtp
      delete b.completionOtp
    })
  }

  return sendSuccess(res, { data: { bookings } })
})

// @desc    Update booking payment method
// @route   PATCH /api/v1/bookings/:id/payment-method
// @access  Private (User)
export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body
  const booking = await Booking.findById(req.params.id)

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Only allow updating if it belongs to the user
  if (booking.userId.toString() !== req.user.id) {
    return sendError(res, { message: 'Not authorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  booking.paymentMethod = paymentMethod
  await booking.save()

  res.json({ success: true, paymentMethod })
})

export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, otp, startWorkImage, endWorkImage, beforeImage, afterImage } = req.body
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

  // OTP Verification
  if (status === 'STARTED') {
    if (!otp) return sendError(res, { message: 'OTP is required to start the job', statusCode: HTTP_STATUS.BAD_REQUEST })
    if (otp !== booking.startOtp) return sendError(res, { message: 'Invalid Start OTP', statusCode: HTTP_STATUS.BAD_REQUEST })
    const finalStartImg = startWorkImage || beforeImage
    if (finalStartImg) booking.startWorkImage = finalStartImg
  }

  if (status === 'COMPLETED') {
    if (!otp) return sendError(res, { message: 'OTP is required to complete the job', statusCode: HTTP_STATUS.BAD_REQUEST })
    if (otp !== booking.completionOtp) return sendError(res, { message: 'Invalid Completion OTP', statusCode: HTTP_STATUS.BAD_REQUEST })
    const finalEndImg = endWorkImage || afterImage
    if (finalEndImg) booking.endWorkImage = finalEndImg
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
      // ONLY payout if the customer has actually completed the online payment.
      // If they haven't paid yet, the paymentController will handle this payout later once they pay.
      if (booking.paymentStatus === 'PAID') {
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
  }

  // Notify customer
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status })
  }).catch(err => console.error(err))

  return sendSuccess(res, { message: `Booking marked as ${status}`, data: { booking } })
})

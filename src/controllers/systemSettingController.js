import { SystemSetting } from '../models/SystemSetting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const getSystemSettings = asyncHandler(async (req, res) => {
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = await SystemSetting.create({ configKey: 'master_config' })
  }
  return sendSuccess(res, { data: { settings } })
})

export const updatePlatformFees = asyncHandler(async (req, res) => {
  const { type, value, isActive, bookingType = 'B2C' } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  const targetObj = bookingType === 'B2B' ? settings.b2bPlatformFee : settings.platformFee
  
  if (type) targetObj.type = type
  if (value !== undefined) targetObj.value = Number(value)
  if (isActive !== undefined) targetObj.isActive = Boolean(isActive)
  
  await settings.save()
  return sendSuccess(res, { message: 'Platform fees updated', data: { settings } })
})

export const updateCommission = asyncHandler(async (req, res) => {
  const { type, globalPercentage, isActive, bookingType = 'B2C' } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  const targetObj = settings.commission
  
  if (type) targetObj.type = type
  if (globalPercentage !== undefined) targetObj.globalPercentage = Number(globalPercentage)
  if (isActive !== undefined) targetObj.isActive = Boolean(isActive)
  
  await settings.save()
  return sendSuccess(res, { message: 'Commission updated', data: { settings } })
})

export const updateWalletLimit = asyncHandler(async (req, res) => {
  const { walletLimit } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (walletLimit !== undefined) settings.walletLimit = Number(walletLimit)
  
  await settings.save()
  return sendSuccess(res, { message: 'Wallet limit updated', data: { settings } })
})

export const updateLabourCashLimit = asyncHandler(async (req, res) => {
  const { labourCashLimit } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (labourCashLimit !== undefined) settings.labourCashLimit = Number(labourCashLimit)
  
  await settings.save()
  return sendSuccess(res, { message: 'Labour cash limit updated', data: { settings } })
})



export const updateGstPercentage = asyncHandler(async (req, res) => {
  const { gstPercentage } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (gstPercentage !== undefined) settings.gstPercentage = Number(gstPercentage)
  
  await settings.save()
  return sendSuccess(res, { message: 'GST percentage updated', data: { settings } })
})

export const updateCancellationPenalty = asyncHandler(async (req, res) => {
  const { cancellationPenalty } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (cancellationPenalty !== undefined) settings.cancellationPenalty = Number(cancellationPenalty)
  
  await settings.save()
  return sendSuccess(res, { message: 'Cancellation penalty updated', data: { settings } })
})

export const updateTimeSlots = asyncHandler(async (req, res) => {
  const { timeSlots } = req.body
  if (!Array.isArray(timeSlots)) {
    return sendError(res, { message: 'timeSlots must be an array', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  settings.timeSlots = timeSlots
  await settings.save()
  return sendSuccess(res, { message: 'Time slots updated', data: { settings } })
})

export const updateUserSubscriptionToggle = asyncHandler(async (req, res) => {
  const { isUserSubscriptionEnabled } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (isUserSubscriptionEnabled !== undefined) {
    settings.isUserSubscriptionEnabled = Boolean(isUserSubscriptionEnabled)
  }
  
  await settings.save()
  return sendSuccess(res, { message: 'User subscription toggle updated', data: { settings } })
})

/**
 * PATCH /admin/settings/referral — Refer & Earn payout rules.
 * Every field is optional so the admin form can send partial updates.
 */
export const updateReferralSettings = asyncHandler(async (req, res) => {
  const {
    isActive,
    rewardTrigger,
    referrerReward,
    refereeReward,
    minBookingAmount,
    maxRewardsPerReferrer,
  } = req.body

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  if (!settings.referral) settings.referral = {}

  if (isActive !== undefined) settings.referral.isActive = Boolean(isActive)
  if (rewardTrigger) settings.referral.rewardTrigger = rewardTrigger
  if (referrerReward !== undefined) settings.referral.referrerReward = Number(referrerReward)
  if (refereeReward !== undefined) settings.referral.refereeReward = Number(refereeReward)
  if (minBookingAmount !== undefined) settings.referral.minBookingAmount = Number(minBookingAmount)
  if (maxRewardsPerReferrer !== undefined) {
    settings.referral.maxRewardsPerReferrer = Number(maxRewardsPerReferrer)
  }

  settings.updatedBy = req.user?._id
  await settings.save()
  return sendSuccess(res, { message: 'Referral settings updated', data: { settings } })
})

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
  const { type, value, isActive } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (type) settings.platformFee.type = type
  if (value !== undefined) settings.platformFee.value = Number(value)
  if (isActive !== undefined) settings.platformFee.isActive = Boolean(isActive)
  
  await settings.save()
  return sendSuccess(res, { message: 'Platform fees updated', data: { settings } })
})

export const updateCommission = asyncHandler(async (req, res) => {
  const { type, globalPercentage, isActive } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (type) settings.commission.type = type
  if (globalPercentage !== undefined) settings.commission.globalPercentage = Number(globalPercentage)
  if (isActive !== undefined) settings.commission.isActive = Boolean(isActive)
  
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

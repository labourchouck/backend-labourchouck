import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { createOtpChallenge, validateOtpChallenge, deleteOtpChallengeDoc } from '../services/otpService.js'
import { USER_ROLES } from '../constants/roles.js'
import VendorCrewLabour from '../models/VendorCrewLabour.js'

function requireApprovedVendor(user) {
  if (user.role !== USER_ROLES.CONTRACTOR) return 'Vendor account required'
  if (user.contractorProfile?.verificationStatus !== 'approved') {
    return 'Vendor must be verified before this action'
  }
  return null
}

import { User } from '../models/User.js'

export const requestOtp = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  
  const { phone } = req.body
  const digits = String(phone ?? '').replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) {
    return sendError(res, { message: 'Valid 10-digit phone required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  // Ensure this number is NOT an existing standard user (labour)
  const existingUser = await User.findOne({ phone: digits })
  if (existingUser) {
    return sendError(res, { message: 'This number is already registered as a standard user.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Ensure this number is NOT already in the vendor's crew
  const existingCrew = await VendorCrewLabour.findOne({ vendorId: req.user._id, phone: digits })
  if (existingCrew) {
    return sendError(res, { message: 'This number is already in your crew.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  const { challengeId } = await createOtpChallenge(digits, 'link_vendor_crew')
  sendSuccess(res, { data: { needsOtp: true, challengeId } })
})

export const verifyOtp = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })
  
  const { phone, code, challengeId } = req.body
  const digits = String(phone ?? '').replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) {
    return sendError(res, { message: 'Valid 10-digit phone required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  const otp = await validateOtpChallenge({ phone: digits, purpose: 'link_vendor_crew', code, challengeId })
  if (!otp.ok) {
    const map = {
      INVALID_CHALLENGE: 'OTP session invalid — request a new OTP',
      NO_OTP: 'Request OTP first',
      EXPIRED: 'OTP expired — request a new one',
      TOO_MANY_ATTEMPTS: 'Too many attempts — request a new OTP',
      INVALID_CODE: 'Invalid OTP',
    }
    return sendError(res, {
      message: map[otp.reason] || 'OTP verification failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: otp.reason,
    })
  }
  
  await deleteOtpChallengeDoc(otp.doc)
  sendSuccess(res, { message: 'OTP verified successfully', data: { phone: digits } })
})

export const createCrewLabour = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const { fullName, phone, address, city, state, category, services, status } = req.body
  
  if (!fullName || !phone) {
    return sendError(res, { message: 'Full name and phone are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const crewLabour = await VendorCrewLabour.create({
    vendorId: req.user._id,
    fullName,
    phone,
    address,
    city,
    state,
    category,
    services,
    status
  })

  sendSuccess(res, { message: 'Crew profile created successfully', data: { crewLabour }, statusCode: HTTP_STATUS.CREATED })
})

export const getAllCrewLabour = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const crew = await VendorCrewLabour.find({ vendorId: req.user._id }).sort({ createdAt: -1 })
  sendSuccess(res, { data: { crew } })
})

export const getCrewLabourById = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const crewLabour = await VendorCrewLabour.findOne({ _id: req.params.id, vendorId: req.user._id })
  if (!crewLabour) {
    return sendError(res, { message: 'Crew member not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  sendSuccess(res, { data: { crewLabour } })
})

export const updateCrewLabour = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const crewLabour = await VendorCrewLabour.findOneAndUpdate(
    { _id: req.params.id, vendorId: req.user._id },
    req.body,
    { new: true, runValidators: true }
  )

  if (!crewLabour) {
    return sendError(res, { message: 'Crew member not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  sendSuccess(res, { message: 'Crew profile updated successfully', data: { crewLabour } })
})

export const patchCrewLabour = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const crewLabour = await VendorCrewLabour.findOneAndUpdate(
    { _id: req.params.id, vendorId: req.user._id },
    { $set: req.body },
    { new: true, runValidators: true }
  )

  if (!crewLabour) {
    return sendError(res, { message: 'Crew member not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  sendSuccess(res, { message: 'Crew profile updated successfully', data: { crewLabour } })
})

export const deleteCrewLabour = asyncHandler(async (req, res) => {
  const err = requireApprovedVendor(req.user)
  if (err) return sendError(res, { message: err, statusCode: HTTP_STATUS.FORBIDDEN })

  const crewLabour = await VendorCrewLabour.findOneAndDelete({ _id: req.params.id, vendorId: req.user._id })
  if (!crewLabour) {
    return sendError(res, { message: 'Crew member not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  sendSuccess(res, { message: 'Crew member deleted successfully' })
})

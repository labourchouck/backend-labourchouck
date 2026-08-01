import { User } from '../models/User.js'
import VendorCrewLabour from '../models/VendorCrewLabour.js'
import { USER_ROLES } from '../constants/roles.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'

/**
 * GET /api/v1/admin/vendors/crew
 * Fetch all vendors and their associated crew members with category/service details.
 */
export const listVendorsAndCrew = asyncHandler(async (req, res) => {
  // 1. Get all approved vendors
  const vendors = await User.find({
    role: USER_ROLES.CONTRACTOR,
    'contractorProfile.verificationStatus': 'approved'
  }).select('fullName phone email contractorProfile.companyName contractorProfile.businessType').lean()

  // 2. Fetch all crew for all vendors in one go
  const vendorIds = vendors.map(v => v._id)
  
  const allCrew = await VendorCrewLabour.find({
    vendorId: { $in: vendorIds }
  }).lean()

  // 3. Group crew members by vendorId
  const crewByVendor = new Map()
  for (const crew of allCrew) {
    const vId = String(crew.vendorId)
    if (!crewByVendor.has(vId)) {
      crewByVendor.set(vId, [])
    }
    crewByVendor.get(vId).push(crew)
  }

  // 4. Attach crew to vendors
  const formattedVendors = vendors.map(vendor => ({
    ...vendor,
    crew: crewByVendor.get(String(vendor._id)) || []
  }))

  return sendSuccess(res, {
    message: 'Vendors and crew fetched successfully',
    data: { vendors: formattedVendors }
  })
})

export const updateVendorCrewVerification = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, rejectMessage, adminPrices } = req.body

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return sendError(res, { message: 'Invalid status', statusCode: 400 })
  }

  const crew = await VendorCrewLabour.findById(id)
  if (!crew) {
    return sendError(res, { message: 'Crew request not found', statusCode: 404 })
  }

  crew.verificationStatus = status
  
  if (status === 'rejected') {
    crew.rejectMessage = rejectMessage || ''
  } else {
    crew.rejectMessage = ''
  }

  // Update admin prices if provided
  if (adminPrices && Array.isArray(adminPrices)) {
    crew.services.forEach(service => {
      const match = adminPrices.find(p => p.name === service.name)
      if (match && typeof match.adminPrice === 'number') {
        service.adminPrice = match.adminPrice
      }
    })
  }

  await crew.save()

  return sendSuccess(res, {
    message: `Crew request ${status} successfully`,
    data: { crew }
  })
})

export const deleteVendorCrew = asyncHandler(async (req, res) => {
  const { id } = req.params

  const crew = await VendorCrewLabour.findByIdAndDelete(id)
  if (!crew) {
    return sendError(res, { message: 'Crew request not found', statusCode: 404 })
  }

  return sendSuccess(res, {
    message: 'Crew request deleted successfully'
  })
})

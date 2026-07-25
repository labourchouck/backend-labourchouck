import { User } from '../models/User.js'
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
  
  const allCrew = await User.find({
    role: USER_ROLES.LABOUR,
    vendorId: { $in: vendorIds }
  })
    .select('fullName phone email vendorId labourProfile.kycStatus labourProfile.categoryIds labourProfile.subcategoryIds labourProfile.serviceIds labourProfile.servicePricing')
    .populate('labourProfile.categoryIds', 'name')
    .populate('labourProfile.subcategoryIds', 'name')
    .populate('labourProfile.serviceIds', 'name')
    .populate('labourProfile.servicePricing.subcategoryId', 'name')
    .populate('labourProfile.servicePricing.serviceId', 'name')
    .lean()

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

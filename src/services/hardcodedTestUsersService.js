import { User } from '../models/User.js'
import { USER_ROLES, CORPORATE_STATUS, KYC_STATUS } from '../constants/roles.js'
import { HARDCODED_TEST_ACCOUNTS } from '../utils/phone.js'
import { LabourCategory } from '../models/LabourCategory.js'

/**
 * Ensures a single hardcoded test user exists in MongoDB.
 */
export async function ensureHardcodedTestUser(phone) {
  const config = HARDCODED_TEST_ACCOUNTS[phone]
  if (!config) return null

  let user = await User.findOne({ phone })
  if (!user) {
    const doc = {
      phone,
      role: config.role,
      fullName: config.fullName,
      isPhoneVerified: true,
      isActive: true,
      lastLoginAt: new Date(),
    }

    if (config.role === USER_ROLES.CORPORATE) {
      doc.corporateProfile = {
        companyName: config.fullName,
        gstNumber: '07AAAAA0000A1Z5',
        status: CORPORATE_STATUS.APPROVED,
        billingMode: 'postpaid',
        creditLimit: 500000,
      }
    } else if (config.role === USER_ROLES.CONTRACTOR) {
      doc.contractorProfile = {
        businessName: config.fullName,
        verificationStatus: 'approved',
        vendorType: 'sole_proprietor',
      }
    } else if (config.role === USER_ROLES.LABOUR) {
      // Find a category to assign if any exists
      const cat = await LabourCategory.findOne({ isActive: true }).select('_id').lean()
      doc.labourProfile = {
        kycStatus: KYC_STATUS.VERIFIED,
        categoryIds: cat ? [cat._id] : [],
        availabilityStatus: 'available',
      }
    }

    user = await User.create(doc)
    console.info(`[HardcodedAuth] Created test user ${config.role} (phone=${phone})`)
  } else {
    // Ensure role and active status are preserved
    let changed = false
    if (user.role !== config.role) {
      user.role = config.role
      changed = true
    }
    if (!user.isActive) {
      user.isActive = true
      changed = true
    }
    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true
      changed = true
    }

    if (config.role === USER_ROLES.CORPORATE && user.corporateProfile?.status !== CORPORATE_STATUS.APPROVED) {
      if (!user.corporateProfile) user.corporateProfile = {}
      user.corporateProfile.status = CORPORATE_STATUS.APPROVED
      if (!user.corporateProfile.companyName) user.corporateProfile.companyName = config.fullName
      changed = true
    } else if (config.role === USER_ROLES.CONTRACTOR && user.contractorProfile?.verificationStatus !== 'approved') {
      if (!user.contractorProfile) user.contractorProfile = {}
      user.contractorProfile.verificationStatus = 'approved'
      if (!user.contractorProfile.businessName) user.contractorProfile.businessName = config.fullName
      changed = true
    } else if (config.role === USER_ROLES.LABOUR && user.labourProfile?.kycStatus !== KYC_STATUS.VERIFIED) {
      if (!user.labourProfile) user.labourProfile = {}
      user.labourProfile.kycStatus = KYC_STATUS.VERIFIED
      changed = true
    }

    if (changed) {
      await user.save()
      console.info(`[HardcodedAuth] Updated test user ${config.role} (phone=${phone})`)
    }
  }

  return user
}

/**
 * Seeds or validates all hardcoded test accounts on server boot.
 */
export async function ensureAllHardcodedTestUsers() {
  try {
    for (const phone of Object.keys(HARDCODED_TEST_ACCOUNTS)) {
      await ensureHardcodedTestUser(phone)
    }
    console.info('[HardcodedAuth] All hardcoded test accounts ready (1111111111, 2222222222, 3333333333, 4444444444)')
  } catch (err) {
    console.error('[HardcodedAuth] Error seeding test accounts:', err.message)
  }
}

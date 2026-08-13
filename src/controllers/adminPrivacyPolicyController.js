import { PrivacyPolicy } from '../models/PrivacyPolicy.js'
import { USER_ROLES } from '../constants/roles.js'

const SEED_DATA = {
  [USER_ROLES.INDIVIDUAL]: `Privacy Policy for Individuals (Homeowners)

Welcome to LabourChowk!

1. Information We Collect: We collect your name, contact details, and location to facilitate service requests.
2. How We Use Your Data: Your data is used exclusively to connect you with verified labor and manage your bookings.
3. Data Sharing: We share your address only with the worker assigned to your task for the purpose of completing the job.
4. Data Security: Your payment details and personal data are encrypted and stored securely.`,

  [USER_ROLES.LABOUR]: `Privacy Policy for Labour (Workers)

Welcome to LabourChowk!

1. Information We Collect: We collect your identification documents, skills, location, and payment details for verification and payouts.
2. How We Use Your Data: Your profile data helps match you with suitable jobs and process your earnings.
3. Visibility: Your name and skill ratings will be visible to potential employers (individuals or vendors).
4. Data Security: Your KYC documents are stored securely and used only for compliance and verification purposes.`,

  [USER_ROLES.CONTRACTOR]: `Privacy Policy for Vendors (Contractors)

Welcome to LabourChowk!

1. Information We Collect: We collect your business registration, contact info, and workforce details.
2. How We Use Your Data: Your data is used to manage your corporate contracts, track your crew, and process settlements.
3. Data Sharing: Your business profile is visible to corporate clients seeking workforce supply.
4. Data Security: We protect your financial and business data using industry-standard security measures.`,

  [USER_ROLES.CORPORATE]: `Privacy Policy for Corporate Clients

Welcome to LabourChowk!

1. Information We Collect: We collect your company details, project sites, and billing information.
2. How We Use Your Data: We use this information to fulfill bulk workforce requests and manage invoicing.
3. Data Sharing: Project site details are shared with vendors and workers assigned to your projects.
4. Data Security: Your project requirements and financial transactions are strictly confidential and securely handled.`,
}

export const getPrivacyPolicies = async (req, res) => {
  try {
    let policies = await PrivacyPolicy.find({})
    
    // Seed missing policies
    const existingRoles = policies.map(p => p.role)
    const rolesToSeed = [USER_ROLES.INDIVIDUAL, USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.CORPORATE]
    
    const missingRoles = rolesToSeed.filter(r => !existingRoles.includes(r))
    
    if (missingRoles.length > 0) {
      const newPolicies = missingRoles.map(role => ({
        role,
        content: SEED_DATA[role] || '',
      }))
      await PrivacyPolicy.insertMany(newPolicies)
      policies = await PrivacyPolicy.find({})
    }

    res.status(200).json({
      status: 'success',
      data: policies,
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

export const updatePrivacyPolicy = async (req, res) => {
  try {
    const { role } = req.params
    const { content } = req.body

    if (!Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Invalid role' })
    }

    const updatedPolicy = await PrivacyPolicy.findOneAndUpdate(
      { role },
      { content, updatedBy: req.user._id },
      { new: true, upsert: true } // Upsert in case it was deleted
    )

    res.status(200).json({
      status: 'success',
      data: updatedPolicy,
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

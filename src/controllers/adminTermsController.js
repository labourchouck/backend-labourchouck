import { TermsAndCondition } from '../models/TermsAndCondition.js'
import { USER_ROLES } from '../constants/roles.js'

const SEED_DATA = {
  [USER_ROLES.INDIVIDUAL]: `Terms and Conditions for Individuals (Homeowners)

Welcome to LabourChowk!

By registering as an Individual/Homeowner, you agree to the following terms:

1. Service Requests: You agree to provide accurate descriptions of the tasks and location for any labour you hire through the platform.
2. Payments: All payments for services rendered must be settled as per the platform's payment guidelines. Booking amounts are non-refundable unless specified otherwise.
3. Safety and Environment: You must ensure a safe and non-hazardous working environment for the workers at your premises.
4. Dispute Resolution: Any disputes regarding the quality of work must be raised within 24 hours of task completion via the complaint section.`,

  [USER_ROLES.LABOUR]: `Terms and Conditions for Labour (Workers)

Welcome to LabourChowk!

By registering as a Worker on our platform, you agree to the following terms:

1. Profile Verification: You must provide accurate identification and skill details. Fake profiles will lead to immediate ban.
2. Job Acceptance: Once you accept a job match, you must arrive on time and complete the task to the best of your abilities.
3. Professionalism: Maintain professional conduct at the client's premises. Any reports of misconduct may result in account termination.
4. Earnings and Withdrawals: Your earnings will be credited to your wallet and can be withdrawn subject to the minimum withdrawal limits and processing times.`,

  [USER_ROLES.CONTRACTOR]: `Terms and Conditions for Vendors (Contractors)

Welcome to LabourChowk!

By registering as a Vendor/Contractor, you agree to the following terms:

1. Workforce Supply: You are responsible for ensuring that the crews you deploy are skilled, verified, and legally permitted to work.
2. Project Commitments: You must meet the timeline and workforce counts agreed upon with the corporate clients.
3. Payments & Commission: You agree to the platform's commission rates on contracts secured through LabourChowk.
4. Compliance: You must adhere to all local labor laws, including minimum wage and safety regulations for your deployed workers.`,

  [USER_ROLES.CORPORATE]: `Terms and Conditions for Corporate Clients

Welcome to LabourChowk!

By registering as a Corporate Client, you agree to the following terms:

1. Bulk Requisitions: You must provide clear and accurate project details, duration, and worker requirements for bulk workforce requests.
2. Billing and Invoices: You agree to clear invoices within the stipulated credit period to ensure uninterrupted supply of workforce.
3. Site Safety: You must ensure full compliance with occupational health and safety standards at your project sites.
4. Platform Fees: You agree to applicable platform fees and B2B processing charges as defined in your subscription or service agreement.`,
}

export const getTerms = async (req, res) => {
  try {
    let terms = await TermsAndCondition.find({})
    
    // Seed missing terms
    const existingRoles = terms.map(t => t.role)
    const rolesToSeed = [USER_ROLES.INDIVIDUAL, USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.CORPORATE]
    
    const missingRoles = rolesToSeed.filter(r => !existingRoles.includes(r))
    
    if (missingRoles.length > 0) {
      const newTerms = missingRoles.map(role => ({
        role,
        content: SEED_DATA[role] || '',
      }))
      await TermsAndCondition.insertMany(newTerms)
      terms = await TermsAndCondition.find({})
    }

    res.status(200).json({
      status: 'success',
      data: terms,
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

export const updateTerms = async (req, res) => {
  try {
    const { role } = req.params
    const { content } = req.body

    if (!Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Invalid role' })
    }

    const updatedTerm = await TermsAndCondition.findOneAndUpdate(
      { role },
      { content, updatedBy: req.user._id },
      { new: true, upsert: true } // Upsert in case it was deleted
    )

    res.status(200).json({
      status: 'success',
      data: updatedTerm,
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

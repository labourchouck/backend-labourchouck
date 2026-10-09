import { SupportPolicy } from '../models/SupportPolicy.js'
import { USER_ROLES } from '../constants/roles.js'
import { DEFAULT_SUPPORT_TEXT } from '../data/defaultLegalDocs.js'

export const getSupportPolicies = async (req, res) => {
  try {
    let policies = await SupportPolicy.find({})
    
    // Seed missing policies
    const existingRoles = policies.map(p => p.role)
    const rolesToSeed = [USER_ROLES.INDIVIDUAL, USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.CORPORATE]
    
    const missingRoles = rolesToSeed.filter(r => !existingRoles.includes(r))
    
    if (missingRoles.length > 0) {
      const newPolicies = missingRoles.map(role => ({
        role,
        content: DEFAULT_SUPPORT_TEXT,
      }))
      await SupportPolicy.insertMany(newPolicies)
      policies = await SupportPolicy.find({})
    }

    res.status(200).json({
      status: 'success',
      data: policies,
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

export const updateSupportPolicy = async (req, res) => {
  try {
    const { role } = req.params
    const { content } = req.body

    if (!Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({ status: 'error', message: 'Invalid role' })
    }

    const updatedPolicy = await SupportPolicy.findOneAndUpdate(
      { role },
      { content, updatedBy: req.user._id },
      { new: true, upsert: true }
    )

    res.status(200).json({
      status: 'success',
      data: updatedPolicy,
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

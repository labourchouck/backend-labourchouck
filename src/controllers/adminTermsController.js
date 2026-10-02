import { TermsAndCondition } from '../models/TermsAndCondition.js'
import { USER_ROLES } from '../constants/roles.js'
import { DEFAULT_TERMS_TEXT } from '../data/defaultLegalDocs.js'

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
        content: DEFAULT_TERMS_TEXT,
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

import { TermsAndCondition } from '../models/TermsAndCondition.js'

export const getTermsByRole = async (req, res) => {
  try {
    // If route is protected, we can use req.user.role. If public, query param.
    // Let's support both.
    const role = req.user?.role || req.query.role
    
    if (!role) {
      return res.status(400).json({ status: 'error', message: 'Role is required to fetch terms' })
    }

    const terms = await TermsAndCondition.findOne({ role })
    
    if (!terms) {
      return res.status(404).json({ status: 'error', message: 'Terms not found for this role' })
    }

    res.status(200).json({
      status: 'success',
      data: terms,
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

import { PrivacyPolicy } from '../models/PrivacyPolicy.js'

export const getPrivacyPolicy = async (req, res) => {
  try {
    const { role } = req.query
    
    if (!role) {
      return res.status(400).json({ status: 'error', message: 'Role is required' })
    }

    const policy = await PrivacyPolicy.findOne({ role })

    if (!policy) {
      return res.status(404).json({ status: 'error', message: 'Privacy policy not found for this role' })
    }

    res.status(200).json({
      status: 'success',
      data: policy,
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

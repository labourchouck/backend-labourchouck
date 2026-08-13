import { FAQ } from '../models/FAQ.js'

export const getFaqs = async (req, res, next) => {
  try {
    const faqs = await FAQ.find({ isActive: true }).sort({ order: 1, createdAt: -1 })
    
    res.status(200).json({
      success: true,
      faqs,
    })
  } catch (error) {
    next(error)
  }
}

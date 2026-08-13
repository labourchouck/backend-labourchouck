import { FAQ } from '../models/FAQ.js'

export const createFaq = async (req, res, next) => {
  try {
    const { question, answer, isActive, order } = req.body
    
    if (!question || !answer) {
      return res.status(400).json({ success: false, message: 'Question and answer are required' })
    }

    const faq = await FAQ.create({
      question,
      answer,
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0,
    })

    res.status(201).json({
      success: true,
      faq,
    })
  } catch (error) {
    next(error)
  }
}

export const getFaqs = async (req, res, next) => {
  try {
    const faqs = await FAQ.find().sort({ order: 1, createdAt: -1 })
    
    res.status(200).json({
      success: true,
      faqs,
    })
  } catch (error) {
    next(error)
  }
}

export const updateFaq = async (req, res, next) => {
  try {
    const { id } = req.params
    const { question, answer, isActive, order } = req.body

    const faq = await FAQ.findById(id)
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found' })
    }

    if (question !== undefined) faq.question = question
    if (answer !== undefined) faq.answer = answer
    if (isActive !== undefined) faq.isActive = isActive
    if (order !== undefined) faq.order = order

    await faq.save()

    res.status(200).json({
      success: true,
      faq,
    })
  } catch (error) {
    next(error)
  }
}

export const deleteFaq = async (req, res, next) => {
  try {
    const { id } = req.params
    const faq = await FAQ.findByIdAndDelete(id)
    
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found' })
    }

    res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully',
    })
  } catch (error) {
    next(error)
  }
}

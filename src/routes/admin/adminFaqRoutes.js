import express from 'express'
import { createFaq, getFaqs, updateFaq, deleteFaq } from '../../controllers/adminFaqController.js'
import { protect, restrictTo } from '../../middleware/auth.js'
import { USER_ROLES } from '../../constants/roles.js'

const router = express.Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/', getFaqs)
router.post('/', createFaq)
router.put('/:id', updateFaq)
router.delete('/:id', deleteFaq)

export default router

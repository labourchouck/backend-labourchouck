import { Router } from 'express'
import { body } from 'express-validator'
import { protect } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import * as complaint from '../controllers/complaintController.js'

const router = Router()

router.use(protect)

router.post(
  '/',
  [
    body('complaineeId').optional().isMongoId().withMessage('Valid complaineeId is required'),
    body('bookingId').optional().isMongoId(),
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
    body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 1000 }),
  ],
  validateRequest,
  complaint.submitComplaint,
)

router.get('/my', complaint.getMyComplaints)

export default router

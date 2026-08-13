import express from 'express'
import { getPrivacyPolicy } from '../controllers/privacyPolicyController.js'

const router = express.Router()

router.get('/', getPrivacyPolicy)

export default router

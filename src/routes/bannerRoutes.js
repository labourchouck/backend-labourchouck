import { Router } from 'express'
import * as banner from '../controllers/bannerController.js'

const router = Router()

// Public route to fetch active banners
router.get('/', banner.getActiveBanners)

export default router

import { Router } from 'express'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import labourCategoryRoutes from './labourCategoryRoutes.js'
import adminLabourCategoryRoutes from './adminLabourCategoryRoutes.js'
import buildmartRoutes from './buildmartRoutes.js'
import adminBuildmartRoutes from './adminBuildmartRoutes.js'
import uploadRoutes from './uploadRoutes.js'
import corporateRoutes from './corporateRoutes.js'
import vendorRoutes from './vendorRoutes.js'
import workforceRoutes from './workforceRoutes.js'
import adminWorkforceRoutes from './adminWorkforceRoutes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/uploads', uploadRoutes)
router.use('/labour-categories', labourCategoryRoutes)
router.use('/buildmart', buildmartRoutes)
router.use('/corporate', corporateRoutes)
router.use('/vendor', vendorRoutes)
router.use('/workforce', workforceRoutes)
router.use('/admin', adminLabourCategoryRoutes)
router.use('/admin', adminBuildmartRoutes)
router.use('/admin/workforce', adminWorkforceRoutes)

export default router

import { Router } from 'express'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import labourCategoryRoutes from './labourCategoryRoutes.js'
import adminLabourCategoryRoutes from './adminLabourCategoryRoutes.js'
import buildmartRoutes from './buildmartRoutes.js'
import uploadRoutes from './uploadRoutes.js'
import corporateRoutes from './corporateRoutes.js'
import vendorRoutes from './vendorRoutes.js'
import vendorBuildmartRoutes from './vendorBuildmartRoutes.js'
import workforceRoutes from './workforceRoutes.js'
import adminWorkforceRoutes from './adminWorkforceRoutes.js'
import systemSettingRoutes from './systemSettingRoutes.js'
import bookingRoutes from './bookingRoutes.js'
import walletRoutes from './walletRoutes.js'
import broadcastRoutes from './broadcastRoutes.js'
import paymentRoutes from './paymentRoutes.js'
import reviewRoutes from './reviewRoutes.js'

import adminZoneRoutes from './adminZoneRoutes.js'
import locationRoutes from './locationRoutes.js'
import adminWalletRoutes from './adminWalletRoutes.js'
import complaintRoutes from './complaintRoutes.js'
import adminComplaintRoutes from './adminComplaintRoutes.js'
import adminDashboardRoutes from './adminDashboardRoutes.js'
import bannerRoutes from './bannerRoutes.js'
import adminBannerRoutes from './adminBannerRoutes.js'
import adminReportsRoutes from './adminReportsRoutes.js'
import adminBuildmartRoutes from './adminBuildmartRoutes.js'
import adminBookingRoutes from './adminBookingRoutes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/uploads', uploadRoutes)
router.use('/labour-categories', labourCategoryRoutes)
router.use('/buildmart', buildmartRoutes)
router.use('/corporate', corporateRoutes)
router.use('/vendor', vendorRoutes)
router.use('/vendor/buildmart', vendorBuildmartRoutes)
router.use('/workforce', workforceRoutes)
router.use('/bookings', bookingRoutes)
router.use('/wallets', walletRoutes)
router.use('/broadcasts', broadcastRoutes)
router.use('/payments', paymentRoutes)
router.use('/reviews', reviewRoutes)
router.use('/complaints', complaintRoutes)
router.use('/banners', bannerRoutes)

router.use('/admin/settings', systemSettingRoutes)
router.use('/admin/zones', adminZoneRoutes)
router.use('/admin/workforce', adminWorkforceRoutes)
router.use('/admin/wallets', adminWalletRoutes)
router.use('/admin/complaints', adminComplaintRoutes)
router.use('/admin/dashboard', adminDashboardRoutes)
router.use('/admin/banners', adminBannerRoutes)
router.use('/admin/reports', adminReportsRoutes)
router.use('/admin/buildmart', adminBuildmartRoutes)
router.use('/admin/bookings', adminBookingRoutes)
router.use('/admin', adminLabourCategoryRoutes)
router.use('/labour/location', locationRoutes)

import { getCollectedCommissionAmount } from '../controllers/adminWalletController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
router.get('/admin/commission-fee', protect, restrictTo(USER_ROLES.ADMIN), getCollectedCommissionAmount)

export default router

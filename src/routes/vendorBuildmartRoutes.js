import { Router } from 'express'
import {
  createVendorProduct,
  getVendorProducts,
  getVendorProductById,
  updateVendorProduct,
  deleteVendorProduct,
  getVendorEnquiries,
  updateVendorEnquiryStatus,
} from '../controllers/vendorBuildmartController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'

const VENDOR_ROLES = [USER_ROLES.CONTRACTOR]

const router = Router()

// All routes are protected and restricted to vendors
router.use(protect, restrictTo(...VENDOR_ROLES))

router.get('/products', getVendorProducts)
router.get('/products/:id', getVendorProductById)
router.post('/products', createVendorProduct)
router.put('/products/:id', updateVendorProduct)
router.delete('/products/:id', deleteVendorProduct)

router.get('/enquiries', getVendorEnquiries)
router.patch('/enquiries/:id/status', updateVendorEnquiryStatus)

export default router

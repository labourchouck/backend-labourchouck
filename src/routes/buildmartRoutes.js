import { Router } from 'express'
import {
  submitQuoteRequest,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/buildmartController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { submitQuoteValidators } from '../validators/buildmartValidators.js'
import { APP_ROLES, ADMIN_ROLES } from '../constants/roles.js'

const router = Router()

router.post(
  '/quotes',
  protect,
  restrictTo(...APP_ROLES),
  submitQuoteValidators,
  validateRequest,
  submitQuoteRequest,
)

// --- Admin Catalog Routes ---

router.get('/admin/categories', protect, restrictTo(...ADMIN_ROLES), getCategories)
router.post('/admin/categories', protect, restrictTo(...ADMIN_ROLES), createCategory)
router.put('/admin/categories/:id', protect, restrictTo(...ADMIN_ROLES), updateCategory)
router.delete('/admin/categories/:id', protect, restrictTo(...ADMIN_ROLES), deleteCategory)

router.get('/admin/products', protect, restrictTo(...ADMIN_ROLES), getProducts)
router.post('/admin/products', protect, restrictTo(...ADMIN_ROLES), createProduct)
router.put('/admin/products/:id', protect, restrictTo(...ADMIN_ROLES), updateProduct)
router.delete('/admin/products/:id', protect, restrictTo(...ADMIN_ROLES), deleteProduct)

router.get('/admin/banners', protect, restrictTo(...ADMIN_ROLES), getBanners)
router.post('/admin/banners', protect, restrictTo(...ADMIN_ROLES), createBanner)
router.put('/admin/banners/:id', protect, restrictTo(...ADMIN_ROLES), updateBanner)
router.delete('/admin/banners/:id', protect, restrictTo(...ADMIN_ROLES), deleteBanner)

// --- App Catalog Routes (Public or authenticated) ---

router.get('/app/categories', getCategories)
router.get('/app/products', getProducts)
router.get('/app/banners', getBanners)

export default router

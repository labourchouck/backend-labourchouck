import { Router } from 'express'
import * as labourCategory from '../controllers/labourCategoryController.js'

const router = Router()

router.get('/grouped', labourCategory.listGrouped)

export default router

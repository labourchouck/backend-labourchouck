import { Router } from 'express'
import { protect } from '../middleware/auth.js'
import {
  handleMulterError,
  uploadDocumentMulter,
  uploadMediaMulter,
} from '../middleware/uploadMiddleware.js'
import * as upload from '../controllers/uploadController.js'

const router = Router()

router.use(protect)

router.get('/config', upload.getUploadConfig)

router.post(
  '/media',
  (req, res, next) => {
    uploadMediaMulter(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next)
      next()
    })
  },
  upload.uploadMedia,
)

router.post(
  '/document',
  (req, res, next) => {
    uploadDocumentMulter(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next)
      next()
    })
  },
  upload.uploadDocument,
)

export default router

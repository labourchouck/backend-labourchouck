import multer from 'multer'

const storage = multer.memoryStorage()

const MEDIA_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

const DOCUMENT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function mediaFilter(_req, file, cb) {
  if (MEDIA_MIMES.has(file.mimetype)) return cb(null, true)
  if (file.mimetype && (
    file.mimetype.startsWith('video/') || 
    file.mimetype.startsWith('image/') || 
    file.mimetype === 'application/octet-stream' || 
    file.mimetype === 'text/plain'
  )) {
    return cb(null, true)
  }
  cb(new Error(`Unsupported media type (${file.mimetype || 'unknown'}). Use JPEG, PNG, WebP, GIF, or MP4/WebM video.`))
}

function documentFilter(_req, file, cb) {
  if (DOCUMENT_MIMES.has(file.mimetype)) return cb(null, true)
  cb(new Error('Unsupported document type. Use JPEG, PNG, WebP, or PDF.'))
}

/** Images + short videos — max 50MB (KYC video); per-folder limits enforced in controller. */
export const uploadMediaMulter = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: mediaFilter,
}).single('file')

/** ID scans, PDFs — max 10MB */
export const uploadDocumentMulter = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: documentFilter,
}).single('file')

export function handleMulterError(err, _req, res, next) {
  if (!err) return next()
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File is too large for this upload type',
      code: 'FILE_TOO_LARGE',
    })
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: 'UPLOAD_ERROR',
    })
  }
  if (err.message?.includes('Unsupported')) {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: 'INVALID_FILE_TYPE',
    })
  }
  return next(err)
}

import {
  UPLOAD_FOLDERS,
  assertFolderAllowed,
  folderCatalogue,
} from '../constants/uploadFolders.js'
import { ensureCloudinary } from '../config/cloudinary.js'
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

const MEDIA_IMAGE_MAX = 8 * 1024 * 1024
const MEDIA_VIDEO_MAX = 50 * 1024 * 1024
const DOCUMENT_MAX = 10 * 1024 * 1024

function readFolder(req) {
  const raw = req.body?.folder ?? req.query?.folder
  return raw == null ? '' : String(raw).trim()
}

function assertFilePresent(req, res) {
  if (!req.file?.buffer?.length) {
    sendError(res, {
      message: 'Missing file — send multipart field "file"',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'NO_FILE',
    })
    return false
  }
  return true
}

function validateMediaFile(file, folder) {
  if (folder === UPLOAD_FOLDERS.KYC_VIDEOS) {
    if (!VIDEO_MIMES.has(file.mimetype)) {
      return 'KYC video folder accepts MP4, WebM, or MOV only'
    }
    if (file.size > MEDIA_VIDEO_MAX) {
      return 'Video must be under 50MB'
    }
    return null
  }
  if (!IMAGE_MIMES.has(file.mimetype)) {
    return 'This folder accepts images only (JPEG, PNG, WebP, GIF)'
  }
  if (file.size > MEDIA_IMAGE_MAX) {
    return 'Image must be under 8MB'
  }
  return null
}

function validateDocumentFile(file) {
  if (file.size > DOCUMENT_MAX) {
    return 'Document must be under 10MB'
  }
  return null
}

function resourceTypeForMedia(folder, mimetype) {
  if (folder === UPLOAD_FOLDERS.KYC_VIDEOS || VIDEO_MIMES.has(mimetype)) return 'video'
  return 'image'
}

function resourceTypeForDocument(mimetype) {
  if (mimetype === 'application/pdf') return 'raw'
  return 'image'
}

/** GET /uploads/config — allowed folders for the signed-in role */
export const getUploadConfig = asyncHandler(async (req, res) => {
  const catalogue = folderCatalogue()
  const roleKey = req.user.role
  const roleBlock = catalogue.byRole[roleKey] || { media: [], documents: [] }
  return sendSuccess(res, {
    data: {
      cloudinaryConfigured: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET,
      ),
      rootPrefix: catalogue.rootPrefix,
      mediaFolders: roleBlock.media,
      documentFolders: roleBlock.documents,
    },
  })
})

/** POST /uploads/media — profile photos, category tiles, job posters, KYC video */
export const uploadMedia = asyncHandler(async (req, res) => {
  ensureCloudinary()
  if (!assertFilePresent(req, res)) return

  const folder = readFolder(req)
  if (!folder) {
    return sendError(res, {
      message: 'folder is required (query or body)',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_FOLDER',
    })
  }

  try {
    assertFolderAllowed(req.user.role, folder, 'media')
  } catch (e) {
    return sendError(res, {
      message: e.message,
      statusCode: e.statusCode || HTTP_STATUS.BAD_REQUEST,
      code: e.code || 'INVALID_FOLDER',
    })
  }

  const mediaErr = validateMediaFile(req.file, folder)
  if (mediaErr) {
    return sendError(res, {
      message: mediaErr,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_FILE',
    })
  }

  const asset = await uploadBufferToCloudinary({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    folder,
    userId: req.user._id,
    originalName: req.file.originalname,
    resourceType: resourceTypeForMedia(folder, req.file.mimetype),
  })

  return sendSuccess(res, {
    message: 'Media uploaded',
    statusCode: HTTP_STATUS.CREATED,
    data: { asset },
  })
})

/** POST /uploads/document — Aadhaar, PAN, PDFs */
export const uploadDocument = asyncHandler(async (req, res) => {
  ensureCloudinary()
  if (!assertFilePresent(req, res)) return

  const folder = readFolder(req)
  if (!folder) {
    return sendError(res, {
      message: 'folder is required (query or body)',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_FOLDER',
    })
  }

  try {
    assertFolderAllowed(req.user.role, folder, 'document')
  } catch (e) {
    return sendError(res, {
      message: e.message,
      statusCode: e.statusCode || HTTP_STATUS.BAD_REQUEST,
      code: e.code || 'INVALID_FOLDER',
    })
  }

  const docErr = validateDocumentFile(req.file)
  if (docErr) {
    return sendError(res, {
      message: docErr,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_FILE',
    })
  }

  const asset = await uploadBufferToCloudinary({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    folder,
    userId: req.user._id,
    originalName: req.file.originalname,
    resourceType: resourceTypeForDocument(req.file.mimetype),
  })

  return sendSuccess(res, {
    message: 'Document uploaded',
    statusCode: HTTP_STATUS.CREATED,
    data: { asset },
  })
})

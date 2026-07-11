import crypto from 'crypto'
import { Readable } from 'stream'
import { getCloudinary } from '../config/cloudinary.js'
import { UPLOAD_ROOT_PREFIX } from '../constants/uploadFolders.js'

const SLUG_RE = /[^a-z0-9]+/gi

function slugifyBaseName(originalName) {
  const base = String(originalName || 'file')
    .replace(/\.[^.]+$/, '')
    .replace(SLUG_RE, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48)
  return base || 'file'
}

/** Unique Cloudinary path: `{root}/{folder}/{userId}/{ts}-{rand}-{name}` */
export function buildUploadPaths({ folder, userId, originalName }) {
  const uid = userId ? String(userId) : 'shared'
  const folderPath = `${UPLOAD_ROOT_PREFIX}/${folder}/${uid}`
  const publicId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${slugifyBaseName(originalName)}`
  return { folderPath, publicId }
}

function formatUploadResult(result, meta) {
  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    width: result.width ?? null,
    height: result.height ?? null,
    duration: result.duration ?? null,
    folder: meta.folder,
    originalName: meta.originalName,
    uploadedAt: new Date().toISOString(),
  }
}

/**
 * @param {{ buffer: Buffer, mimetype: string, folder: string, userId: string, originalName: string, resourceType?: 'image'|'video'|'raw'|'auto' }}
 */
export function uploadBufferToCloudinary({
  buffer,
  mimetype,
  folder,
  userId,
  originalName,
  resourceType = 'auto',
}) {
  const cloudinary = getCloudinary()
  const { folderPath, publicId } = buildUploadPaths({ folder, userId, originalName })

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
        unique_filename: false,
        use_filename: false,
      },
      (err, result) => {
        if (err) {
          const e = new Error(err.message || 'Cloudinary upload failed')
          e.statusCode = 400
          e.code = 'CLOUDINARY_UPLOAD_FAILED'
          e.cause = err
          return reject(e)
        }
        resolve(
          formatUploadResult(result, {
            folder,
            originalName: originalName || 'file',
          }),
        )
      },
    )
    Readable.from(buffer).pipe(stream)
  })
}

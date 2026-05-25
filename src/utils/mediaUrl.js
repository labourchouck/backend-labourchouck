const MAX_URL_LENGTH = 2048

/** HTTPS URLs from Cloudinary or other CDNs stored in MongoDB. */
export function isAllowedStoredMediaUrl(value) {
  if (value == null || value === '') return true
  const s = String(value).trim()
  if (!s) return true
  if (s.length > MAX_URL_LENGTH) return false
  if (!/^https:\/\//i.test(s)) return false
  return true
}

export function normalizeStoredMediaUrl(value) {
  if (value == null) return ''
  const s = String(value).trim()
  if (!s) return ''
  if (!isAllowedStoredMediaUrl(s)) return null
  return s
}

/** Prefer Cloudinary delivery URL for admin KYC review. */
export function kycImageForReview(labourProfile, side = 'front') {
  const lp = labourProfile || {}
  if (side === 'back') {
    return lp.kycBackImageUrl || lp.kycBackImageDataUrl || null
  }
  return lp.kycFrontImageUrl || lp.kycFrontImageDataUrl || null
}

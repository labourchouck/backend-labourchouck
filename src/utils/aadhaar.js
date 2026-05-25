import crypto from 'crypto'

/** Digits only, max 12 (no checksum in demo — add Verhoeff later if needed). */
export function normalizeAadhaar(input) {
  return String(input ?? '')
    .replace(/\D/g, '')
    .slice(0, 12)
}

export function isValidAadhaarLength(normalized) {
  return /^\d{12}$/.test(normalized)
}

export function fingerprintAadhaar(normalized12) {
  return crypto.createHash('sha256').update(normalized12, 'utf8').digest('hex')
}

/** Display mask: last 4 digits only visible. */
export function maskAadhaarLast4(normalized12) {
  const last4 = normalized12.slice(-4)
  return `XXXX XXXX ${last4}`
}

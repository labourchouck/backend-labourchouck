/**
 * Referral code helpers.
 *
 * Codes are short, uppercase and use an alphabet without the characters that
 * get misread when someone types a code off a WhatsApp message (0/O, 1/I/L).
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

/** @returns {string} a random code, e.g. "K7QM4XR2" */
export function generateReferralCode(length = CODE_LENGTH) {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

/**
 * Normalise anything a user typed or pasted into the canonical stored form.
 * Strips spaces and dashes, uppercases, and drops unsupported characters.
 * @param {unknown} value
 * @returns {string} '' when nothing usable is left
 */
export function normalizeReferralCode(value) {
  const raw = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!raw) return ''
  // Only keep it if every character is in our alphabet; otherwise it can never
  // match a stored code and we would rather fail fast with "invalid code".
  return raw
}

export function isPlausibleReferralCode(value) {
  const code = normalizeReferralCode(value)
  return code.length >= 4 && code.length <= 16
}

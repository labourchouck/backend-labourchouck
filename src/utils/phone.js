export const HARDCODED_TEST_ACCOUNTS = {
  '1111111111': { otp: '123456', role: 'individual', fullName: 'Demo Individual User' },
  '2222222222': { otp: '123456', role: 'labour', fullName: 'Demo Labour User' },
  '3333333333': { otp: '123456', role: 'contractor', fullName: 'Demo Vendor' },
  '4444444444': { otp: '123456', role: 'corporate', fullName: 'Demo Corporate User' },
}

/** Normalise to 10-digit Indian mobile without country code. */
export function normalizeIndianPhone(input) {
  if (input == null || typeof input !== 'string') return null
  let p = input.replace(/\D/g, '')
  if (p.length === 12 && p.startsWith('91')) p = p.slice(2)
  if (p.length === 11 && p.startsWith('0')) p = p.slice(1)
  if (p.length !== 10) return null
  if (HARDCODED_TEST_ACCOUNTS[p]) return p
  if (!/^[6-9]/.test(p)) return null
  return p
}

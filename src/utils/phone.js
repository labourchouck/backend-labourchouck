export const HARDCODED_TEST_ACCOUNTS = {
  '8643041429': { otp: '123456', role: 'individual', fullName: 'Individual User' },
  '7828394005': { otp: '123456', role: 'labour', fullName: 'Labour Worker' },
  '6267429441': { otp: '123456', role: 'contractor', fullName: 'Contractor Vendor' },
  '6263823004': { otp: '123456', role: 'corporate', fullName: 'Corporate Client' },
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

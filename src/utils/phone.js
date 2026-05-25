/** Normalise to 10-digit Indian mobile without country code. */
export function normalizeIndianPhone(input) {
  if (input == null || typeof input !== 'string') return null
  let p = input.replace(/\D/g, '')
  if (p.length === 12 && p.startsWith('91')) p = p.slice(2)
  if (p.length === 11 && p.startsWith('0')) p = p.slice(1)
  if (p.length !== 10 || !/^[6-9]/.test(p)) return null
  return p
}

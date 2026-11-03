/**
 * Per-day price of a crew member's service.
 * The admin can override the labour's own price (`adminPrice`). When the admin has not set one — missing, or saved
 * as 0 — the labour's own `price` is used, so a worker is never billed or shown as ₹0 just because no override exists.
 */
export function effectiveServicePrice(service) {
  const adminPrice = Number(service?.adminPrice)
  if (Number.isFinite(adminPrice) && adminPrice > 0) return adminPrice
  const ownPrice = Number(service?.price)
  return Number.isFinite(ownPrice) && ownPrice > 0 ? ownPrice : 0
}

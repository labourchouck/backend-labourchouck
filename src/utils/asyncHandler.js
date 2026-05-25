/**
 * Wrap async route handlers — avoids try/catch in every controller.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

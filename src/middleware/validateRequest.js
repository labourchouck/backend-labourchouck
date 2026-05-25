import { validationResult } from 'express-validator'
import { sendValidationError } from '../utils/apiResponse.js'

/**
 * Run after express-validator chains — use on every route that validates body/query/params.
 */
export function validateRequest(req, res, next) {
  const result = validationResult(req)
  if (!result.isEmpty()) {
    return sendValidationError(res, result.array())
  }
  next()
}

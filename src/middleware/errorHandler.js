import mongoose from 'mongoose'
import { HTTP_STATUS, sendError } from '../utils/apiResponse.js'

export function errorHandler(err, req, res, _next) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(err)
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
      code: 'MONGOOSE_VALIDATION',
    }))
    return sendError(res, {
      message: 'Validation failed',
      statusCode: HTTP_STATUS.UNPROCESSABLE,
      code: 'VALIDATION_ERROR',
      errors,
    })
  }

  if (err.code === 11000) {
    return sendError(res, {
      message: 'Duplicate entry',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'DUPLICATE_KEY',
    })
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return sendError(res, {
      message: 'Invalid or expired token',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'INVALID_TOKEN',
    })
  }

  const statusCode = err.statusCode || HTTP_STATUS.SERVER_ERROR
  return sendError(res, {
    message: err.message || 'Internal server error',
    statusCode,
    code: err.code || 'SERVER_ERROR',
  })
}

/**
 * Standard API envelope for all modules — keeps web + future mobile clients consistent.
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
}

/**
 * @param {import('express').Response} res
 * @param {object} options
 */
export function sendSuccess(res, { data = null, message = 'Success', statusCode = HTTP_STATUS.OK, meta = {} }) {
  const body = {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  }
  return res.status(statusCode).json(body)
}

/**
 * @param {import('express').Response} res
 * @param {object} options
 */
export function sendError(res, { message = 'Something went wrong', statusCode = HTTP_STATUS.BAD_REQUEST, code = 'ERROR', errors = null }) {
  const body = {
    success: false,
    message,
    code,
    errors,
    meta: {
      timestamp: new Date().toISOString(),
    },
  }
  return res.status(statusCode).json(body)
}

/** Normalise express-validator errors into { field, message, code } */
export function formatValidationErrors(validationResultArray) {
  return validationResultArray.map((e) => ({
    field: e.path ?? e.param ?? e.type,
    message: e.msg,
    code: 'VALIDATION_ERROR',
    value: e.value,
  }))
}

export function sendValidationError(res, validationResultArray) {
  return sendError(res, {
    message: 'Validation failed',
    statusCode: HTTP_STATUS.UNPROCESSABLE,
    code: 'VALIDATION_ERROR',
    errors: formatValidationErrors(validationResultArray),
  })
}

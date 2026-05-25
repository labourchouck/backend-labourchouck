import { body, param } from 'express-validator'
import { ROLE_LIST, USER_ROLES } from '../constants/roles.js'
import { normalizeIndianPhone } from '../utils/phone.js'

const appRegisterRoles = ROLE_LIST.filter((r) => r !== USER_ROLES.ADMIN)

export const validatePhoneBody = body('phone')
  .trim()
  .notEmpty()
  .withMessage('Phone is required')
  .custom((value) => {
    const n = normalizeIndianPhone(value)
    if (!n) throw new Error('Invalid Indian mobile number (10 digits, starts 6–9)')
    return true
  })
  .customSanitizer((value) => normalizeIndianPhone(value))

export const validateRoleRegister = body('role')
  .trim()
  .notEmpty()
  .withMessage('Role is required')
  .isIn(appRegisterRoles)
  .withMessage(`Role must be one of: ${appRegisterRoles.join(', ')}`)

export const validateOtpCode = body('code')
  .trim()
  .notEmpty()
  .withMessage('OTP is required')
  .isLength({ min: 6, max: 6 })
  .withMessage('OTP must be 6 digits')
  .isNumeric()
  .withMessage('OTP must be numeric')

/** Returned from request-otp — required on verify so accounts cannot complete without that OTP session */
export const validateOtpChallengeId = body('challengeId')
  .trim()
  .notEmpty()
  .withMessage('OTP session expired or missing — request a new OTP')
  .isMongoId()
  .withMessage('Invalid OTP session')

export const validateFullNameOptional = body('fullName').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Name length 2–120')

export const validateFullNameRequired = body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ min: 2, max: 120 })

export const validateCorporateFields = [
  body('companyName')
    .if(body('role').equals(USER_ROLES.CORPORATE))
    .trim()
    .notEmpty()
    .withMessage('Company name is required for corporate accounts'),
  body('gstNumber')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 15, max: 15 })
    .withMessage('GST must be 15 characters'),
]

export const validateContractorBusiness = body('businessName')
  .if(body('role').equals(USER_ROLES.CONTRACTOR))
  .trim()
  .notEmpty()
  .withMessage('Business name is required for contractor accounts')

export const validateAdminLogin = [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
]

export const validateUserIdParam = param('id').isMongoId().withMessage('Invalid user id')

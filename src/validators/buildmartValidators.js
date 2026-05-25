import { body } from 'express-validator'

export const submitQuoteValidators = [
  body('productId').trim().notEmpty().withMessage('Product is required'),
  body('productName').trim().notEmpty().withMessage('Product name is required'),
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Enter your name'),
  body('phone')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Enter a valid 10-digit mobile number'),
  body('siteLocation').trim().isLength({ min: 3, max: 500 }).withMessage('Enter site location'),
  body('quantity').trim().isLength({ min: 1, max: 120 }).withMessage('Enter quantity'),
  body('deliveryDate').optional({ values: 'null' }).trim().isLength({ max: 32 }),
  body('notes').optional({ values: 'null' }).trim().isLength({ max: 2000 }),
  body('variantId').optional({ values: 'null' }).trim().isLength({ max: 64 }),
  body('variantLabel').optional({ values: 'null' }).trim().isLength({ max: 120 }),
]

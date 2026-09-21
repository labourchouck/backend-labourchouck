import { Router } from 'express'
import { body } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as wallet from '../controllers/walletController.js'

const router = Router()

router.use(protect)

/** Every app role has a wallet: labour earn payouts, everyone can earn referral credit. */
const WALLET_HOLDER_ROLES = [
  USER_ROLES.LABOUR,
  USER_ROLES.CONTRACTOR,
  USER_ROLES.INDIVIDUAL,
  USER_ROLES.CORPORATE,
]

router.get('/me', restrictTo(...WALLET_HOLDER_ROLES), wallet.getMyWallet)

router.get('/transactions', restrictTo(...WALLET_HOLDER_ROLES), wallet.getMyTransactions)

router.post(
  '/clear',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  [
    body('amount').isNumeric().withMessage('Amount is required'),
  ],
  validateRequest,
  wallet.clearAdminDues,
)

router.post(
  '/withdraw',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.INDIVIDUAL),
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Valid positive amount is required'),
    body('bankDetails.accountNumber').trim().notEmpty().withMessage('Account number is required'),
    body('bankDetails.ifscCode').trim().notEmpty().withMessage('IFSC code is required'),
    body('bankDetails.accountHolderName').trim().notEmpty().withMessage('Account holder name is required'),
    body('bankDetails.bankName').trim().notEmpty().withMessage('Bank name is required'),
  ],
  validateRequest,
  wallet.requestWithdrawal,
)

router.get(
  '/withdrawals',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.INDIVIDUAL),
  wallet.getMyWithdrawals,
)

export default router

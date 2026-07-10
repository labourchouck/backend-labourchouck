import mongoose from 'mongoose'

const walletTransactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    targetWallet: {
      type: String,
      enum: ['SELF', 'ADMIN'],
      required: true,
    },
    context: {
      type: String,
      enum: ['BOOKING', 'CLEARANCE', 'INCENTIVE', 'PENALTY', 'PAYOUT', 'MANUAL'],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
)

export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema)

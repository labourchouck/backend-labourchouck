import mongoose from 'mongoose'

const adminWalletSchema = new mongoose.Schema(
  {
    totalPlatformFeesCollected: {
      type: Number,
      default: 0,
    },
    totalCommissionsCollected: {
      type: Number,
      default: 0,
    },
    totalServiceAmountCollected: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

export const AdminWallet = mongoose.model('AdminWallet', adminWalletSchema)

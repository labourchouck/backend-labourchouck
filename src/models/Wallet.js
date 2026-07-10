import mongoose from 'mongoose'

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    selfBalance: {
      type: Number,
      default: 0,
    },
    adminBalance: {
      type: Number,
      default: 0, // Amount owed to admin
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

export const Wallet = mongoose.model('Wallet', walletSchema)

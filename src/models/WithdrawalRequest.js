import mongoose from 'mongoose'

const withdrawalRequestSchema = new mongoose.Schema(
  {
    labourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    /** Customer (individual) payouts — wallet credit cashed out to a bank account */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    /** Which of the three id fields above is set. Absent on rows created before customer payouts. */
    requesterRole: {
      type: String,
      enum: ['labour', 'contractor', 'individual'],
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    adminRemarks: {
      type: String,
      default: '',
    },
    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String,
      qrCodeUrl: String,
    },
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema)

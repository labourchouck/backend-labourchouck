import mongoose from 'mongoose'

const allocationSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkforceRequest',
      required: true,
      index: true,
    },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vendorAcceptedAt: Date,
    deployedAt: Date,
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
)

export const Allocation = mongoose.model('Allocation', allocationSchema)

import mongoose from 'mongoose'

const vendorCrewLabourSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    services: [
      {
        name: { type: String, trim: true },
        price: { type: Number },
        adminPrice: { type: Number },
        priceDifference: { type: Number },
      }
    ],
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectMessage: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
)

export const VendorCrewLabour = mongoose.model('VendorCrewLabour', vendorCrewLabourSchema)
export default VendorCrewLabour


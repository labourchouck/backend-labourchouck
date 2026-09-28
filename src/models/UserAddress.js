import mongoose from 'mongoose'

const userAddressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, trim: true, maxlength: 40, default: 'Other' },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { timestamps: true },
)

userAddressSchema.index({ userId: 1, address: 1 }, { unique: true })

export const UserAddress = mongoose.model('UserAddress', userAddressSchema)

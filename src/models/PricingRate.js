import mongoose from 'mongoose'
import { REQUEST_SOURCE } from '../constants/workforceConstants.js'

const pricingRateSchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory', required: true, index: true },
    clientType: {
      type: String,
      enum: [...Object.values(REQUEST_SOURCE), 'contractor'],
      default: REQUEST_SOURCE.INDIVIDUAL,
    },
    corporateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ratePerShift: { type: Number, required: true, min: 0 },
    workerRatePerShift: { type: Number, min: 0 },
    gstPercent: { type: Number, default: 18, min: 0, max: 100 },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const PricingRate = mongoose.model('PricingRate', pricingRateSchema)

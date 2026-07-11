import mongoose from 'mongoose'

const labourServiceSchema = new mongoose.Schema(
  {
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourSubcategory',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    basePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedDurationMins: {
      type: Number,
      default: 60,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    iconUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
)

// Ensure service names are unique within a subcategory
labourServiceSchema.index({ subcategoryId: 1, name: 1 }, { unique: true })

export const LabourService = mongoose.model('LabourService', labourServiceSchema)

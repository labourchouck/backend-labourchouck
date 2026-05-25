import mongoose from 'mongoose'

/** profile = how the worker is classified; trade = concrete job types for matching */
export const LABOUR_GROUP_KIND = {
  PROFILE: 'profile',
  TRADE: 'trade',
}

const labourCategoryGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true, default: '' },
    /** Shown in worker onboarding to explain why we ask */
    helperText: { type: String, trim: true, default: '' },
    kind: {
      type: String,
      enum: Object.values(LABOUR_GROUP_KIND),
      default: LABOUR_GROUP_KIND.TRADE,
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const LabourCategoryGroup = mongoose.model('LabourCategoryGroup', labourCategoryGroupSchema)

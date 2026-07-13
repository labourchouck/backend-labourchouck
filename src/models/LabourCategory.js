import mongoose from 'mongoose'

const labourCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategoryGroup' },
    /** Short line for cards (optional) */
    subtitle: { type: String, trim: true, default: '' },
    /** Cloudinary or other HTTPS URL for homeowner home tiles */
    imageUrl: { type: String, default: '', maxlength: 2048 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

labourCategorySchema.index({ sortOrder: 1 })

export const LabourCategory = mongoose.model('LabourCategory', labourCategorySchema)

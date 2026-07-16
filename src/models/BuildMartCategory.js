import mongoose from 'mongoose'

const buildMartCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: { type: String },
    image: { type: String },
    color: { type: String }
  },
  { timestamps: true }
)

export const BuildMartCategory = mongoose.model('BuildMartCategory', buildMartCategorySchema)

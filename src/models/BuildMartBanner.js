import mongoose from 'mongoose'

const buildMartBannerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    image: { type: String }, // fallback alias
    title: { type: String },
    subtitle: { type: String },
    cta: { type: String },
    categoryId: { type: String },
    gradient: { type: String },
    active: { type: Boolean, default: true },
    link: { type: String }
  },
  { timestamps: true }
)

export const BuildMartBanner = mongoose.model('BuildMartBanner', buildMartBannerSchema)

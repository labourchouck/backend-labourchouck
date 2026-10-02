import mongoose from 'mongoose'

const buildMartBannerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    image: { type: String, default: '' }, // fallback alias
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    cta: { type: String, default: '' },
    categoryId: { type: String, default: '' },
    gradient: { type: String, default: '' },
    active: { type: Boolean, default: true },
    // Carousel position: lower shows first (ties fall back to creation order).
    sortOrder: { type: Number, default: 0 },
    link: { type: String, default: '' }
  },
  { timestamps: true }
)

export const BuildMartBanner = mongoose.model('BuildMartBanner', buildMartBannerSchema)

import mongoose from 'mongoose'

const buildMartBannerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    title: { type: String },
    link: { type: String }
  },
  { timestamps: true }
)

export const BuildMartBanner = mongoose.model('BuildMartBanner', buildMartBannerSchema)

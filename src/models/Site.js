import mongoose from 'mongoose'

const siteSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    corporateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    geo: {
      lat: Number,
      lng: Number,
    },
    contactName: { type: String, trim: true },
    contactPhone: { type: String, trim: true, maxlength: 10 },
  },
  { timestamps: true },
)

export const Site = mongoose.model('Site', siteSchema)

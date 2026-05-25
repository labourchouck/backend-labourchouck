import mongoose from 'mongoose'

const buildMartLeadSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    variantId: { type: String, trim: true },
    variantLabel: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    siteLocation: { type: String, required: true, trim: true },
    quantity: { type: String, required: true, trim: true },
    deliveryDate: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['new', 'contacted', 'quoted', 'won', 'lost'],
      default: 'new',
    },
    source: { type: String, default: 'buildmart_app', trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userRole: { type: String, trim: true },
    userName: { type: String, trim: true },
  },
  { timestamps: true },
)

buildMartLeadSchema.index({ createdAt: -1 })
buildMartLeadSchema.index({ status: 1, createdAt: -1 })

export const BuildMartLead = mongoose.model('BuildMartLead', buildMartLeadSchema)

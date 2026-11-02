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
    /** Every status the request has been through, newest last — shown to the requester as "updates". */
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: ['new', 'contacted', 'quoted', 'won', 'lost'], required: true },
        note: { type: String, trim: true, maxlength: 300 },
        by: { type: String, trim: true },
        byName: { type: String, trim: true },
        at: { type: Date, default: Date.now },
      },
    ],
    source: { type: String, default: 'buildmart_app', trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userRole: { type: String, trim: true },
    userName: { type: String, trim: true },
  },
  { timestamps: true },
)

buildMartLeadSchema.index({ createdAt: -1 })
buildMartLeadSchema.index({ status: 1, createdAt: -1 })
buildMartLeadSchema.index({ vendorId: 1, createdAt: -1 })

export const BuildMartLead = mongoose.model('BuildMartLead', buildMartLeadSchema)

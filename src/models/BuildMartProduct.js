import mongoose from 'mongoose'

const buildMartVariantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    size: { type: String },
    unit: { type: String },
    retailPrice: { type: Number, required: true },
    contractorPrice: { type: Number, required: true },
    bulkPrice: { type: Number },
    moq: { type: Number },
  },
  { _id: false }
)

const buildMartProductSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    categoryId: { type: String, required: true },
    shortDescription: { type: String, default: '' },
    description: { type: String, default: '' },
    images: [{ type: String }],
    specs: [
      {
        label: { type: String },
        value: { type: String },
      },
    ],
    deliveryInfo: { type: String, default: '' },
    availability: {
      type: String,
      enum: ['in_stock', 'limited', 'preorder'],
      default: 'in_stock',
    },
    supplier: {
      type: new mongoose.Schema({
        name: { type: String, default: '' },
        rating: { type: Number, default: 0 },
        city: { type: String, default: '' }
      }, { _id: false }),
      default: () => ({ name: '', rating: 0, city: '' })
    },
    variants: { type: [buildMartVariantSchema], default: [] },
    variantCount: { type: Number, default: 0 },
    priceLabel: { type: String, required: true },
    relatedIds: [{ type: String }],
  },
  { timestamps: true }
)

export const BuildMartProduct = mongoose.model('BuildMartProduct', buildMartProductSchema)

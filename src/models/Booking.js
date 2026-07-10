import mongoose from 'mongoose'

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    laborId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourSubcategory',
      required: true,
    },
    type: {
      type: String,
      enum: ['INSTANT', 'SCHEDULED'],
      required: true,
    },
    scheduledAt: {
      type: Date,
    },
    address: {
      locationText: { type: String, required: true, trim: true },
      // Could add lat/lng for geospatial querying
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
    basePrice: { type: Number, required: true },
    platformFee: { type: Number, required: true, default: 0 },
    taxes: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    commissionAmount: { type: Number, required: true, default: 0 },
    laborShare: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['ONLINE', 'CASH'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'REFUNDED'],
      default: 'PENDING',
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'CREATED',
        'BROADCASTING',
        'ACCEPTED',
        'ASSIGNED',
        'EN_ROUTE',
        'STARTED',
        'COMPLETED',
        'CANCELLED',
        'REFUNDED',
        'FAILED',
      ],
      default: 'CREATED',
      index: true,
    },
    broadcastRadius: { type: Number },
    eligibleLabourCount: { type: Number, default: 0 },
    acceptedLabourId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

bookingSchema.index({ 'address.coordinates': '2dsphere' })

export const Booking = mongoose.model('Booking', bookingSchema)

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
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourService',
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
    timeSlot: {
      type: String,
    },
    endTime: {
      type: String,
    },
    images: {
      type: [String],
      default: []
    },
    notes: { 
      type: String, 
      trim: true 
    },
    durationKind: {
      type: String,
      enum: ['few_hours', 'full_day', 'multi_day'],
      default: 'full_day'
    },
    durationDays: {
      type: Number,
      default: 1
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
    /**
     * Wallet credit spent on this booking. `totalAmount` stays the full price so
     * the worker's share and the platform's fees never change; the discount is
     * absorbed by the platform and only reduces what the customer pays.
     */
    walletDiscount: { type: Number, default: 0, min: 0 },
    /** What the customer actually pays: totalAmount - walletDiscount */
    payableAmount: { type: Number, default: 0 },
    /** Set once the discount has been returned to the wallet after a cancellation */
    walletRefundedAt: Date,
    /** Set once a CASH worker has been topped up for a discount the customer did not hand over */
    walletTopUpAt: Date,
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
    /** Labourers who declined this broadcast (used to fail-fast when everyone declines) */
    rejectedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    startOtp: { type: String },
    completionOtp: { type: String },
    startWorkImage: { type: String },
    endWorkImage: { type: String },
    attendanceLog: [{
      dateStr: String, // e.g., "YYYY-MM-DD"
      dayNumber: Number,
      startOtp: String,
      startOtpVerifiedAt: Date,
      endOtp: String,
      endOtpVerifiedAt: Date
    }],
  },
  { timestamps: true }
)

bookingSchema.index({ 'address.coordinates': '2dsphere' })

export const Booking = mongoose.model('Booking', bookingSchema)

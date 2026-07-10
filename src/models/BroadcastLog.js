import mongoose from 'mongoose'

const broadcastLogSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    laborId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'TIMEOUT'],
      default: 'PENDING',
    },
    broadcastedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

// Ensure a labor only gets one active broadcast log per booking at a time
broadcastLogSchema.index({ bookingId: 1, laborId: 1 }, { unique: true })

export const BroadcastLog = mongoose.model('BroadcastLog', broadcastLogSchema)

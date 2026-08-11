import mongoose from 'mongoose'

/**
 * Persistent in-app notification. Every push/socket notification is also
 * stored here so users can see history and unread counts, and so events
 * fired while a user was offline are not lost.
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, trim: true, maxlength: 1000 },
    /** Machine-readable event type, e.g. BOOKING_ACCEPTED, B2B_DIRECT_REQUEST, WALLET_CREDITED */
    type: { type: String, required: true, trim: true, index: true },
    /** Arbitrary payload for deep-linking (bookingId, requestId, invoiceId, ...) */
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
    readAt: Date,
  },
  { timestamps: true },
)

notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, read: 1 })

export const Notification = mongoose.model('Notification', notificationSchema)

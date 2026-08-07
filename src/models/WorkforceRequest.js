import mongoose from 'mongoose'
import {
  REQUEST_SOURCE,
  REQUEST_STATUS,
  BILLING_MODE,
} from '../constants/workforceConstants.js'

const requestLineSchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourSubcategory' },
    categoryName: { type: String, trim: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourService' },
    serviceName: { type: String, trim: true },
    adminPrice: { type: Number, default: 0 },
    vendorPrice: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: true },
)

const workforceRequestSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, index: true },
    sourceType: {
      type: String,
      enum: Object.values(REQUEST_SOURCE),
      required: true,
      index: true,
    },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },

    startDate: { type: Date, required: true },
    endDate: Date,
    shiftStart: String,
    lines: [requestLineSchema],
    locationText: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    billingMode: {
      type: String,
      enum: Object.values(BILLING_MODE),
      default: BILLING_MODE.POSTPAID,
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING_REVIEW,
      index: true,
    },
    bookingType: { type: String, trim: true },
    bookingMode: {
      type: String,
      enum: ['instant', 'schedule'],
      default: 'schedule'
    },
    scheduleTime: { type: String, trim: true },
    adminNote: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    preferredVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    preferredCrewIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VendorCrewLabour' }],
    
    // Financial Tracking
    paymentMethod: {
      type: String,
      enum: ['ONLINE', 'CASH'],
      default: 'ONLINE',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID'],
      default: 'PENDING',
    },
    totalAmount: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

workforceRequestSchema.index({ status: 1, createdAt: 1 })

export const WorkforceRequest = mongoose.model('WorkforceRequest', workforceRequestSchema)

export function generateRequestReference(prefix = 'WR') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

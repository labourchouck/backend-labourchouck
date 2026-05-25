import mongoose from 'mongoose'
import {
  REQUEST_SOURCE,
  REQUEST_STATUS,
  SCHEDULE_TYPE,
  BILLING_MODE,
} from '../constants/workforceConstants.js'

const requestLineSchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory', required: true },
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
    scheduleType: {
      type: String,
      enum: Object.values(SCHEDULE_TYPE),
      default: SCHEDULE_TYPE.DAILY,
    },
    startDate: { type: Date, required: true },
    endDate: Date,
    shiftStart: String,
    shiftEnd: String,
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
    adminNote: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true },
)

workforceRequestSchema.index({ status: 1, createdAt: 1 })

export const WorkforceRequest = mongoose.model('WorkforceRequest', workforceRequestSchema)

export function generateRequestReference(prefix = 'WR') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

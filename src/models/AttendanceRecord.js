import mongoose from 'mongoose'
import { ATTENDANCE_STATUS } from '../constants/workforceConstants.js'

const attendanceRecordSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkforceRequest',
      required: true,
      index: true,
    },
    allocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Allocation',
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    labourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorCrewLabour',
      required: true,
      index: true,
    },
    labourName: { type: String, trim: true },
    labourCategory: { type: String, trim: true },
    labourServiceName: { type: String, trim: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    shiftDate: { type: Date, required: true, index: true },
    shiftDateStr: { type: String, required: true, index: true }, // e.g. "YYYY-MM-DD"
    
    // 4-Stage Multi-Day Check-in / Check-out workflow
    // Step 1: Vendor dispatches / sends labour to site
    vendorCheckIn: { type: Boolean, default: false },
    vendorCheckInAt: Date,
    
    // Step 2: Client confirms arrival / marks on-site
    clientCheckIn: { type: Boolean, default: false },
    clientCheckInAt: Date,
    
    // Step 3: Client marks work completed / shift ended
    clientCheckOut: { type: Boolean, default: false },
    clientCheckOutAt: Date,
    
    // Step 4: Vendor marks shift closed / labour returned
    vendorCheckOut: { type: Boolean, default: false },
    vendorCheckOutAt: Date,

    // Legacy fields for backward compatibility
    checkInAt: Date,
    checkOutAt: Date,

    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.SCHEDULED,
      index: true,
    },
    billableUnits: { type: Number, default: 0, min: 0 },
    verifiedBy: { type: String, default: 'system' },
    verifiedAt: Date,
    notes: { type: String, trim: true, maxlength: 300 },
    adminPricePerDay: { type: Number, default: 0 },
    vendorPricePerDay: { type: Number, default: 0 },
  },
  { timestamps: true },
)

attendanceRecordSchema.index({ requestId: 1, shiftDateStr: 1, labourId: 1 }, { unique: true })
attendanceRecordSchema.index({ vendorId: 1, shiftDateStr: 1 })
attendanceRecordSchema.index({ clientId: 1, shiftDateStr: 1 })

export const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema)

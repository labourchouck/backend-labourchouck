import mongoose from 'mongoose'
import { ATTENDANCE_STATUS } from '../constants/workforceConstants.js'

const attendanceRecordSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkforceRequest', required: true, index: true },
    labourId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    shiftDate: { type: Date, required: true, index: true },
    checkInAt: Date,
    checkOutAt: Date,
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.ABSENT,
    },
    billableUnits: { type: Number, default: 0, min: 0 },
    verifiedBy: { type: String, enum: ['admin', 'vendor_supervisor', 'auto', 'labour'], default: 'labour' },
    verifiedAt: Date,
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
)

attendanceRecordSchema.index({ shiftDate: 1, requestId: 1 })

export const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema)

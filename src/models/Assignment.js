import mongoose from 'mongoose'
import { ASSIGNMENT_STATUS } from '../constants/workforceConstants.js'

const assignmentSchema = new mongoose.Schema(
  {
    allocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Allocation',
      required: true,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkforceRequest',
      required: true,
      index: true,
    },
    labourId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory' },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUS),
      default: ASSIGNMENT_STATUS.OFFERED,
      index: true,
    },
    replacedAssignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    replaceReason: { type: String, trim: true, maxlength: 300 },
    offeredAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
)

export const Assignment = mongoose.model('Assignment', assignmentSchema)

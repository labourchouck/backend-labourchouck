import mongoose from 'mongoose'
import { PROJECT_STATUS } from '../constants/workforceConstants.js'

const projectSchema = new mongoose.Schema(
  {
    corporateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(PROJECT_STATUS),
      default: PROJECT_STATUS.ACTIVE,
    },
    startDate: Date,
    endDate: Date,
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
)

projectSchema.index({ corporateId: 1, createdAt: -1 })

export const Project = mongoose.model('Project', projectSchema)

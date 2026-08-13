import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'

const privacyPolicySchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
      unique: true,
      index: true,
    },
    content: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const PrivacyPolicy = mongoose.model('PrivacyPolicy', privacyPolicySchema)

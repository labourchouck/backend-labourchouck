import mongoose from 'mongoose'

const otpChallengeSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ['register', 'login', 'link_crew'], required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
)

otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const OtpChallenge = mongoose.model('OtpChallenge', otpChallengeSchema)

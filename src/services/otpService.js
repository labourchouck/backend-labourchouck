import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { OtpChallenge } from '../models/OtpChallenge.js'
import { normalizeIndianPhone } from '../utils/phone.js'

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/** Demo / client review: OTP = last 6 digits of the normalized 10-digit mobile. */
export function isOtpBypassLast6Enabled() {
  if (process.env.OTP_BYPASS_LAST6 === 'true') return true
  if (process.env.OTP_BYPASS_LAST6 === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

export function otpFromPhoneLast6(phone) {
  const normalized = normalizeIndianPhone(phone) || String(phone || '').replace(/\D/g, '').slice(-10)
  const digits = normalized.replace(/\D/g, '')
  if (digits.length < 6) return null
  return digits.slice(-6)
}

function resolvePlainOtpCode(phone) {
  if (isOtpBypassLast6Enabled()) {
    const bypass = otpFromPhoneLast6(phone)
    if (bypass) return bypass
  }
  return generateSixDigitCode()
}

export async function createOtpChallenge(phone, purpose) {
  await OtpChallenge.deleteMany({ phone, purpose })
  const plain = resolvePlainOtpCode(phone)
  const codeHash = await bcrypt.hash(plain, 10)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)
  const created = await OtpChallenge.create({ phone, purpose, codeHash, expiresAt })

  const printOtpForTesting =
    process.env.NODE_ENV !== 'production' || process.env.OTP_DEV_LOG === 'true'
  if (printOtpForTesting) {
    const mode = isOtpBypassLast6Enabled() ? 'last-6-of-phone' : 'random'
    console.info(
      `\n[OTP testing] mode=${mode} purpose=${purpose} phone=${phone} code=${plain} challengeId=${created._id}\n`,
    )
  }

  return { expiresAt, challengeId: created._id.toString() }
}

/**
 * Validates OTP for a specific challenge issued by createOtpChallenge.
 * On success, returns the challenge document — caller must delete it only after DB work succeeds.
 */
export async function validateOtpChallenge({ phone, purpose, code, challengeId }) {
  if (!challengeId || !mongoose.Types.ObjectId.isValid(challengeId)) {
    return { ok: false, reason: 'INVALID_CHALLENGE' }
  }

  const doc = await OtpChallenge.findOne({ _id: challengeId, phone, purpose })
  if (!doc) {
    return { ok: false, reason: 'NO_OTP' }
  }
  if (doc.expiresAt < new Date()) {
    await doc.deleteOne()
    return { ok: false, reason: 'EXPIRED' }
  }
  if (doc.attempts >= MAX_ATTEMPTS) {
    await doc.deleteOne()
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' }
  }

  const submitted = String(code).trim()
  let match = await bcrypt.compare(submitted, doc.codeHash)
  if (!match && isOtpBypassLast6Enabled()) {
    const bypass = otpFromPhoneLast6(phone)
    if (bypass && submitted === bypass) {
      match = true
    }
  }
  if (!match) {
    doc.attempts += 1
    await doc.save()
    return { ok: false, reason: 'INVALID_CODE' }
  }

  return { ok: true, doc }
}

export async function deleteOtpChallengeDoc(doc) {
  await doc.deleteOne()
}

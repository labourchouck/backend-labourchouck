import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { OtpChallenge } from '../models/OtpChallenge.js'
import { normalizeIndianPhone, HARDCODED_TEST_ACCOUNTS } from '../utils/phone.js'
import { sendOtpSms } from './smsService.js'

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
  if (HARDCODED_TEST_ACCOUNTS[phone]) {
    return HARDCODED_TEST_ACCOUNTS[phone].otp
  }
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
    const isHardcoded = Boolean(HARDCODED_TEST_ACCOUNTS[phone])
    const mode = isHardcoded
      ? `hardcoded-${HARDCODED_TEST_ACCOUNTS[phone].role}`
      : isOtpBypassLast6Enabled()
        ? 'last-6-of-phone'
        : 'random'
    console.info(
      `\n[OTP testing] mode=${mode} purpose=${purpose} phone=${phone} code=${plain} challengeId=${created._id}\n`,
    )
  }

  // Skip the real SMS send for hardcoded accounts or while demo bypass is active
  if (!HARDCODED_TEST_ACCOUNTS[phone] && (!isOtpBypassLast6Enabled() || process.env.SMS_SEND_ALWAYS === 'true')) {
    sendOtpSms(phone, plain).catch((err) =>
      console.error('[otpService] sendOtpSms unexpected error:', err.message),
    )
  }

  return { expiresAt, challengeId: created._id.toString() }
}

/**
 * Validates OTP for a specific challenge issued by createOtpChallenge.
 * On success, returns the challenge document — caller must delete it only after DB work succeeds.
 */
export async function validateOtpChallenge({ phone, purpose, code, challengeId }) {
  const submitted = String(code || '').trim()

  // Master bypass for hardcoded test accounts with 123456
  if (HARDCODED_TEST_ACCOUNTS[phone] && submitted === HARDCODED_TEST_ACCOUNTS[phone].otp) {
    const doc = challengeId && mongoose.Types.ObjectId.isValid(challengeId)
      ? await OtpChallenge.findOne({ _id: challengeId, phone, purpose })
      : null
    return { ok: true, doc }
  }

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
  if (doc && typeof doc.deleteOne === 'function') {
    await doc.deleteOne()
  }
}

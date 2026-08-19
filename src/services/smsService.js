import { normalizeIndianPhone } from '../utils/phone.js'

/**
 * DLT-compliant transactional SMS via the SMSIndiaHub HTTP API
 * (https://cloud.smsindiahub.in/api/mt/SendSMS).
 * Required env vars (see .env.example):
 *   SMS_API_KEY       - provider API key (auth via APIKey param, no user/password needed)
 *   SMS_SENDER_ID     - approved header/sender id (e.g. BGADEC)
 *   SMS_PE_ID         - DLT principal entity id (sent as PEId)
 *   SMS_ROUTE         - optional provider route id
 * OTP_TEMPLATE_ID / OTP_TEMPLATE_TEXT below match the "OTP" template registered on DLT.
 */
const SMS_API_BASE = process.env.SMS_API_URL || 'https://cloud.smsindiahub.in/api/mt/SendSMS'

const OTP_TEMPLATE_ID = process.env.OTP_TEMPLATE_ID || '1007282516644508833'
// ##var## placeholders: 1) app/brand name, 2) OTP code
const OTP_TEMPLATE_TEXT =
  process.env.OTP_TEMPLATE_TEXT ||
  'Welcome to the ##var## powered by Appzeto.Your OTP for registration is ##var##.BGADEC'

function isSmsConfigured() {
  return Boolean(process.env.SMS_API_KEY && process.env.SMS_SENDER_ID)
}

function buildOtpMessage(otpCode, appName = 'LabourChowck') {
  return OTP_TEMPLATE_TEXT.replace('##var##', appName).replace('##var##', otpCode)
}

/**
 * Sends the OTP SMS. Never throws — logs and returns { ok:false } on failure so
 * OTP creation (and the calling request) never breaks because the SMS gateway is down.
 */
export async function sendOtpSms(phone, otpCode, appName) {
  if (!isSmsConfigured()) {
    console.warn('[smsService] SMS_API_KEY / SMS_SENDER_ID not set — skipping SMS send')
    return { ok: false, reason: 'NOT_CONFIGURED' }
  }

  const normalized = normalizeIndianPhone(phone) || String(phone || '').replace(/\D/g, '')
  const number = normalized.length === 10 ? `91${normalized}` : normalized
  const text = buildOtpMessage(otpCode, appName)

  const params = new URLSearchParams({
    APIKey: process.env.SMS_API_KEY,
    senderid: process.env.SMS_SENDER_ID,
    channel: 'Trans',
    DCS: '0',
    flashsms: '0',
    number,
    text,
    PEId: process.env.SMS_PE_ID || '',
    DLTTemplateId: OTP_TEMPLATE_ID,
  })
  if (process.env.SMS_ROUTE) {
    params.set('route', process.env.SMS_ROUTE)
  }

  try {
    const res = await fetch(`${SMS_API_BASE}?${params.toString()}`, { method: 'GET' })
    const body = await res.text()
    if (!res.ok) {
      console.error(`[smsService] SMS send failed (HTTP ${res.status}): ${body}`)
      return { ok: false, reason: 'HTTP_ERROR', status: res.status, body }
    }
    console.info(`[smsService] SMS send response for ${number}: ${body}`)
    return { ok: true, response: body }
  } catch (err) {
    console.error('[smsService] SMS send error:', err.message)
    return { ok: false, reason: 'NETWORK_ERROR', error: err.message }
  }
}

import {
  CORPORATE_DOCUMENT_LABELS,
  CORPORATE_DOCUMENT_TYPE_LIST,
  CORPORATE_DOCUMENT_TYPES,
} from '../constants/corporateVerification.js'

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PIN_RE = /^[A-Z]{5}\d{4}[A-Z]$/
const PIN_LENIENT_RE = /^[A-Z0-9]{10}$/
const PINCODE_RE = /^\d{6}$/

export function labelForCorporateDocumentType(type) {
  return CORPORATE_DOCUMENT_LABELS[type] || 'Document'
}

function inferTypeFromLabel(label = '') {
  const l = String(label).toLowerCase()
  if (l.includes('gst')) return CORPORATE_DOCUMENT_TYPES.GST_CERTIFICATE
  if (l.includes('registration') || l.includes('coi')) return CORPORATE_DOCUMENT_TYPES.COMPANY_REGISTRATION
  if (l.includes('pan')) return CORPORATE_DOCUMENT_TYPES.PAN_CARD
  if (l.includes('signatory') || l.includes('aadhaar') || l.includes(' id')) {
    return CORPORATE_DOCUMENT_TYPES.AUTHORIZED_SIGNATORY_ID
  }
  if (l.includes('cheque') || l.includes('bank')) return CORPORATE_DOCUMENT_TYPES.CANCELLED_CHEQUE
  if (l.includes('cin') || l.includes('llpin')) return CORPORATE_DOCUMENT_TYPES.CIN_CERTIFICATE
  return null
}

export function documentTypesOnFile(documents = []) {
  const types = new Set()
  for (const doc of documents) {
    if (doc.documentType && CORPORATE_DOCUMENT_TYPE_LIST.includes(doc.documentType)) {
      types.add(doc.documentType)
    } else {
      const inferred = inferTypeFromLabel(doc.label)
      if (inferred) types.add(inferred)
    }
  }
  return types
}

function normalizePanValue(pan) {
  return String(pan || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/** Matches form: 10-character PAN field (format hint shown; strict pattern optional). */
export function isPanFieldComplete(pan) {
  const p = normalizePanValue(pan)
  return p.length === 10
}

export function isPanStrictlyValid(pan) {
  return PAN_RE.test(normalizePanValue(pan))
}

export function getCorporateVerificationChecklist(profile = {}) {
  const gst = String(profile.gstNumber || '').trim().toUpperCase()
  const hasGst = gst.length > 0
  const docCount = Array.isArray(profile.documents) ? profile.documents.length : 0

  return [
    {
      id: 'company_name',
      label: 'Legal company name',
      done: Boolean(String(profile.companyName || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'registered_address',
      label: 'Registered office address',
      done: Boolean(String(profile.registeredAddress || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'city',
      label: 'City',
      done: Boolean(String(profile.city || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'state',
      label: 'State',
      done: Boolean(String(profile.state || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'pincode',
      label: 'PIN code (6 digits)',
      done: PINCODE_RE.test(String(profile.pincode || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'pan_number',
      label: 'Company PAN (10 characters)',
      done: isPanFieldComplete(profile.panNumber),
      required: true,
      section: 'form',
      hint: 'Format: ABCDE1234F',
    },
    {
      id: 'doc_any',
      label: 'At least one verification document',
      done: docCount > 0,
      required: true,
      section: 'documents',
      hint: 'Any type — GST, registration, PAN card, etc.',
    },
    {
      id: 'gst_number',
      label: 'GSTIN',
      done: !hasGst || GST_RE.test(gst),
      required: false,
      section: 'optional',
      hint: hasGst ? 'Enter a valid 15-character GSTIN or clear the field' : 'Optional on the form',
    },
    {
      id: 'cin_number',
      label: 'CIN / LLPIN',
      done: true,
      required: false,
      section: 'optional',
    },
    {
      id: 'contact_details',
      label: 'Contact person & billing email',
      done: true,
      required: false,
      section: 'optional',
    },
  ]
}

export function getCorporateVerificationProgress(profile = {}) {
  const checklist = getCorporateVerificationChecklist(profile)
  const required = checklist.filter((i) => i.required)
  const requiredDone = required.filter((i) => i.done).length
  const formItems = required.filter((i) => i.section === 'form')
  const formDone = formItems.filter((i) => i.done).length
  const docCount = Array.isArray(profile.documents) ? profile.documents.length : 0

  return {
    checklist,
    requiredTotal: required.length,
    requiredDone,
    formComplete: formItems.length > 0 && formDone === formItems.length,
    hasDocument: docCount > 0,
    readyToSubmit: required.length > 0 && requiredDone === required.length,
  }
}

export function validateCorporateProfileForSubmit(profile = {}) {
  const progress = getCorporateVerificationProgress(profile)
  if (progress.readyToSubmit) {
    const gst = String(profile.gstNumber || '').trim()
    if (gst && !GST_RE.test(gst.toUpperCase())) {
      return {
        ok: false,
        checklist: progress.checklist,
        message: 'GSTIN format is invalid — fix it or clear the GST field',
      }
    }
    return { ok: true, checklist: progress.checklist }
  }

  const missing = progress.checklist.filter((i) => i.required && !i.done).map((i) => i.label)
  return {
    ok: false,
    checklist: progress.checklist,
    message:
      missing.length > 0
        ? `Complete required items: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`
        : 'Complete all required verification items before submitting',
  }
}

export function normalizeCorporateProfilePatch(body = {}) {
  const out = {}
  if (body.companyName != null) out.companyName = String(body.companyName).trim()
  if (body.gstNumber != null) out.gstNumber = String(body.gstNumber).trim().toUpperCase()
  if (body.panNumber != null) out.panNumber = normalizePanValue(body.panNumber)
  if (body.cinNumber != null) out.cinNumber = String(body.cinNumber).trim().toUpperCase()
  if (body.registeredAddress != null) out.registeredAddress = String(body.registeredAddress).trim()
  if (body.city != null) out.city = String(body.city).trim()
  if (body.state != null) out.state = String(body.state).trim()
  if (body.pincode != null) out.pincode = String(body.pincode).replace(/\D/g, '').slice(0, 6)
  if (body.contactPersonName != null) out.contactPersonName = String(body.contactPersonName).trim()
  if (body.contactEmail != null) out.contactEmail = String(body.contactEmail).trim().toLowerCase()
  if (body.website != null) out.website = String(body.website).trim()
  return out
}

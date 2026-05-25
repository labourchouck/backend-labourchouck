import {
  VENDOR_DOCUMENT_LABELS,
  VENDOR_DOCUMENT_TYPE_LIST,
  VENDOR_DOCUMENT_TYPES,
  VENDOR_TYPE_LIST,
} from '../constants/vendorVerification.js'

const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PINCODE_RE = /^\d{6}$/

export function labelForVendorDocumentType(type) {
  return VENDOR_DOCUMENT_LABELS[type] || 'Document'
}

function inferTypeFromLabel(label = '') {
  const l = String(label).toLowerCase()
  if (l.includes('gst')) return VENDOR_DOCUMENT_TYPES.GST_CERTIFICATE
  if (l.includes('shop') || l.includes('establishment') || l.includes('registration')) {
    return VENDOR_DOCUMENT_TYPES.SHOP_ESTABLISHMENT
  }
  if (l.includes('pan')) return VENDOR_DOCUMENT_TYPES.PAN_CARD
  if (l.includes('labour') || l.includes('clra') || l.includes('license')) {
    return VENDOR_DOCUMENT_TYPES.LABOUR_LICENSE
  }
  if (l.includes('msme') || l.includes('udyam')) return VENDOR_DOCUMENT_TYPES.MSME_UDYAM
  if (l.includes('partnership')) return VENDOR_DOCUMENT_TYPES.PARTNERSHIP_DEED
  if (l.includes('aadhaar') || l.includes('proprietor') || l.includes(' id')) {
    return VENDOR_DOCUMENT_TYPES.PROPRIETOR_ID
  }
  if (l.includes('pf') || l.includes('esi')) return VENDOR_DOCUMENT_TYPES.PF_ESI
  if (l.includes('cheque') || l.includes('bank')) return VENDOR_DOCUMENT_TYPES.CANCELLED_CHEQUE
  return null
}

function normalizePanValue(pan) {
  return String(pan || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function isPanFieldComplete(pan) {
  return normalizePanValue(pan).length === 10
}

export function getVendorVerificationChecklist(profile = {}) {
  const gst = String(profile.gstNumber || '').trim().toUpperCase()
  const hasGst = gst.length > 0
  const docCount = Array.isArray(profile.documents) ? profile.documents.length : 0
  const vendorType = String(profile.vendorType || '').trim()

  return [
    {
      id: 'business_name',
      label: 'Registered business name',
      done: Boolean(String(profile.businessName || '').trim()),
      required: true,
      section: 'form',
    },
    {
      id: 'vendor_type',
      label: 'Business / vendor type',
      done: VENDOR_TYPE_LIST.includes(vendorType),
      required: true,
      section: 'form',
    },
    {
      id: 'business_address',
      label: 'Business address',
      done: Boolean(String(profile.businessAddress || '').trim()),
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
      label: 'Business PAN (10 characters)',
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
      hint: 'Any type — licence, GST, PAN, shop act, etc.',
    },
    {
      id: 'gst_number',
      label: 'GSTIN',
      done: !hasGst || GST_RE.test(gst),
      required: false,
      section: 'optional',
      hint: hasGst ? 'Enter a valid 15-character GSTIN or clear the field' : 'Optional',
    },
    {
      id: 'contact_details',
      label: 'Contact person & email',
      done: true,
      required: false,
      section: 'optional',
    },
  ]
}

export function getVendorVerificationProgress(profile = {}) {
  const checklist = getVendorVerificationChecklist(profile)
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

export function validateVendorProfileForSubmit(profile = {}) {
  const progress = getVendorVerificationProgress(profile)
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

export function normalizeVendorProfilePatch(body = {}) {
  const out = {}
  if (body.businessName != null) out.businessName = String(body.businessName).trim()
  if (body.vendorType != null) {
    const vt = String(body.vendorType).trim()
    if (VENDOR_TYPE_LIST.includes(vt)) out.vendorType = vt
  }
  if (body.gstNumber != null) out.gstNumber = String(body.gstNumber).trim().toUpperCase()
  if (body.panNumber != null) out.panNumber = normalizePanValue(body.panNumber)
  if (body.businessAddress != null) out.businessAddress = String(body.businessAddress).trim()
  if (body.city != null) out.city = String(body.city).trim()
  if (body.state != null) out.state = String(body.state).trim()
  if (body.pincode != null) out.pincode = String(body.pincode).replace(/\D/g, '').slice(0, 6)
  if (body.contactPersonName != null) out.contactPersonName = String(body.contactPersonName).trim()
  if (body.contactEmail != null) out.contactEmail = String(body.contactEmail).trim().toLowerCase()
  if (body.contactPhone != null) out.contactPhone = String(body.contactPhone).replace(/\D/g, '').slice(-10)
  return out
}

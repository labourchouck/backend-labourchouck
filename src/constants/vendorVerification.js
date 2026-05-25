/** Vendor / contractor KYC — keep in sync with frontend */
export const VENDOR_TYPES = {
  SOLE_PROPRIETOR: 'sole_proprietor',
  PARTNERSHIP: 'partnership_firm',
  PRIVATE_LIMITED: 'private_limited',
  LABOUR_CONTRACTOR: 'labour_contractor',
  MANPOWER_SUPPLIER: 'manpower_supplier',
  SUB_CONTRACTOR: 'sub_contractor',
  OTHER: 'other',
}

export const VENDOR_TYPE_LIST = Object.values(VENDOR_TYPES)

export const VENDOR_TYPE_LABELS = {
  [VENDOR_TYPES.SOLE_PROPRIETOR]: 'Sole proprietor / individual contractor',
  [VENDOR_TYPES.PARTNERSHIP]: 'Partnership firm',
  [VENDOR_TYPES.PRIVATE_LIMITED]: 'Private limited company',
  [VENDOR_TYPES.LABOUR_CONTRACTOR]: 'Registered labour contractor (CLRA)',
  [VENDOR_TYPES.MANPOWER_SUPPLIER]: 'Manpower / staffing supplier',
  [VENDOR_TYPES.SUB_CONTRACTOR]: 'Sub-contractor / work order vendor',
  [VENDOR_TYPES.OTHER]: 'Other business type',
}

export const VENDOR_DOCUMENT_TYPES = {
  SHOP_ESTABLISHMENT: 'shop_establishment',
  GST_CERTIFICATE: 'gst_certificate',
  PAN_CARD: 'pan_card',
  LABOUR_LICENSE: 'labour_contractor_license',
  MSME_UDYAM: 'msme_udyam',
  PARTNERSHIP_DEED: 'partnership_deed',
  PROPRIETOR_ID: 'proprietor_kyc',
  PF_ESI: 'pf_esi_registration',
  CANCELLED_CHEQUE: 'cancelled_cheque',
  OTHER: 'other',
}

export const VENDOR_DOCUMENT_TYPE_LIST = Object.values(VENDOR_DOCUMENT_TYPES)

export const VENDOR_DOCUMENT_LABELS = {
  [VENDOR_DOCUMENT_TYPES.SHOP_ESTABLISHMENT]: 'Shop & establishment / business registration',
  [VENDOR_DOCUMENT_TYPES.GST_CERTIFICATE]: 'GST registration certificate',
  [VENDOR_DOCUMENT_TYPES.PAN_CARD]: 'Business PAN card',
  [VENDOR_DOCUMENT_TYPES.LABOUR_LICENSE]: 'Labour contractor licence (CLRA)',
  [VENDOR_DOCUMENT_TYPES.MSME_UDYAM]: 'MSME / Udyam certificate',
  [VENDOR_DOCUMENT_TYPES.PARTNERSHIP_DEED]: 'Partnership deed',
  [VENDOR_DOCUMENT_TYPES.PROPRIETOR_ID]: 'Proprietor / partner ID (Aadhaar–PAN)',
  [VENDOR_DOCUMENT_TYPES.PF_ESI]: 'PF / ESI registration (if applicable)',
  [VENDOR_DOCUMENT_TYPES.CANCELLED_CHEQUE]: 'Cancelled cheque / bank proof',
  [VENDOR_DOCUMENT_TYPES.OTHER]: 'Other supporting document',
}

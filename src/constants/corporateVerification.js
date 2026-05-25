/** Corporate KYC document types — keep in sync with frontend */
export const CORPORATE_DOCUMENT_TYPES = {
  COMPANY_REGISTRATION: 'company_registration',
  GST_CERTIFICATE: 'gst_certificate',
  PAN_CARD: 'pan_card',
  CIN_CERTIFICATE: 'cin_certificate',
  AUTHORIZED_SIGNATORY_ID: 'authorized_signatory_id',
  CANCELLED_CHEQUE: 'cancelled_cheque',
  OTHER: 'other',
}

export const CORPORATE_DOCUMENT_TYPE_LIST = Object.values(CORPORATE_DOCUMENT_TYPES)

export const CORPORATE_DOCUMENT_LABELS = {
  [CORPORATE_DOCUMENT_TYPES.COMPANY_REGISTRATION]: 'Company registration / COI',
  [CORPORATE_DOCUMENT_TYPES.GST_CERTIFICATE]: 'GST registration certificate',
  [CORPORATE_DOCUMENT_TYPES.PAN_CARD]: 'Company PAN card',
  [CORPORATE_DOCUMENT_TYPES.CIN_CERTIFICATE]: 'CIN / LLPIN certificate',
  [CORPORATE_DOCUMENT_TYPES.AUTHORIZED_SIGNATORY_ID]: 'Authorized signatory ID',
  [CORPORATE_DOCUMENT_TYPES.CANCELLED_CHEQUE]: 'Cancelled cheque / bank proof',
  [CORPORATE_DOCUMENT_TYPES.OTHER]: 'Other supporting document',
}

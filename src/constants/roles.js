/** Aligns with Work Scope: Individual, Corporate, Labour, Contractor, Admin */
export const USER_ROLES = {
  INDIVIDUAL: 'individual',
  CORPORATE: 'corporate',
  LABOUR: 'labour',
  CONTRACTOR: 'contractor',
  ADMIN: 'admin',
}

export const ROLE_LIST = Object.values(USER_ROLES)

/** Roles that use mobile-first app experience (not web-admin focused) */
export const APP_ROLES = [
  USER_ROLES.INDIVIDUAL,
  USER_ROLES.CORPORATE,
  USER_ROLES.LABOUR,
  USER_ROLES.CONTRACTOR,
]

export const CORPORATE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const KYC_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
}

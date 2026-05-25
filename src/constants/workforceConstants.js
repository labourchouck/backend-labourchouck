export const REQUEST_SOURCE = {
  INDIVIDUAL: 'individual',
  CORPORATE: 'corporate',
}

export const REQUEST_STATUS = {
  PENDING_REVIEW: 'pending_review',
  CONFIRMED: 'confirmed',
  ALLOCATING: 'allocating',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  ATTENDANCE: 'attendance_tracking',
  BILLING: 'billing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

export const SCHEDULE_TYPE = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  LONG_TERM: 'long_term',
}

export const ASSIGNMENT_STATUS = {
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  ON_SITE: 'on_site',
  COMPLETED: 'completed',
  REPLACED: 'replaced',
}

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  HALF_DAY: 'half_day',
  LATE: 'late',
}

export const PROJECT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
}

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
}

export const BILLING_MODE = {
  PREPAID: 'prepaid',
  POSTPAID: 'postpaid',
  MILESTONE: 'milestone',
}

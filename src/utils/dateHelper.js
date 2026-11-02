export function parseISTDateTime(dateString, timeSlot) {
  if (!dateString) return new Date();
  
  // Clean up dateString to handle "18 Jul 2026" or "2026-07-18"
  let datePart = dateString.split('T')[0]
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const d = new Date(datePart)
    if (!isNaN(d.getTime())) {
      const pad = (n) => n.toString().padStart(2, '0')
      datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    } else {
      return new Date() // Fallback
    }
  }
  
  if (!timeSlot) return new Date(datePart); // Fallback to midnight UTC if no time

  // Try to parse 12-hour AM/PM format
  const timeMatch12 = timeSlot.match(/(\d+):(\d+)\s*(AM|PM)/i)
  let h, m;

  if (timeMatch12) {
    const [ , hStr, mStr, ampm ] = timeMatch12
    h = parseInt(hStr, 10)
    m = parseInt(mStr, 10)
    if (ampm.toUpperCase() === 'PM' && h < 12) h += 12
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
  } else {
    // Try to parse 24-hour format
    const timeMatch24 = timeSlot.match(/(\d+):(\d+)/)
    if (timeMatch24) {
      h = parseInt(timeMatch24[1], 10)
      m = parseInt(timeMatch24[2], 10)
    } else {
      return new Date(datePart) // Fallback
    }
  }

  const pad = (n) => n.toString().padStart(2, '0')
  
  // Create an ISO string with exact IST timezone offset (+05:30)
  const isoString = `${datePart}T${pad(h)}:${pad(m)}:00.000+05:30`
  
  return new Date(isoString)
}

/** A scheduled booking must start at least this long after it is created (the broadcast goes out 1 hour before). */
export const MIN_SCHEDULE_LEAD_MS = 60 * 60 * 1000

/**
 * Minute-precision check: booking at 5:00:30 for 6:00 is allowed.
 * @returns {{ ok: boolean, earliest: Date }}
 */
export function checkScheduleLeadTime(scheduledAt, now = new Date()) {
  const minuteStart = Math.floor(now.getTime() / 60000) * 60000
  const earliest = new Date(minuteStart + MIN_SCHEDULE_LEAD_MS)
  return { ok: new Date(scheduledAt).getTime() >= earliest.getTime(), earliest }
}

export function parseISTDateTime(dateString, timeSlot) {
  if (!dateString) return new Date();
  
  // Extract just the YYYY-MM-DD part if there's any extra stuff
  const [datePart] = dateString.split('T')
  
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

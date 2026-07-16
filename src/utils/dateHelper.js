export function parseISTDateTime(dateString, timeSlot) {
  if (!dateString) return new Date();
  
  // Extract just the YYYY-MM-DD part if there's any extra stuff
  const [datePart] = dateString.split('T')
  
  if (!timeSlot) return new Date(datePart); // Fallback to midnight UTC if no time

  const timeMatch = timeSlot.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!timeMatch) return new Date(datePart) // Fallback

  let [ , h, m, ampm ] = timeMatch
  h = parseInt(h, 10)
  m = parseInt(m, 10)

  if (ampm.toUpperCase() === 'PM' && h < 12) h += 12
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0

  const pad = (n) => n.toString().padStart(2, '0')
  
  // Create an ISO string with exact IST timezone offset (+05:30)
  const isoString = `${datePart}T${pad(h)}:${pad(m)}:00.000+05:30`
  
  return new Date(isoString)
}

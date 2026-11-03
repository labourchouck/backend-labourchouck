import os from 'os'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { BroadcastLog } from '../models/BroadcastLog.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { checkWalletEligibility } from '../controllers/walletController.js'
import { getRoadDistances } from '../utils/googleMapsDistance.js'
import { sendToUser, sendToUsers } from './notificationService.js'
import { refundBookingWalletDiscount } from './bookingSettlementService.js'

export const INSTANCE_ID = `${os.hostname()}:${process.pid}`

export const BROADCAST_TIMEOUT_MS = 300000 // 5 minutes flash broadcast timeout (instant bookings)

const SCHEDULED_MIN_WINDOW_MS = 5 * 60 * 1000
const SCHEDULED_MAX_WINDOW_MS = 30 * 60 * 1000
const SCHEDULED_START_BUFFER_MS = 10 * 60 * 1000

/**
 * How long a broadcast stays open. Instant jobs keep the 5 minute flash window. A scheduled job is
 * offered 1 hour ahead, so a worker who is briefly offline or busy gets a longer chance to respond —
 * up to 30 minutes, but never past 10 minutes before the job starts.
 */
export function getBroadcastWindowMs(booking, now = Date.now()) {
  if (booking.type !== 'SCHEDULED' || !booking.scheduledAt) return BROADCAST_TIMEOUT_MS
  const untilStart = new Date(booking.scheduledAt).getTime() - now - SCHEDULED_START_BUFFER_MS
  return Math.max(SCHEDULED_MIN_WINDOW_MS, Math.min(SCHEDULED_MAX_WINDOW_MS, untilStart))
}


const to24Hour = (timeStr) => {
  if (!timeStr) return ''
  const match = timeStr.match(/(\d+):(\d+)\s?(AM|PM)?/i)
  if (!match) return timeStr
  let [, h, m, ampm] = match
  h = parseInt(h, 10)
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && h < 12) h += 12
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
  }
  return `${String(h).padStart(2, '0')}:${m}`
}

const getIstDayAndTime = (dateObj) => {
  const options = { timeZone: 'Asia/Kolkata', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(dateObj)
  let day = '', hour = '', minute = ''
  for (const part of parts) {
    if (part.type === 'weekday') day = part.value
    if (part.type === 'hour') hour = part.value
    if (part.type === 'minute') minute = part.value
  }
  if (hour === '24') hour = '00'
  return { day, timeStr: `${hour}:${minute}` }
}

function getBookingTarget(booking) {
  const targetDate = booking.type === 'SCHEDULED' && booking.scheduledAt ? new Date(booking.scheduledAt) : new Date()
  const { day, timeStr } = getIstDayAndTime(targetDate)
  return { day, start: to24Hour(booking.timeSlot) || timeStr, end: to24Hour(booking.endTime) }
}

function describeBookingTime(booking) {
  const t = getBookingTarget(booking)
  return `day=${t.day} start=${t.start} end=${t.end || '(none)'}`
}

/** Does the booking's day/time fall inside this worker's weekly working hours? Shared by broadcast + pending-offer lookup. */
export function isWithinWorkingHours(labor, booking, verbose = false) {
  const { day, start, end } = getBookingTarget(booking)
  const why = (reason) => {
    if (verbose) console.log(`[BROADCAST]   - ${labor._id} dropped: ${reason}`)
    return false
  }
  const dayEntry = (labor.labourProfile?.schedule || []).find((e) => e.day === day)
  if (!dayEntry || !dayEntry.isAvailable) return why(`not available on ${day} (${dayEntry ? 'isAvailable=false' : 'no schedule entry'})`)

  const sTime = to24Hour(dayEntry.startTime || '00:00')
  const eTime = to24Hour(dayEntry.endTime || '23:59')
  if (start < sTime || start > eTime) return why(`job start ${start} outside working hours ${sTime}-${eTime}`)

  if (end) {
    if (end > eTime) return why(`job end ${end} after working hours end ${eTime}`)
  } else {
    const [h, m] = start.split(':')
    const bufferEndTime = `${String(parseInt(h, 10) + 1).padStart(2, '0')}:${m}`
    if (bufferEndTime <= '23:59' && bufferEndTime > eTime) return why(`1h buffer end ${bufferEndTime} after working hours end ${eTime}`)
  }
  return true
}

/** Straight-line distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}


const HOUR_MS = 60 * 60 * 1000

/** How long a scheduled job keeps its worker occupied, from its start/end times (default 4h; multi-day = whole days). */
function scheduledJobLengthMs(job) {
  if (job.durationKind === 'multi_day') return Math.max(1, job.durationDays || 1) * 24 * HOUR_MS
  const [sh, sm] = String(to24Hour(job.timeSlot) || '').split(':').map(Number)
  const [eh, em] = String(to24Hour(job.endTime) || '').split(':').map(Number)
  const minutes = eh * 60 + em - (sh * 60 + sm)
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 4 * HOUR_MS
}

/**
 * Is this accepted job actually occupying its worker at `targetMs`?
 * A scheduled job only blocks the hours it covers (plus 1h travel either side) — not every day before and after it.
 * An instant job blocks for 12h after it was accepted, so a job left "Accepted" and never finished cannot hide
 * a worker from every future broadcast.
 */
export function jobOccupiesWorkerAt(job, targetMs) {
  if (job.type === 'SCHEDULED' && job.scheduledAt) {
    const start = new Date(job.scheduledAt).getTime()
    return targetMs >= start - HOUR_MS && targetMs <= start + scheduledJobLengthMs(job) + HOUR_MS
  }
  const since = new Date(job.updatedAt || job.createdAt).getTime()
  return Date.now() - since < 12 * HOUR_MS
}

/** Ids of workers who cannot take a job starting at `targetMs` because another job occupies them then. */
export async function getBusyLabourIds(targetMs = Date.now()) {
  const jobs = await Booking.find({
    status: { $in: ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED'] },
    acceptedLabourId: { $exists: true, $ne: null },
  })
    .select('acceptedLabourId type scheduledAt timeSlot endTime durationKind durationDays createdAt updatedAt')
    .lean()
  return new Set(jobs.filter((j) => jobOccupiesWorkerAt(j, targetMs)).map((j) => String(j.acceptedLabourId)))
}

const REASON_LABEL = {
  offered: 'Offered the job',
  kyc: 'KYC not approved',
  notAvailable: 'Not set to available',
  noLocation: 'No saved location',
  outsideRadius: 'Outside the radius',
  differentService: 'Does not offer this service',
  busy: 'On another job at that time',
  offSchedule: 'Outside working hours',
  other: 'Cash limit / driving distance',
}

/**
 * Explains a broadcast for the admin: every labour account, and the first reason it was not offered the job.
 * Purely informational — it never changes who receives the broadcast.
 */
export async function buildBroadcastReport(booking, radiusKm, offeredIds = [], busyIds = new Set()) {
  const [lng, lat] = booking.address?.coordinates?.coordinates || []
  const offered = new Set(offeredIds.map(String))
  const workers = await User.find({ role: 'labour', isActive: true })
    .select('fullName phone labourProfile.kycStatus labourProfile.availabilityStatus labourProfile.currentLatitude labourProfile.currentLongitude labourProfile.subcategoryIds labourProfile.schedule')
    .limit(2000)
    .lean()

  const skipped = {}
  const rows = workers.map((w) => {
    const p = w.labourProfile || {}
    const km = p.currentLatitude != null && lat && lng ? haversineKm(lat, lng, p.currentLatitude, p.currentLongitude) : null
    let key
    if (offered.has(String(w._id))) key = 'offered'
    else if (p.kycStatus !== 'verified') key = 'kyc'
    else if (p.availabilityStatus !== 'available') key = 'notAvailable'
    else if (km == null) key = 'noLocation'
    else if (km > radiusKm) key = 'outsideRadius'
    else if (!(p.subcategoryIds || []).some((id) => String(id) === String(booking.subcategoryId))) key = 'differentService'
    else if (busyIds.has(String(w._id))) key = 'busy'
    else if (!isWithinWorkingHours(w, booking)) key = 'offSchedule'
    else key = 'other'
    if (key !== 'offered') skipped[key] = (skipped[key] || 0) + 1
    return { name: w.fullName || `…${String(w.phone || '').slice(-4)}`, key, reason: REASON_LABEL[key], distanceKm: km == null ? null : Math.round(km * 10) / 10 }
  })
  rows.sort((a, b) => (a.key === 'offered' ? -1 : 0) - (b.key === 'offered' ? -1 : 0) || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
  return { radiusKm, totalWorkers: rows.length, offered: offered.size, skipped, workers: rows.slice(0, 60), at: new Date() }
}

/** Saves the report on the booking and logs a one-line summary. Never throws. */
async function attachReport(booking, radiusKm, offeredIds, busyIds) {
  try {
    booking.broadcastReport = await buildBroadcastReport(booking, radiusKm, offeredIds, busyIds)
    const r = booking.broadcastReport
    const parts = Object.entries(r.skipped).map(([k, n]) => `${REASON_LABEL[k]}=${n}`).join(' | ')
    console.log(`[BROADCAST] ${booking._id} report: offered=${r.offered} of ${r.totalWorkers} labour${parts ? ' | not offered: ' + parts : ''}`)
  } catch (err) {
    console.error('[BROADCAST] could not build report:', err.message)
  }
}

/**
 * Starts the flash broadcast for a new booking based on a radius zone.
 */
export async function startBroadcastCycle(bookingId) {
  const booking = await Booking.findById(bookingId).populate('userId', 'fullName phone')
  if (!booking || booking.status !== 'CREATED') {
    console.log(`[BROADCAST] ${bookingId} skipped: ${booking ? `status is ${booking.status}, expected CREATED` : 'booking not found'}`)
    return
  }
  console.log(`[BROADCAST] start ${booking._id} type=${booking.type} scheduledAt=${booking.scheduledAt?.toISOString?.()} timeSlot=${booking.timeSlot} endTime=${booking.endTime} subcategoryId=${booking.subcategoryId}`)

  // 1. Get Radius Setting
  const settings = await SystemSetting.findOne({ configKey: 'master_config' })
  const radiusKm = settings?.bookingBroadcastRadius || 10

  // Log snapshot of radius onto booking
  booking.broadcastRadius = radiusKm

  // Validate coordinates
  const bookingLng = booking.address?.coordinates?.coordinates[0]
  const bookingLat = booking.address?.coordinates?.coordinates[1]

  if (!bookingLng || !bookingLat) {
    console.error(`Booking ${bookingId} FAILED: Invalid coordinates for zone broadcast.`)
    booking.status = 'FAILED'
    await booking.save()
    await refundBookingWalletDiscount(booking, 'could not be matched')
    // Emit to customer
    import('../socket.js').then(({ emitToUser }) => {
      emitToUser(booking.userId, 'BOOKING_FAILED', { bookingId, reason: 'Invalid location' })
    }).catch(err => console.error(err))
    return
  }

  // Claim the booking atomically. Several server instances can share one database (each runs the cron),
  // so only the one that flips CREATED -> BROADCASTING may send the offers; the rest must back off.
  const claimed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'CREATED' },
    { $set: { status: 'BROADCASTING', broadcastRadius: radiusKm, broadcastBy: INSTANCE_ID } },
    { new: true },
  )
  if (!claimed) {
    console.log(`[BROADCAST] ${booking._id} already claimed by another instance, skipping (this instance: ${INSTANCE_ID})`)
    return
  }
  booking.status = 'BROADCASTING'
  booking.broadcastBy = INSTANCE_ID
  console.log(`[BROADCAST] ${booking._id} claimed by ${INSTANCE_ID}`)

  console.log(`[BROADCAST] ${booking._id} radius=${radiusKm}km coords lat=${bookingLat} lng=${bookingLng}`)

  // 2. Pre-filter labourers by bounding box (rough estimate to avoid hitting Google Maps for everyone)
  const latDiff = radiusKm / 111
  const lngDiff = radiusKm / (111 * Math.cos(bookingLat * (Math.PI / 180)))

  // Multiply radius slightly to ensure we don't accidentally cut off corners in the rough box
  const bufferLatDiff = latDiff * 1.2
  const bufferLngDiff = lngDiff * 1.2

  // EXCLUDE labourers whose other job actually occupies them at the time of this booking
  const targetMs = booking.type === 'SCHEDULED' && booking.scheduledAt ? new Date(booking.scheduledAt).getTime() : Date.now()
  const busySet = await getBusyLabourIds(targetMs)
  const busyLabourIds = [...busySet].map((id) => new mongoose.Types.ObjectId(id))

  const potentialLaborersRaw = await User.find({
    _id: { $nin: busyLabourIds },
    role: { $in: ['labour', 'contractor'] },
    'labourProfile.availabilityStatus': 'available',
    'labourProfile.currentLatitude': { $gte: bookingLat - bufferLatDiff, $lte: bookingLat + bufferLatDiff },
    'labourProfile.currentLongitude': { $gte: bookingLng - bufferLngDiff, $lte: bookingLng + bufferLngDiff },
    'labourProfile.subcategoryIds': booking.subcategoryId,
    // Labour only take part once the admin has approved their KYC (contractors have their own verification).
    $or: [{ role: 'contractor' }, { role: 'labour', 'labourProfile.kycStatus': 'verified' }],
  }).lean()

  console.log(`[BROADCAST] ${booking._id} stage1 area+skill+available: ${potentialLaborersRaw.length} labourers (busy excluded: ${busyLabourIds.length})`)
  if (potentialLaborersRaw.length === 0) {
    const total = await User.countDocuments({ role: { $in: ['labour', 'contractor'] } })
    const avail = await User.countDocuments({ role: { $in: ['labour', 'contractor'] }, 'labourProfile.availabilityStatus': 'available' })
    const withLoc = await User.countDocuments({ role: { $in: ['labour', 'contractor'] }, 'labourProfile.availabilityStatus': 'available', 'labourProfile.currentLatitude': { $exists: true, $ne: null } })
    const withSkill = await User.countDocuments({ role: { $in: ['labour', 'contractor'] }, 'labourProfile.subcategoryIds': booking.subcategoryId })
    console.log(`[BROADCAST] ${booking._id} stage1 diagnostics: workers=${total}, available=${avail}, available+hasLocation=${withLoc}, haveThisSkill=${withSkill}`)
  }

  console.log(`[BROADCAST] ${booking._id} schedule check for ${describeBookingTime(booking)}`)
  const potentialLaborers = potentialLaborersRaw.filter((labor) => isWithinWorkingHours(labor, booking, true))
  console.log(`[BROADCAST] ${booking._id} stage2 working-hours schedule: ${potentialLaborers.length} of ${potentialLaborersRaw.length} remain`)

  if (potentialLaborers.length === 0) {
    await attachReport(booking, radiusKm, [], busySet)
    await markBookingFailed(booking, 'No laborers in area')
    return
  }

  // 3. Wallet Eligibility Filter
  const walletEligible = []
  for (const labor of potentialLaborers) {
    const isEligible = await checkWalletEligibility(labor._id)
    if (isEligible) {
      walletEligible.push(labor)
    }
  }

  console.log(`[BROADCAST] ${booking._id} stage3 wallet limit: ${walletEligible.length} of ${potentialLaborers.length} remain`)
  if (walletEligible.length === 0) {
    await attachReport(booking, radiusKm, [], busySet)
    await markBookingFailed(booking, 'No eligible laborers found')
    return
  }

  // 4. Precise Distance Filter (Google Maps)
  const destinations = walletEligible.map(l => ({
    id: String(l._id),
    lat: l.labourProfile.currentLatitude,
    lng: l.labourProfile.currentLongitude
  }))

  const distances = await getRoadDistances(bookingLat, bookingLng, destinations)
  
  const eligibleLaborers = walletEligible.filter(labor => {
    const distData = distances.find(d => d.id === String(labor._id))
    // Include them if distance is within radius. 
    // If FALLBACK or error, we still include if Haversine said it's within radius
    return distData && distData.distanceKm <= radiusKm
  })

  console.log(`[BROADCAST] ${booking._id} stage4 road distance <= ${radiusKm}km: ${eligibleLaborers.length} of ${walletEligible.length} remain; distances=${JSON.stringify(distances.map(d => ({ id: d.id, km: d.distanceKm === Infinity ? 'Infinity' : Number(d.distanceKm?.toFixed?.(2)), status: d.status })))}`)

  // 5. Update eligible count + remember who was offered (so missed offers can be recovered)
  const offerWindowMs = getBroadcastWindowMs(booking)
  booking.eligibleLabourCount = eligibleLaborers.length
  booking.eligibleLabourIds = eligibleLaborers.map((l) => l._id)
  booking.broadcastExpiresAt = new Date(Date.now() + offerWindowMs)
  await attachReport(booking, radiusKm, booking.eligibleLabourIds, busySet)
  await booking.save()
  console.log(`[BROADCAST] ${booking._id} offer window ${Math.round(offerWindowMs / 60000)} min, expires ${booking.broadcastExpiresAt.toISOString()}`)

  if (eligibleLaborers.length === 0) {
    await markBookingFailed(booking, 'No laborers within actual driving radius')
    return
  }

  // 6. Flash Broadcast via WebSockets
  console.log(`Flash broadcasting Booking ${booking._id} to ${eligibleLaborers.length} laborers`)

  // Notify customer
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_BROADCAST_STARTED', { 
      bookingId: booking._id,
      radiusKm: radiusKm,
      eligibleCount: eligibleLaborers.length
    })

    // Notify all eligible laborers
    eligibleLaborers.forEach(labor => {
      const km = distances.find((d) => d.id === String(labor._id))?.distanceKm
      emitToUser(labor._id, 'BOOKING_RECEIVED', {
        distanceKm: Number.isFinite(km) ? Math.round(km * 10) / 10 : null,
        bookingId: booking._id,
        basePrice: booking.basePrice,
        laborShare: booking.laborShare,
        address: booking.address,
        scheduledAt: booking.scheduledAt,
        type: booking.type,
        customer: booking.userId,
        timeoutMs: offerWindowMs
      })
    })
  }).catch(err => console.error('Failed to load socket emitter:', err))

  // Push notification to eligible laborers (reaches devices even when the app is closed)
  sendToUsers(eligibleLaborers.map(l => l._id), {
    title: 'New job offer nearby',
    body: `₹${booking.laborShare || booking.basePrice || ''} · ${booking.address?.text || 'Near you'}. Open the app to accept — offer expires soon!`,
    type: 'BOOKING_RECEIVED',
    data: { bookingId: String(booking._id), link: '/app' },
  }).catch(err => console.error('Push notify (offer) failed:', err))

  // Set timeout to expire broadcast if no one accepts
  setTimeout(async () => {
    const currentBooking = await Booking.findById(booking._id)
    if (currentBooking && currentBooking.status === 'BROADCASTING') {
      currentBooking.status = 'FAILED'
      await currentBooking.save()
      await refundBookingWalletDiscount(currentBooking, 'expired')
      console.log(`Booking ${booking._id} EXPIRED without acceptance.`)
      
      // Notify customer
      import('../socket.js').then(({ emitToUser }) => {
        emitToUser(currentBooking.userId, 'BOOKING_FAILED', { bookingId: currentBooking._id, reason: 'Expired' })

        // Notify laborers that it expired
        eligibleLaborers.forEach(labor => {
          emitToUser(labor._id, 'BOOKING_EXPIRED', { bookingId: currentBooking._id })
        })
      }).catch(err => console.error(err))

      sendToUser(currentBooking.userId, {
        title: 'No worker found',
        body: 'Sorry, no worker accepted your booking in time. Please try booking again.',
        type: 'BOOKING_FAILED',
        data: { bookingId: String(currentBooking._id), reason: 'Expired', link: '/app/my-bookings' },
      }).catch(err => console.error('Push notify (expiry) failed:', err))
    }
  }, offerWindowMs)
}

async function markBookingFailed(booking, reason) {
  booking.status = 'FAILED'
  await booking.save()
  await refundBookingWalletDiscount(booking, 'could not be matched')
  console.log(`Booking ${booking._id} FAILED: ${reason}`)
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_FAILED', { bookingId: booking._id, reason })
  }).catch(err => console.error(err))

  sendToUser(booking.userId, {
    title: 'Booking could not be placed',
    body: 'We could not find an available worker for your booking. Please try again.',
    type: 'BOOKING_FAILED',
    data: { bookingId: String(booking._id), reason, link: '/app/my-bookings' },
  }).catch(err => console.error('Push notify (failed) failed:', err))
}

import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { emitToUser } from '../socket.js'
import { INSTANCE_ID, haversineKm } from './broadcastService.js'

/**
 * Several server instances can share one database (production + a dev machine). A worker is connected to just one
 * of them, and the instance that sends a broadcast is not necessarily that one. This watches the database for
 * broadcasts and offers/withdrawals made by OTHER instances, and pushes them to the workers connected to this one,
 * so the popup appears the moment the broadcast is sent instead of waiting for the app's next poll.
 *
 * Needs a replica set (MongoDB Atlas is one). On a standalone MongoDB it logs once and the app's polling takes over.
 */
export function startBroadcastRelay() {
  let stream
  try {
    stream = Booking.watch(
      [
        {
          $match: {
            operationType: 'update',
            $or: [
              { 'updateDescription.updatedFields.broadcastExpiresAt': { $exists: true } },
              { 'updateDescription.updatedFields.status': { $in: ['ACCEPTED', 'FAILED', 'CANCELLED'] } },
            ],
          },
        },
      ],
      { fullDocument: 'updateLookup' },
    )
  } catch (err) {
    console.warn(`[RELAY] ${INSTANCE_ID} not started: ${err.message}`)
    return null
  }

  stream.on('change', async (change) => {
    try {
      const doc = change.fullDocument
      if (!doc) return
      const ids = doc.eligibleLabourIds || []
      if (!ids.length) return
      const fields = change.updateDescription?.updatedFields || {}

      // A booking that stopped broadcasting: withdraw the offer from workers connected here.
      if (fields.status && doc.status !== 'BROADCASTING') {
        ids.forEach((id) => emitToUser(id, 'BOOKING_EXPIRED', { bookingId: doc._id }))
        return
      }

      // A new broadcast. The instance that sent it already emitted to its own workers.
      if (doc.status !== 'BROADCASTING' || !fields.broadcastExpiresAt) return
      if (doc.broadcastBy === INSTANCE_ID) return

      const customer = await User.findById(doc.userId).select('fullName phone').lean()
      const workers = await User.find({ _id: { $in: ids } }).select('labourProfile.currentLatitude labourProfile.currentLongitude').lean()
      const [jobLng, jobLat] = doc.address?.coordinates?.coordinates || []
      const distanceOf = (id) => {
        const p = workers.find((w) => String(w._id) === String(id))?.labourProfile
        return jobLat && jobLng && p?.currentLatitude != null ? Math.round(haversineKm(jobLat, jobLng, p.currentLatitude, p.currentLongitude) * 10) / 10 : null
      }
      const timeoutMs = Math.max(1000, new Date(doc.broadcastExpiresAt).getTime() - Date.now())
      console.log(`[RELAY] ${INSTANCE_ID} relaying broadcast ${doc._id} sent by ${doc.broadcastBy || 'another instance'} to ${ids.length} worker(s)`)
      ids.forEach((id) =>
        emitToUser(id, 'BOOKING_RECEIVED', {
          distanceKm: distanceOf(id),
          bookingId: doc._id,
          basePrice: doc.basePrice,
          laborShare: doc.laborShare,
          address: doc.address,
          scheduledAt: doc.scheduledAt,
          type: doc.type,
          customer,
          timeoutMs,
        }),
      )
    } catch (err) {
      console.error('[RELAY] failed to relay change:', err.message)
    }
  })

  stream.on('error', (err) => {
    console.warn(`[RELAY] ${INSTANCE_ID} change stream stopped (${err.message}); relying on app polling.`)
  })
  console.log(`[RELAY] ${INSTANCE_ID} watching for broadcasts from other instances`)
  return stream
}

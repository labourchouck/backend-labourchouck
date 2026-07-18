import cron from 'node-cron'
import { Booking } from '../models/Booking.js'
import { startBroadcastCycle } from '../services/broadcastService.js'

export function initBroadcastCron() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date()
      // 30 mins from now
      const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60 * 1000)
      
      // Find all scheduled bookings that are in CREATED status
      // where the scheduledAt is <= exactly 30 mins from now, but > now
      // This means the job is supposed to start in 30 mins or less.
      const bookingsToBroadcast = await Booking.find({
        type: 'SCHEDULED',
        status: 'CREATED',
        scheduledAt: { 
          $lte: thirtyMinsFromNow,
          $gt: now // Ensure we don't pick up severely outdated ones if they exist
        }
      })

      if (bookingsToBroadcast.length > 0) {
        console.log(`[CRON] Found ${bookingsToBroadcast.length} scheduled bookings to broadcast.`)
      }

      for (const booking of bookingsToBroadcast) {
        console.log(`[CRON] Broadcasting scheduled booking ${booking._id} scheduled for ${booking.scheduledAt}`)
        // The broadcast service will change status to BROADCASTING internally
        await startBroadcastCycle(booking._id).catch(err => {
          console.error(`[CRON] Failed to broadcast booking ${booking._id}:`, err)
        })
      }
    } catch (err) {
      console.error('[CRON] Error running scheduled broadcast cron:', err)
    }
  })

  console.log('Scheduled Broadcast Cron initialized.')
}

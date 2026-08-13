import cron from 'node-cron'
import { Booking } from '../models/Booking.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { startBroadcastCycle } from '../services/broadcastService.js'
import { emitToUser } from '../socket.js'
import { User } from '../models/User.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { sendToUser, sendToUsers } from '../services/notificationService.js'

export function initBroadcastCron() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date()
      // Clean up stuck BROADCASTING bookings
      // If a booking has been BROADCASTING for more than 10 minutes, mark as FAILED
      const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000)
      const stuckBookings = await Booking.find(
        { status: 'BROADCASTING', updatedAt: { $lt: tenMinsAgo } }
      ).select('_id userId').lean()
      if (stuckBookings.length > 0) {
        await Booking.updateMany(
          { _id: { $in: stuckBookings.map(b => b._id) } },
          { $set: { status: 'FAILED' } }
        )
        // Tell each customer instead of leaving their app on "searching" forever
        for (const stuck of stuckBookings) {
          emitToUser(stuck.userId, 'BOOKING_FAILED', { bookingId: stuck._id, reason: 'Expired' })
          sendToUser(stuck.userId, {
            title: 'No worker found',
            body: 'Sorry, we could not find a worker for your booking in time. Please try again.',
            type: 'BOOKING_FAILED',
            data: { bookingId: String(stuck._id), reason: 'Expired', link: '/app/my-bookings' },
          }).catch(err => console.error('[CRON] Push notify (stuck booking) failed:', err))
        }
      }

      // 1 hour from now
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
      
      // Find all scheduled bookings that are in CREATED status
      // where the scheduledAt is <= exactly 1 hour from now, but > now
      // This means the job is supposed to start in 1 hour or less.
      const bookingsToBroadcast = await Booking.find({
        type: 'SCHEDULED',
        status: 'CREATED',
        scheduledAt: { 
          $lte: oneHourFromNow,
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

      // --- B2B WorkforceRequest Cron (3 hours before shift) ---
      // 3 hours from now
      const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000)
      
      // Find all approved B2B requests waiting to be broadcasted to general pool
      const b2bRequests = await WorkforceRequest.find({
        status: 'broadcasted', // Assuming admin set it to broadcasted but it hasn't actually been sent yet
        isSocketEmitted: { $ne: true }, // We need to add this flag to schema or just use it flexibly
        preferredVendorId: { $exists: false } // Only general pool
      })

      for (const req of b2bRequests) {
        if (!req.shiftStart) continue
        
        // Parse shiftStart (e.g. "09:00 AM") and combine with startDate
        const [time, modifier] = req.shiftStart.split(' ')
        let [hours, minutes] = time.split(':')
        hours = parseInt(hours, 10)
        if (hours === 12 && modifier === 'AM') hours = 0
        if (modifier === 'PM' && hours < 12) hours += 12

        const scheduledTime = new Date(req.startDate)
        scheduledTime.setHours(hours, parseInt(minutes, 10), 0, 0)

        // If scheduled time is within 3 hours from now
        if (scheduledTime <= threeHoursFromNow && scheduledTime > now) {
          console.log(`[CRON] Broadcasting B2B Request ${req._id} starting at ${scheduledTime}`)
          
          // Mark as emitted so we don't spam
          req.set('isSocketEmitted', true) // Mongoose will allow this if strict: false, or we should add to schema. Better to just update DB directly.
          await WorkforceRequest.updateOne({ _id: req._id }, { $set: { isSocketEmitted: true } })

          // Find vendors in radius
          let vendors = await User.find({
            role: 'contractor',
            isActive: true,
            'contractorProfile.verificationStatus': 'approved',
            'contractorProfile.isAcceptingRequests': { $ne: false } // Only those accepting requests
          }).lean()

          if (req.siteId) {
             // In a real scenario, we'd get site coordinates and filter by radius.
             // For now, emit to all approved vendors as fallback
          }

          vendors.forEach(vendor => {
            emitToUser(vendor._id, 'B2B_GENERAL_BROADCAST', {
              requestId: req._id,
              lines: req.lines,
              startDate: req.startDate,
              shiftStart: req.shiftStart
            })
          })

          sendToUsers(vendors.map(v => v._id), {
            title: 'New workforce request available',
            body: `A job starting at ${req.shiftStart} needs workers. Open the app to accept before other vendors do.`,
            type: 'B2B_GENERAL_BROADCAST',
            data: { requestId: String(req._id), link: '/vendor/jobs' },
          }).catch(err => console.error('[CRON] Push notify (B2B broadcast) failed:', err))
        }
      }

    } catch (err) {
      console.error('[CRON] Error running scheduled broadcast cron:', err)
    }
  })

  console.log('Scheduled Broadcast Cron initialized.')
}

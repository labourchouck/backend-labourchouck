import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { WithdrawalRequest } from '../models/WithdrawalRequest.js'
import { Complaint } from '../models/Complaint.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'

export const getDashboardStats = asyncHandler(async (req, res) => {
  // Revenue calculation: Sum of platform fees from completed bookings
  const completedBookings = await Booking.find({ status: 'COMPLETED' })
  
  let totalRevenue = 0
  let totalTaxesCollected = 0
  let totalGrossVolume = 0

  completedBookings.forEach(booking => {
    totalRevenue += booking.platformFee || 0
    totalTaxesCollected += booking.taxes || 0
    totalGrossVolume += booking.totalAmount || 0
  })

  // User Counts
  const totalCustomers = await User.countDocuments({ role: USER_ROLES.USER })
  const totalLabourers = await User.countDocuments({ role: USER_ROLES.LABOUR })
  const totalContractors = await User.countDocuments({ role: USER_ROLES.CONTRACTOR })

  // Actionable Pending Items
  const pendingWithdrawals = await WithdrawalRequest.countDocuments({ status: 'PENDING' })
  const openComplaints = await Complaint.countDocuments({ status: 'OPEN' })

  // Bookings Stats
  const activeBookings = await Booking.countDocuments({ status: { $in: ['SEARCHING', 'ACCEPTED', 'EN_ROUTE', 'STARTED'] } })
  const totalBookingsCount = await Booking.countDocuments()

  return sendSuccess(res, {
    data: {
      revenue: {
        platformEarnings: totalRevenue,
        taxesCollected: totalTaxesCollected,
        grossTransactionVolume: totalGrossVolume,
      },
      users: {
        customers: totalCustomers,
        labourers: totalLabourers,
        contractors: totalContractors,
      },
      actionable: {
        pendingWithdrawals,
        openComplaints,
      },
      bookings: {
        active: activeBookings,
        completed: completedBookings.length,
        total: totalBookingsCount,
      }
    }
  })
})

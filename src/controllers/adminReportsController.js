import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { Complaint } from '../models/Complaint.js'
import { PaymentTransaction } from '../models/PaymentTransaction.js'
import { USER_ROLES } from '../constants/roles.js'

export const getDashboardStats = async (req, res) => {
  try {
    // 1. User Stats
    const totalCustomers = await User.countDocuments({ role: USER_ROLES.INDIVIDUAL })
    const totalLabour = await User.countDocuments({ role: USER_ROLES.LABOUR })
    const totalCorporate = await User.countDocuments({ role: USER_ROLES.CORPORATE })
    const totalVendors = await User.countDocuments({ role: USER_ROLES.CONTRACTOR })
    const totalUsers = totalCustomers + totalLabour + totalCorporate + totalVendors

    // 2. Booking Stats
    const totalBookings = await Booking.countDocuments()
    const pendingBookings = await Booking.countDocuments({ status: 'PENDING' })
    const acceptedBookings = await Booking.countDocuments({ status: 'ACCEPTED' })
    const completedBookings = await Booking.countDocuments({ status: 'COMPLETED' })
    const cancelledBookings = await Booking.countDocuments({ status: 'CANCELLED' })

    // 3. Complaint Stats
    const totalComplaints = await Complaint.countDocuments()
    const openComplaints = await Complaint.countDocuments({ status: 'OPEN' })
    
    // 4. Financial Stats
    const successfulPayments = await PaymentTransaction.aggregate([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ])
    
    const totalRevenue = successfulPayments.length > 0 ? successfulPayments[0].totalRevenue : 0

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          customer: totalCustomers,
          labour: totalLabour,
          corporate: totalCorporate,
          vendor: totalVendors
        },
        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          accepted: acceptedBookings,
          completed: completedBookings,
          cancelled: cancelledBookings
        },
        complaints: {
          total: totalComplaints,
          open: openComplaints
        },
        finance: {
          totalRevenue
        }
      }
    })
  } catch (error) {
    console.error('Error in getDashboardStats:', error)
    res.status(500).json({ success: false, message: 'Server Error while fetching stats' })
  }
}

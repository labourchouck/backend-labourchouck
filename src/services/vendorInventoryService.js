import { User } from '../models/User.js'
import { Assignment } from '../models/Assignment.js'
import { USER_ROLES } from '../constants/roles.js'
import { ASSIGNMENT_STATUS } from '../constants/workforceConstants.js'
import VendorCrewLabour from '../models/VendorCrewLabour.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'

/**
 * Checks if a vendor has enough available crew members to fulfill a request.
 * 
 * @param {string} vendorId - The vendor's ID.
 * @param {Array} lines - Array of { categoryId, quantity }
 * @param {Date} startDate - Project start date
 * @param {Date} endDate - Project end date (optional, defaults to startDate)
 * @returns {Promise<{ hasInventory: boolean, availableCrew: Array, missing: Array }>}
 */
export async function checkVendorInventory(vendorId, lines, startDate, endDate) {
  if (!endDate) endDate = startDate

  // Map categoryId to Category names
  const categoryIds = lines.map(l => l.categoryId)
  const categories = await LabourSubcategory.find({ _id: { $in: categoryIds } }).lean()
  const categoryIdToName = {}
  categories.forEach(c => categoryIdToName[c._id.toString()] = c.name)

  // 1. Fetch all crew members for this vendor
  const crew = await VendorCrewLabour.find({ 
    vendorId, 
    status: 'active',
    verificationStatus: 'approved'
  }).lean()

  if (!crew.length) {
    return { hasInventory: false, availableCrew: [], missing: lines }
  }

  const crewIds = crew.map(c => c._id)

  // 2. Find active assignments for these crew members that overlap with the requested dates
  const activeAssignments = await Assignment.find({
    labourId: { $in: crewIds },
    status: { $in: [ASSIGNMENT_STATUS.OFFERED, ASSIGNMENT_STATUS.ACCEPTED, ASSIGNMENT_STATUS.ON_SITE] }
  })
    .populate({
      path: 'requestId',
      select: 'startDate endDate',
      match: {
        startDate: { $lte: endDate },
        $or: [
          { endDate: { $gte: startDate } },
          { endDate: null } // If no end date, assume it overlaps
        ]
      }
    })
    .lean()

  // Filter out assignments where the populated requestId is null (meaning it didn't match the date filter)
  const overlappingAssignments = activeAssignments.filter(a => a.requestId)
  const busyCrewIds = overlappingAssignments.map(a => String(a.labourId))

  // 3. Filter available crew
  const availableCrew = crew.filter(c => !busyCrewIds.includes(String(c._id)))

  // 4. Verify if available crew can fulfill the requested lines
  let hasInventory = true
  const missing = []
  const billingBreakdown = []
  const remainingCrew = [...availableCrew]

  for (const line of lines) {
    const reqCatName = categoryIdToName[String(line.categoryId)]
    let allocatedCount = 0
    let categoryAdminPriceTotal = 0

    if (reqCatName) {
      // Find workers who have this category
      for (let i = remainingCrew.length - 1; i >= 0; i--) {
        const worker = remainingCrew[i]
        
        if (worker.category === reqCatName) {
          allocatedCount++
          const adminPrice = worker.services?.[0]?.adminPrice ?? worker.services?.[0]?.price ?? 0
          categoryAdminPriceTotal += adminPrice
          remainingCrew.splice(i, 1) // Remove from pool so they can't be used for another line
        }

        if (allocatedCount === line.quantity) {
          break // Fulfilled this line
        }
      }
    }

    if (allocatedCount > 0) {
      billingBreakdown.push({
        categoryId: line.categoryId,
        categoryName: reqCatName,
        serviceName: line.serviceName || undefined,
        quantity: allocatedCount,
        adminPriceTotal: categoryAdminPriceTotal,
        adminPricePerWorker: allocatedCount > 0 ? (categoryAdminPriceTotal / allocatedCount) : 0
      })
    }

    if (allocatedCount < line.quantity) {
      hasInventory = false
      missing.push({
        categoryId: line.categoryId,
        requested: line.quantity,
        available: allocatedCount
      })
    }
  }

  return { hasInventory, availableCrew, missing, billingBreakdown }
}

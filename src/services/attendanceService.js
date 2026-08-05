import mongoose from 'mongoose'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'
import { VendorCrewLabour } from '../models/VendorCrewLabour.js'
import { Invoice, generateInvoiceNumber } from '../models/Invoice.js'
import { INVOICE_STATUS, ATTENDANCE_STATUS, REQUEST_STATUS } from '../constants/workforceConstants.js'
import { emitToUser } from '../socket.js'

export function formatDateToYMD(d) {
  const date = new Date(d)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDateRangeList(startDate, endDate) {
  const dates = []
  if (!startDate) return dates
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date(startDate)

  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  while (cur <= stop) {
    const dateStr = formatDateToYMD(cur)
    dates.push({
      dateStr,
      date: new Date(cur),
    })
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

/**
 * Ensures attendance records exist for all booked dates and all booked crew members.
 */
export async function ensureDailyAttendanceForRequest(request, vendorId) {
  if (!request || !request._id) return []

  const dates = getDateRangeList(request.startDate, request.endDate)
  if (dates.length === 0) return []

  let crewIds = request.preferredCrewIds || []
  let crewList = []

  // Resolve labour details from preferredCrewIds
  if (crewIds.length > 0) {
    if (typeof crewIds[0] === 'object' && crewIds[0]?.fullName) {
      crewList = crewIds
    } else {
      crewList = await VendorCrewLabour.find({ _id: { $in: crewIds } }).lean()
      if (!crewList || crewList.length === 0) {
        crewList = await User.find({ _id: { $in: crewIds } }).lean()
      }
    }
  }

  // Also resolve from assignments if this is a broadcast request or dynamically assigned
  const assignments = await Assignment.find({ requestId: request._id }).lean()
  
  if (assignments.length > 0) {
    // If we have direct assignments, we fetch those labourers too
    const assignedLabourIds = assignments.map(a => a.labourId)
    const assignedLabour = await VendorCrewLabour.find({ _id: { $in: assignedLabourIds } }).lean()
    
    // Add to crewList if not already there
    for (const labour of assignedLabour) {
      if (!crewList.find(c => String(c._id) === String(labour._id))) {
        crewList.push(labour)
      }
    }
  }

  if (crewList.length === 0) return []

  const recordsToInsert = []

  for (const day of dates) {
    for (const crew of crewList) {
      const labourId = crew._id
      const exists = await AttendanceRecord.findOne({
        requestId: request._id,
        shiftDateStr: day.dateStr,
        labourId,
      })

      if (!exists) {
        const serviceName = crew.services?.[0]?.name || crew.serviceName || crew.category || 'Specialist Labour'
        const adminPrice = crew.services?.[0]?.adminPrice || crew.services?.[0]?.price || crew.price || 0
        const vendorPrice = crew.services?.[0]?.price || crew.price || 0

        recordsToInsert.push({
          requestId: request._id,
          allocationId: request.allocationId,
          vendorId: vendorId || request.preferredVendorId,
          clientId: request.clientId,
          labourId,
          labourName: crew.fullName || 'Labour',
          labourCategory: crew.category || 'Specialist Labour',
          labourServiceName: serviceName,
          projectId: request.projectId,
          siteId: request.siteId,
          shiftDate: day.date,
          shiftDateStr: day.dateStr,
          status: ATTENDANCE_STATUS.SCHEDULED,
          adminPricePerDay: adminPrice,
          vendorPricePerDay: vendorPrice,
        })
      }
    }
  }

  if (recordsToInsert.length > 0) {
    try {
      await AttendanceRecord.insertMany(recordsToInsert, { ordered: false })
    } catch (err) {
      // Ignore duplicate key errors if created concurrently
      if (err.code !== 11000) {
        console.error('Error inserting attendance records:', err)
      }
    }
  }

  return AttendanceRecord.find({ requestId: request._id }).sort({ shiftDate: 1 }).lean()
}

/**
 * Get daily attendance for Corporate Client
 */
export async function getCorporateAttendanceData(corporateUserId, dateFilter) {
  const selectedDateStr = dateFilter ? formatDateToYMD(dateFilter) : formatDateToYMD(new Date())

  // Find all confirmed or active workforce requests for this corporate client
  const requests = await WorkforceRequest.find({
    clientId: corporateUserId,
    status: {
      $in: [
        REQUEST_STATUS.CONFIRMED,
        REQUEST_STATUS.IN_PROGRESS,
        REQUEST_STATUS.ATTENDANCE,
        REQUEST_STATUS.ALLOCATING,
        REQUEST_STATUS.ASSIGNED,
        REQUEST_STATUS.COMPLETED,
      ],
    },
  })
    .populate('preferredVendorId', 'fullName phone contractorProfile')
    .populate('preferredCrewIds')
    .sort({ createdAt: -1 })
    .lean()

  const resultJobs = []
  const allAvailableDates = new Set()

  for (const req of requests) {
    const allocation = await Allocation.findOne({ requestId: req._id }).lean()
    const vendorId = req.preferredVendorId?._id || allocation?.vendorId

    // Ensure records exist for this request
    await ensureDailyAttendanceForRequest(
      {
        ...req,
        allocationId: allocation?._id,
      },
      vendorId,
    )

    const dateList = getDateRangeList(req.startDate, req.endDate)
    dateList.forEach((d) => allAvailableDates.add(d.dateStr))

    // Fetch records for the selected date
    const dailyRecords = await AttendanceRecord.find({
      requestId: req._id,
      shiftDateStr: selectedDateStr,
    }).lean()

    const vendor = req.preferredVendorId || {}
    const vendorName = vendor.contractorProfile?.businessName || vendor.fullName || 'Vendor'

    resultJobs.push({
      requestId: req._id,
      reference: req.reference,
      status: req.status,
      startDate: req.startDate,
      endDate: req.endDate,
      locationText: req.locationText,
      totalDays: dateList.length,
      bookedDates: dateList.map((d) => d.dateStr),
      vendor: {
        _id: vendor._id,
        name: vendorName,
        businessName: vendor.contractorProfile?.businessName || vendorName,
        rating: vendor.contractorProfile?.rating || 4.8,
      },
      attendanceRecords: dailyRecords,
      totalCrewCount: dailyRecords.length || req.preferredCrewIds?.length || 0,
      presentCount: dailyRecords.filter((r) => r.clientCheckIn).length,
      completedCount: dailyRecords.filter((r) => r.clientCheckOut).length,
    })
  }

  // Sorted list of all active booking dates
  const sortedDates = Array.from(allAvailableDates).sort()

  return {
    selectedDate: selectedDateStr,
    availableDates: sortedDates.length > 0 ? sortedDates : [selectedDateStr],
    jobs: resultJobs,
  }
}

/**
 * Get daily attendance for Vendor
 */
export async function getVendorAttendanceData(vendorUserId, dateFilter) {
  const selectedDateStr = dateFilter ? formatDateToYMD(dateFilter) : formatDateToYMD(new Date())

  // Find all allocations or direct requests for this vendor
  const allocations = await Allocation.find({ vendorId: vendorUserId }).distinct('requestId')
  const directRequests = await WorkforceRequest.find({
    preferredVendorId: vendorUserId,
    status: {
      $in: [
        REQUEST_STATUS.CONFIRMED,
        REQUEST_STATUS.IN_PROGRESS,
        REQUEST_STATUS.ATTENDANCE,
        REQUEST_STATUS.ALLOCATING,
        REQUEST_STATUS.ASSIGNED,
        REQUEST_STATUS.COMPLETED,
      ],
    },
  }).distinct('_id')

  const allReqIds = Array.from(new Set([...allocations.map(String), ...directRequests.map(String)]))

  const requests = await WorkforceRequest.find({ _id: { $in: allReqIds } })
    .populate('clientId', 'fullName phone corporateProfile companyName')
    .populate('preferredCrewIds')
    .sort({ createdAt: -1 })
    .lean()

  const resultJobs = []
  const allAvailableDates = new Set()

  for (const req of requests) {
    const allocation = await Allocation.findOne({ requestId: req._id, vendorId: vendorUserId }).lean()

    await ensureDailyAttendanceForRequest(
      {
        ...req,
        allocationId: allocation?._id,
      },
      vendorUserId,
    )

    const dateList = getDateRangeList(req.startDate, req.endDate)
    dateList.forEach((d) => allAvailableDates.add(d.dateStr))

    const dailyRecords = await AttendanceRecord.find({
      requestId: req._id,
      shiftDateStr: selectedDateStr,
    }).lean()

    const client = req.clientId || {}
    const clientName = client.corporateProfile?.companyName || client.companyName || client.fullName || 'Corporate Client'

    resultJobs.push({
      requestId: req._id,
      reference: req.reference,
      status: req.status,
      startDate: req.startDate,
      endDate: req.endDate,
      locationText: req.locationText,
      totalDays: dateList.length,
      bookedDates: dateList.map((d) => d.dateStr),
      client: {
        _id: client._id,
        name: clientName,
        companyName: client.corporateProfile?.companyName || clientName,
      },
      attendanceRecords: dailyRecords,
      totalCrewCount: dailyRecords.length || req.preferredCrewIds?.length || 0,
      dispatchedCount: dailyRecords.filter((r) => r.vendorCheckIn).length,
      closedCount: dailyRecords.filter((r) => r.vendorCheckOut).length,
    })
  }

  const sortedDates = Array.from(allAvailableDates).sort()

  return {
    selectedDate: selectedDateStr,
    availableDates: sortedDates.length > 0 ? sortedDates : [selectedDateStr],
    jobs: resultJobs,
  }
}

/**
 * Toggle Attendance Steps with full 4-stage validation and socket emission
 */
export async function toggleAttendanceStep({ user, recordId, action, notes }) {
  const record = await AttendanceRecord.findById(recordId)
  if (!record) {
    throw new Error('Attendance record not found')
  }

  const now = new Date()
  const todayStr = formatDateToYMD(now)

  // Validate that action is only performed on current date
  if (record.shiftDateStr !== todayStr) {
    throw new Error('Check-in and check-out can only be performed on the current shift date.')
  }

  if (action === 'vendorCheckIn') {
    // Step 1: Vendor dispatches labour
    if (String(record.vendorId) !== String(user._id)) {
      throw new Error('Unauthorized: Only the assigned vendor can perform vendor check-in')
    }
    record.vendorCheckIn = true
    record.vendorCheckInAt = now
    record.checkInAt = now
    record.status = ATTENDANCE_STATUS.DISPATCHED
    if (notes) record.notes = notes
  } else if (action === 'clientCheckIn') {
    // Step 2: Client marks present on site
    if (String(record.clientId) !== String(user._id)) {
      throw new Error('Unauthorized: Only the corporate client can confirm on-site arrival')
    }
    if (!record.vendorCheckIn) {
      throw new Error('Vendor must check in (dispatch labour) first before client check-in')
    }
    record.clientCheckIn = true
    record.clientCheckInAt = now
    record.status = ATTENDANCE_STATUS.PRESENT
    record.billableUnits = 0.5
    if (notes) record.notes = notes
  } else if (action === 'clientCheckOut') {
    // Step 3: Client marks work completed at shift end
    if (String(record.clientId) !== String(user._id)) {
      throw new Error('Unauthorized: Only the corporate client can mark work completed')
    }
    if (!record.clientCheckIn) {
      throw new Error('Client must check in labour first before check-out')
    }
    record.clientCheckOut = true
    record.clientCheckOutAt = now
    record.status = ATTENDANCE_STATUS.WORK_COMPLETED
    record.billableUnits = 1.0
    if (notes) record.notes = notes
  } else if (action === 'vendorCheckOut') {
    // Step 4: Vendor marks shift closed / labour returned
    if (String(record.vendorId) !== String(user._id)) {
      throw new Error('Unauthorized: Only the assigned vendor can close shift')
    }
    if (!record.clientCheckOut) {
      throw new Error('Client must check out labour first before vendor shift close')
    }
    record.vendorCheckOut = true
    record.vendorCheckOutAt = now
    record.checkOutAt = now
    record.status = ATTENDANCE_STATUS.COMPLETED
    record.billableUnits = 1.0
    if (notes) record.notes = notes
  } else {
    throw new Error('Invalid attendance action: ' + action)
  }

  await record.save()

  if (action === 'vendorCheckOut') {
    const request = await WorkforceRequest.findById(record.requestId).lean()
    if (request) {
      const shiftYMD = formatDateToYMD(record.shiftDateStr)
      const endYMD = request.endDate ? formatDateToYMD(request.endDate) : formatDateToYMD(request.startDate)
      
      if (shiftYMD >= endYMD) {
        // Mark Assignment as completed
        if (record.assignmentId) {
          await Assignment.findByIdAndUpdate(record.assignmentId, {
            status: 'completed',
            completedAt: now
          })
        }
        
        // Generate Vendor Invoice (Settlement) if not exists
        const existingInv = await Invoice.findOne({ 
          vendorId: record.vendorId, 
          requestId: record.requestId, 
          'lines.categoryId': record.assignmentId // Use categoryId as a hack to store assignmentId to prevent duplicates, or just type: 'vendor_settlement'
        })
        
        // Wait, let's just find by assignmentId in a better way, but invoice model doesn't have assignmentId.
        // We can just rely on one invoice per request per vendor for simplicity, or just let it generate multiple if we don't check carefully.
        // Let's create an invoice for the vendor.
        const vendorInvoiceExists = await Invoice.findOne({
          vendorId: record.vendorId,
          requestId: record.requestId,
          status: INVOICE_STATUS.ISSUED
        })

        if (!vendorInvoiceExists) {
          // Calculate total for all attendance records for this vendor on this request
          const allVendorRecords = await AttendanceRecord.find({
            requestId: record.requestId,
            vendorId: record.vendorId,
            billableUnits: { $gt: 0 }
          }).lean()

          let totalAmount = 0
          for (const rec of allVendorRecords) {
            let price = 0
            const crew = await VendorCrewLabour.findById(rec.labourId).lean()
            if (crew && crew.services && crew.services.length > 0) {
              price = crew.services[0].price || 0
            } else {
              price = 300 // default fallback
            }
            totalAmount += (rec.billableUnits * price)
          }

          if (totalAmount > 0) {
            await Invoice.create({
              invoiceNumber: generateInvoiceNumber(),
              vendorId: record.vendorId,
              requestId: record.requestId,
              projectId: request.projectId,
              type: 'attendance',
              billingMode: request.billingMode,
              status: INVOICE_STATUS.ISSUED,
              lines: [{
                description: 'Vendor Labour Settlement',
                billableUnits: allVendorRecords.reduce((s, r) => s + r.billableUnits, 0),
                ratePerUnit: 0, // variable rates
                amount: totalAmount,
                gstAmount: 0
              }],
              subtotal: totalAmount,
              gstTotal: 0,
              total: totalAmount,
              issuedAt: new Date(),
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            })
          }
        } else {
          // If vendor invoice already exists for this request, just update its total
          // This handles cases where multiple labourers finish at different times
          const allVendorRecords = await AttendanceRecord.find({
            requestId: record.requestId,
            vendorId: record.vendorId,
            billableUnits: { $gt: 0 }
          }).lean()

          let totalAmount = 0
          for (const rec of allVendorRecords) {
            let price = 0
            const crew = await VendorCrewLabour.findById(rec.labourId).lean()
            if (crew && crew.services && crew.services.length > 0) {
              price = crew.services[0].price || 0
            } else {
              price = 300 // default fallback
            }
            totalAmount += (rec.billableUnits * price)
          }

          if (totalAmount > 0) {
            vendorInvoiceExists.lines[0].billableUnits = allVendorRecords.reduce((s, r) => s + r.billableUnits, 0)
            vendorInvoiceExists.lines[0].amount = totalAmount
            vendorInvoiceExists.subtotal = totalAmount
            vendorInvoiceExists.total = totalAmount
            await vendorInvoiceExists.save()
          }
        }
      }
    }
  }

  // Real-time notification to both Client and Vendor
  const payload = {
    recordId: record._id,
    requestId: record.requestId,
    shiftDateStr: record.shiftDateStr,
    labourId: record.labourId,
    labourName: record.labourName,
    action,
    vendorCheckIn: record.vendorCheckIn,
    vendorCheckInAt: record.vendorCheckInAt,
    clientCheckIn: record.clientCheckIn,
    clientCheckInAt: record.clientCheckInAt,
    clientCheckOut: record.clientCheckOut,
    clientCheckOutAt: record.clientCheckOutAt,
    vendorCheckOut: record.vendorCheckOut,
    vendorCheckOutAt: record.vendorCheckOutAt,
    status: record.status,
  }

  if (record.clientId) {
    emitToUser(record.clientId, 'ATTENDANCE_UPDATED', payload)
  }
  if (record.vendorId) {
    emitToUser(record.vendorId, 'ATTENDANCE_UPDATED', payload)
  }

  return record
}

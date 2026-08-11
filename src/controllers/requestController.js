import mongoose from 'mongoose'
import { USER_ROLES, CORPORATE_STATUS } from '../constants/roles.js'
import {
  REQUEST_SOURCE,
  REQUEST_STATUS,
} from '../constants/workforceConstants.js'
import { WorkforceRequest, generateRequestReference } from '../models/WorkforceRequest.js'
import { Assignment } from '../models/Assignment.js'
import { Allocation } from '../models/Allocation.js'
import { checkVendorInventory } from '../services/vendorInventoryService.js'
import { emitToUser } from '../socket.js'
import { sendToUser, notifyAdmins } from '../services/notificationService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

import { User } from '../models/User.js'
import VendorCrewLabour from '../models/VendorCrewLabour.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourService } from '../models/LabourService.js'

function parseLines(lines) {
  if (!Array.isArray(lines) || !lines.length) return null
  return lines
    .map((l) => ({
      categoryId: mongoose.Types.ObjectId.isValid(l.categoryId) ? l.categoryId : undefined,
      categoryName: l.categoryName || undefined,
      serviceId: mongoose.Types.ObjectId.isValid(l.serviceId) ? l.serviceId : undefined,
      serviceName: l.serviceName || undefined,
      adminPrice: typeof l.adminPrice === 'number' ? l.adminPrice : Number(l.adminPrice) || 0,
      vendorPrice: typeof l.vendorPrice === 'number' ? l.vendorPrice : Number(l.vendorPrice) || 0,
      quantity: Math.max(1, Number(l.quantity) || 1),
    }))
    .filter((l) => l.categoryId || l.serviceId || l.serviceName)
}

export const createRequest = asyncHandler(async (req, res) => {
  const user = req.user
  let sourceType = REQUEST_SOURCE.INDIVIDUAL
  if (user.role === USER_ROLES.CORPORATE || user.role === USER_ROLES.ADMIN || user.role === 'super_admin') {
    if (user.role === USER_ROLES.CORPORATE && user.corporateProfile?.status !== CORPORATE_STATUS.APPROVED) {
      return sendError(res, {
        message: 'Corporate account must be approved',
        statusCode: HTTP_STATUS.FORBIDDEN,
      })
    }
    // If Admin/Super admin is testing, we can infer sourceType from req.body.preferredVendorId or just default to CORPORATE for their testing
    if (user.role !== USER_ROLES.CORPORATE && req.body.projectName) {
      sourceType = REQUEST_SOURCE.CORPORATE
    } else if (user.role === USER_ROLES.CORPORATE) {
      sourceType = REQUEST_SOURCE.CORPORATE
    }
  } else if (user.role !== USER_ROLES.INDIVIDUAL) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const {
    projectId,
    siteId,
    startDate,
    endDate,
    shiftStart,
    lines,
    locationText,
    notes,
    billingMode,
    bookingType,
    bookingMode,
    scheduleTime,
    preferredVendorId,
    selectedCrewIds,
    paymentMethod,
  } = req.body

  const parsedLines = parseLines(lines)
  if (!parsedLines?.length) {
    return sendError(res, { message: 'At least one skill line required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  let finalStartDate = startDate ? new Date(startDate) : new Date()
  let finalShiftStart = shiftStart

  if (bookingMode === 'instant') {
    finalStartDate = new Date()
    // Add 1 hour buffer
    const bufferTime = new Date(finalStartDate.getTime() + 60 * 60 * 1000)
    finalShiftStart = `${bufferTime.getHours().toString().padStart(2, '0')}:${bufferTime.getMinutes().toString().padStart(2, '0')}`
  } else if (!startDate) {
    return sendError(res, { message: 'Start date required for scheduled requests', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let finalProjectId = projectId && mongoose.Types.ObjectId.isValid(projectId) ? projectId : undefined
  if (req.body.projectName && sourceType === REQUEST_SOURCE.CORPORATE) {
    const Project = (await import('../models/Project.js')).Project
    const pName = req.body.projectName.trim()
    let proj = await Project.findOne({ corporateId: user._id, name: new RegExp(`^${pName}$`, 'i') })
    if (!proj) {
      proj = await Project.create({ corporateId: user._id, name: pName })
    }
    finalProjectId = proj._id
  }

  if (preferredVendorId && mongoose.Types.ObjectId.isValid(preferredVendorId)) {
    const sDate = new Date(startDate)
    const eDate = endDate ? new Date(endDate) : sDate
    const inventory = await checkVendorInventory(preferredVendorId, parsedLines, sDate, eDate)

    if (!inventory.hasInventory) {
      return sendError(res, {
        message: 'The selected vendor does not have enough available workers for the requested dates.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        data: { missing: inventory.missing }
      })
    }
  }

  let validCrewIds = []
  if (Array.isArray(selectedCrewIds)) {
    validCrewIds = selectedCrewIds.filter(id => mongoose.Types.ObjectId.isValid(id))
  }

  let enrichedLines = [...parsedLines]
  if (validCrewIds.length > 0) {
    const VendorCrewLabour = (await import('../models/VendorCrewLabour.js')).default
    const crewMembers = await VendorCrewLabour.find({ _id: { $in: validCrewIds } }).lean()
    enrichedLines = enrichedLines.map(line => {
      const matching = crewMembers.filter(c => 
        (line.categoryName && c.category === line.categoryName) ||
        (line.serviceName && c.services?.some(s => s.name === line.serviceName))
      )
      if (matching.length > 0) {
        const first = matching[0]
        const serv = first.services?.[0]
        const adminPrice = serv?.adminPrice ?? serv?.price ?? line.adminPrice ?? 0
        const serviceName = line.serviceName || serv?.name || first.category
        const categoryName = line.categoryName || first.category
        return {
          ...line,
          serviceName,
          categoryName,
          adminPrice,
        }
      }
      return line
    })
  }

  const SystemSetting = (await import('../models/SystemSetting.js')).SystemSetting
  const globalSettings = await SystemSetting.findOne({ configKey: 'master_config' }).lean()
  const b2bPlatformFeeConfig = globalSettings?.b2bPlatformFee?.isActive ? globalSettings.b2bPlatformFee : null

  let days = 1
  if (finalStartDate && endDate) {
    const sDate = new Date(finalStartDate)
    const eDate = new Date(endDate)
    sDate.setHours(0,0,0,0)
    eDate.setHours(0,0,0,0)
    days = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1)
  }

  const basePriceTotal = enrichedLines.reduce((sum, line) => {
    return sum + ((line.adminPrice || 0) * (Number(line.quantity) || 1) * days)
  }, 0)

  let platformFee = 0
  if (b2bPlatformFeeConfig) {
    if (b2bPlatformFeeConfig.type === 'fixed') {
      platformFee = b2bPlatformFeeConfig.value
    } else {
      platformFee = (basePriceTotal * b2bPlatformFeeConfig.value) / 100
    }
  }
  
  let commissionAmount = 0

  const gstPercentage = globalSettings?.gstPercentage || 0
  const taxAmount = ((platformFee + commissionAmount) * gstPercentage) / 100
  
  const totalAmount = basePriceTotal + platformFee + taxAmount

  const request = await WorkforceRequest.create({
    reference: generateRequestReference(sourceType === REQUEST_SOURCE.CORPORATE ? 'CR' : 'IR'),
    sourceType,
    clientId: user._id,
    projectId: finalProjectId,
    siteId: siteId && mongoose.Types.ObjectId.isValid(siteId) ? siteId : undefined,
    startDate: finalStartDate,
    endDate: endDate ? new Date(endDate) : undefined,
    shiftStart: finalShiftStart,
    lines: enrichedLines,
    locationText,
    notes,
    billingMode,
    bookingType,
    bookingMode,
    scheduleTime,
    preferredVendorId: preferredVendorId && mongoose.Types.ObjectId.isValid(preferredVendorId) ? preferredVendorId : undefined,
    preferredCrewIds: validCrewIds.length ? validCrewIds : undefined,
    status: (preferredVendorId && mongoose.Types.ObjectId.isValid(preferredVendorId)) ? REQUEST_STATUS.BROADCASTED : REQUEST_STATUS.PENDING_REVIEW,
    paymentMethod: paymentMethod === 'CASH' ? 'CASH' : 'ONLINE',
    paymentStatus: 'PENDING',
    totalAmount,
    platformFee,
    commissionAmount,
    taxAmount,
  })

  // Bypass admin and emit socket instantly if it's a direct request
  if (request.status === REQUEST_STATUS.BROADCASTED && request.preferredVendorId) {
    emitToUser(request.preferredVendorId, 'B2B_DIRECT_REQUEST', {
      requestId: request._id,
      clientId: request.clientId
    })

    sendToUser(request.preferredVendorId, {
      title: 'New direct booking request',
      body: `${user.fullName || 'A corporate client'} sent you a direct workforce request (${request.reference}). Open the app to accept.`,
      type: 'B2B_DIRECT_REQUEST',
      data: { requestId: String(request._id), link: '/vendor/jobs' },
    }).catch(err => console.error('Push notify (direct request) failed:', err))
  } else if (request.status === REQUEST_STATUS.PENDING_REVIEW) {
    // Admin is the approval bottleneck — surface the new request in their queue
    notifyAdmins({
      title: 'Workforce request awaiting review',
      body: `New request ${request.reference} is pending review.`,
      type: 'B2B_PENDING_REVIEW',
      data: { requestId: String(request._id), link: '/admin/bookings' },
    }).catch(err => console.error('Push notify (pending review) failed:', err))
  }

  sendSuccess(res, { data: { request }, statusCode: HTTP_STATUS.CREATED })
})

export const listMyRequests = asyncHandler(async (req, res) => {
  const filter = { clientId: req.user._id }
  if (req.query.status) filter.status = req.query.status
  const requests = await WorkforceRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('preferredVendorId', 'fullName contractorProfile.businessName')
    .populate('preferredCrewIds', 'fullName category services')
    .lean()

  // Hide vendor and labour phone numbers from corporate clients
  const sanitizedRequests = requests.map(r => {
    if (r.preferredVendorId) {
      delete r.preferredVendorId.phone
    }
    if (Array.isArray(r.preferredCrewIds)) {
      r.preferredCrewIds = r.preferredCrewIds.map(c => {
        const primaryService = c.services?.[0]
        return {
          _id: c._id,
          fullName: c.fullName,
          category: c.category,
          serviceName: primaryService?.name || c.category,
          adminPrice: Number(primaryService?.adminPrice ?? primaryService?.price ?? 0)
        }
      })
    }
    return r
  })

  sendSuccess(res, { data: { requests: sanitizedRequests } })
})

export const getRequest = asyncHandler(async (req, res) => {
  let request = await WorkforceRequest.findById(req.params.id)
    .populate('clientId', 'fullName phone corporateProfile')
    .populate('preferredVendorId', 'fullName contractorProfile.businessName phone email')
    .populate('preferredCrewIds', 'fullName address city state category services verificationStatus profileImageUrl phone email')
    .lean()
  if (!request) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const clientId = request.clientId?._id || request.clientId
  const isOwner = String(clientId) === String(req.user._id)
  const isAdmin = req.user.role === USER_ROLES.ADMIN
  if (!isOwner && !isAdmin) {
    return sendError(res, { message: 'Forbidden', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  // Explicit fallback if preferredCrewIds was not fully populated by mongoose
  if (Array.isArray(request.preferredCrewIds) && request.preferredCrewIds.length > 0 && !request.preferredCrewIds[0]?.fullName) {
    const crewDocs = await VendorCrewLabour.find({ _id: { $in: request.preferredCrewIds } }).lean()
    request.preferredCrewIds = crewDocs
  }

  // Resolve category and service details for lines if available
  const subcatIds = (request.lines || []).map(l => l.categoryId?._id || l.categoryId).filter(Boolean)
  const serviceIds = (request.lines || []).map(l => l.serviceId?._id || l.serviceId).filter(Boolean)
  
  const [subcats, servicesList, cats] = await Promise.all([
    subcatIds.length ? LabourSubcategory.find({ _id: { $in: subcatIds } }).lean() : [],
    serviceIds.length ? LabourService.find({ _id: { $in: serviceIds } }).lean() : [],
    subcatIds.length ? LabourCategory.find({ _id: { $in: subcatIds } }).lean() : [],
  ])

  const subcatMap = new Map(subcats.map(s => [String(s._id), s.name]))
  const catMap = new Map(cats.map(c => [String(c._id), c.name]))
  const serviceMap = new Map(servicesList.map(s => [String(s._id), s]))

  // Calculate days duration
  const start = new Date(request.startDate)
  const end = request.endDate ? new Date(request.endDate) : start
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  // Build serviceBreakdown
  const serviceBreakdown = []
  const groupMap = {}

  if (Array.isArray(request.preferredCrewIds) && request.preferredCrewIds.length > 0) {
    // Group from explicit preferred crew members
    for (const crew of request.preferredCrewIds) {
      const primaryService = crew.services?.[0]
      const categoryName = crew.category || 'General'
      const serviceName = primaryService?.name || crew.category || 'Labour'
      const adminPrice = Number(primaryService?.adminPrice ?? primaryService?.price ?? 0)

      // Decorate crew object
      crew.categoryName = categoryName
      crew.serviceName = serviceName
      crew.adminPrice = adminPrice
      if (!isAdmin) {
        delete crew.phone
      }

      const key = `${categoryName}_${serviceName}`
      if (!groupMap[key]) {
        groupMap[key] = {
          serviceName,
          categoryName,
          quantity: 0,
          adminPricePerDay: 0,
          totalPricePerDay: 0,
          totalPriceForDuration: 0,
          labourers: []
        }
      }
      groupMap[key].quantity += 1
      groupMap[key].adminPricePerDay += adminPrice // keeping track of sum for this group
      groupMap[key].totalPricePerDay += adminPrice
      groupMap[key].labourers.push({ labourName: crew.fullName, adminPrice, _id: crew._id })
    }

    for (const key of Object.keys(groupMap)) {
      const g = groupMap[key]
      g.totalPriceForDuration = g.totalPricePerDay * days
      serviceBreakdown.push(g)
    }
  } else if (request.lines && request.lines.length > 0) {
    // Fallback to lines definitions
    for (const line of request.lines) {
      const lineCatId = String(line.categoryId?._id || line.categoryId || '')
      const lineServId = String(line.serviceId?._id || line.serviceId || '')
      const servObj = lineServId ? serviceMap.get(lineServId) : null
      const catName = line.categoryName || subcatMap.get(lineCatId) || catMap.get(lineCatId) || 'Labour'
      const servName = line.serviceName || servObj?.name || catName
      const adminPrice = Number(line.adminPrice || servObj?.basePrice || 0)
      const qty = Number(line.quantity) || 1

      serviceBreakdown.push({
        serviceName: servName,
        categoryName: catName,
        quantity: qty,
        adminPricePerDay: adminPrice,
        totalPricePerDay: adminPrice * qty,
        totalPriceForDuration: adminPrice * qty * days,
        labourers: Array(qty).fill({ labourName: 'Labourer', adminPrice })
      })
    }
  }

  // Update request.lines with enriched names and admin prices for clean frontend access
  request.lines = (request.lines || []).map((line, idx) => {
    const matchedBreakdown = serviceBreakdown[idx] || {}
    const lineCatId = String(line.categoryId?._id || line.categoryId || '')
    const lineServId = String(line.serviceId?._id || line.serviceId || '')
    const catName = line.categoryName || subcatMap.get(lineCatId) || catMap.get(lineCatId) || matchedBreakdown.categoryName || 'Labour'
    const servObj = lineServId ? serviceMap.get(lineServId) : null
    const servName = line.serviceName || servObj?.name || matchedBreakdown.serviceName || catName
    const adminPrice = line.adminPrice || matchedBreakdown.adminPricePerDay || servObj?.basePrice || 0
    const quantity = Number(line.quantity) || matchedBreakdown.quantity || 1
    const lineDailyTotal = matchedBreakdown.totalPricePerDay || (adminPrice * quantity)
    const lineDurationTotal = matchedBreakdown.totalPriceForDuration || (lineDailyTotal * days)

    return {
      ...line,
      serviceName: servName,
      categoryName: catName,
      adminPrice,
      quantity,
      dailyTotal: lineDailyTotal,
      durationTotal: lineDurationTotal,
      categoryId: line.categoryId ? {
        _id: line.categoryId?._id || line.categoryId,
        name: catName,
        adminPrice
      } : undefined
    }
  })

  // Fetch all categories and subcategories to map their GST percentages
  const allCategories = await LabourCategory.find({}).lean()
  const LabourSubcategoryModel = (await import('../models/LabourSubcategory.js')).LabourSubcategory
  const allSubcategories = await LabourSubcategoryModel.find({}).lean()
  
  const categoryGstMap = new Map()
  allCategories.forEach(c => {
    const gst = c.isGstActive ? (c.gstPercentage || 0) : 0
    categoryGstMap.set(c.name, gst)
    categoryGstMap.set(String(c._id), gst)
  })
  allSubcategories.forEach(sc => {
    const parentGst = categoryGstMap.get(String(sc.categoryId)) || 0
    categoryGstMap.set(sc.name, parentGst)
  })

  // Global settings for platform fee
  const SystemSetting = (await import('../models/SystemSetting.js')).SystemSetting
  const globalSettings = await SystemSetting.findOne({ configKey: 'master_config' }).lean()
  let platformFeeConfig = null
  if (request.sourceType === REQUEST_SOURCE.CORPORATE) {
    platformFeeConfig = globalSettings?.b2bPlatformFee?.isActive ? globalSettings.b2bPlatformFee : null
  } else {
    platformFeeConfig = globalSettings?.platformFee?.isActive ? globalSettings.platformFee : null
  }

  // Calculate overall totals
  const perDayBaseTotal = serviceBreakdown.reduce((sum, item) => sum + item.totalPricePerDay, 0)
  const basePriceTotal = perDayBaseTotal * days

  let platformFee = 0
  if (platformFeeConfig?.isActive) {
    if (platformFeeConfig.type === 'fixed') {
      platformFee = Number(platformFeeConfig.value) || 0
    } else {
      platformFee = (basePriceTotal * (Number(platformFeeConfig.value) || 0)) / 100
    }
  } else {
    platformFee = 100
  }

  const estimatedTotal = basePriceTotal + Math.round(platformFee)

  // Calculate GST per category for corporate requests
  let taxAmount = 0
  if (request.sourceType === REQUEST_SOURCE.CORPORATE) {
    serviceBreakdown.forEach(item => {
      const gstPercent = categoryGstMap.get(item.categoryName) || 0
      item.gstPercentage = gstPercent
      item.gstAmount = (item.totalPriceForDuration * gstPercent) / 100
      taxAmount += item.gstAmount
    })
  }

  const pricingSummary = {
    days,
    perDayBaseTotal,
    basePriceTotal,
    platformFee: Math.round(platformFee),
    taxAmount: Math.round(taxAmount),
    estimatedTotal: Math.round(estimatedTotal + taxAmount)
  }

  const allocation = await Allocation.findOne({ requestId: request._id })
    .populate('vendorId', 'fullName contractorProfile.businessName')
    .lean()
  let assignments = await Assignment.find({ requestId: request._id })
    .populate('labourId', 'fullName category services profileImageUrl labourProfile.kycStatus')
    .populate('vendorId', 'fullName contractorProfile.businessName')
    .lean()

  // Hide worker identities and vendor price from assignments for corporate
  if (!isAdmin && assignments?.length) {
    assignments = assignments.map(a => {
      if (a.labourId) {
        delete a.labourId.phone
        a.labourId.fullName = `Worker (ID: ${String(a.labourId._id).slice(-4).toUpperCase()})`
        
        if (a.labourId.services && a.labourId.services.length > 0) {
          a.labourId.services = a.labourId.services.map(s => {
            if (s.price !== undefined) delete s.price
            return s
          })
        }
      }
      return a
    })
  }

  // Hide vendor private info (phone/email) but keep names visible for corporate
  if (!isAdmin && request.preferredVendorId) {
    delete request.preferredVendorId.phone
    delete request.preferredVendorId.email
  }

  sendSuccess(res, {
    data: {
      request,
      serviceBreakdown,
      pricingSummary,
      allocation,
      assignments,
      platformFeeConfig
    }
  })
})

export const listAdminRequests = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.status) filter.status = req.query.status
  if (req.query.sourceType) filter.sourceType = req.query.sourceType
  const requests = await WorkforceRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('clientId', 'fullName phone role corporateProfile companyName')
    .populate('preferredVendorId', 'fullName contractorProfile phone')
    .populate('preferredCrewIds', 'fullName phone category services')
    .lean()

  const requestIds = requests.map(r => r._id)
  
  const assignments = await Assignment.find({ requestId: { $in: requestIds } })
    .populate('labourId', 'fullName phone category services')
    .populate('vendorId', 'fullName contractorProfile phone')
    .lean()

  // Attach assignments to their respective requests
  for (const req of requests) {
    req.assignments = assignments.filter(a => String(a.requestId) === String(req._id))
  }

  sendSuccess(res, { data: { requests } })
})

export const patchRequestStatusAdmin = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body
  const request = await WorkforceRequest.findById(req.params.id)
  if (!request) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (!Object.values(REQUEST_STATUS).includes(status)) {
    return sendError(res, { message: 'Invalid status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  request.status = status
  if (adminNote != null) request.adminNote = String(adminNote).trim()
  request.reviewedBy = req.user._id
  request.reviewedAt = new Date()
  await request.save()

  // Notify vendor if it's a direct request and is being broadcasted/approved
  if (status === REQUEST_STATUS.BROADCASTED && request.preferredVendorId) {
    emitToUser(request.preferredVendorId, 'B2B_DIRECT_REQUEST', {
      requestId: request._id,
      clientId: request.clientId
    })

    sendToUser(request.preferredVendorId, {
      title: 'New booking request',
      body: `Workforce request ${request.reference} has been assigned to you. Open the app to accept.`,
      type: 'B2B_DIRECT_REQUEST',
      data: { requestId: String(request._id), link: '/vendor/jobs' },
    }).catch(err => console.error('Push notify (direct request) failed:', err))
  }

  // Tell the client how their request review went
  const clientStatusMessages = {
    [REQUEST_STATUS.BROADCASTED]: { title: 'Request approved', body: `Your request ${request.reference} was approved and sent to vendors.` },
    [REQUEST_STATUS.REJECTED]: { title: 'Request rejected', body: `Your request ${request.reference} was rejected.${request.adminNote ? ` Note: ${request.adminNote}` : ''}` },
    [REQUEST_STATUS.CANCELLED]: { title: 'Request cancelled', body: `Your request ${request.reference} was cancelled by the admin.` },
  }
  const clientMsg = clientStatusMessages[status]
  if (clientMsg) {
    sendToUser(request.clientId, {
      title: clientMsg.title,
      body: clientMsg.body,
      type: `B2B_REQUEST_${String(status).toUpperCase()}`,
      data: { requestId: String(request._id), status, link: `/corporate/requests/${request._id}` },
    }).catch(err => console.error('Push notify (request status) failed:', err))
  }

  sendSuccess(res, { data: { request } })
})

export const deleteAdminRequest = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findByIdAndDelete(req.params.id)
  if (!request) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  sendSuccess(res, { message: 'Request deleted successfully' })
})

export const mockPayRequest = asyncHandler(async (req, res) => {
  const request = await WorkforceRequest.findById(req.params.id);
  if (!request) return sendError(res, { message: 'Not found', statusCode: 404 });
  
  request.paymentStatus = 'PAID';
  request.status = 'completed';
  await request.save();

  const Invoice = (await import('../models/Invoice.js')).Invoice;
  const Assignment = (await import('../models/Assignment.js')).Assignment;
  const { generateInvoiceNumber } = await import('../models/Invoice.js');
  
  const existingInvoice = await Invoice.findOne({ requestId: request._id, corporateId: request.clientId });
  if (!existingInvoice) {
    const baseAmount = request.totalAmount - (request.platformFee || 0) - (request.taxAmount || 0);
    await Invoice.create({
      invoiceNumber: generateInvoiceNumber(),
      corporateId: request.clientId,
      requestId: request._id,
      projectId: request.projectId,
      type: 'advance',
      status: 'paid',
      paidAt: new Date(),
      total: request.totalAmount || 0,
      subtotal: baseAmount || 0,
      gstTotal: request.taxAmount || 0,
      lines: (request.lines || []).map(l => ({
        description: `Booking for ${l.quantity || 1}x Labour`,
        categoryId: l.categoryId,
        billableUnits: l.quantity || 1,
        amount: (l.adminPrice || 500) * (l.quantity || 1)
      }))
    });
  } else {
    await Invoice.updateMany({ requestId: request._id }, { status: 'paid', paidAt: new Date() });
  }
  
  await Assignment.updateMany({ requestId: request._id }, { status: 'COMPLETED' });

  if (request.sourceType === 'corporate') {
    const { UserSubscription } = await import('../models/UserSubscription.js');
    const activeSub = await UserSubscription.findOne({ user: request.clientId, status: 'active' });
    if (activeSub) {
      activeSub.bookingsUsed += 1;
      await activeSub.save();
    }
  }

  sendSuccess(res, { message: 'Payment simulated successfully' });
});

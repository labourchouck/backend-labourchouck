import mongoose from 'mongoose'
import { USER_ROLES } from '../constants/roles.js'
import { INVOICE_STATUS, REQUEST_STATUS } from '../constants/workforceConstants.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { PricingRate } from '../models/PricingRate.js'
import { Invoice, generateInvoiceNumber } from '../models/Invoice.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const listPricingRatesAdmin = asyncHandler(async (req, res) => {
  const rates = await PricingRate.find({ isActive: true }).sort({ createdAt: -1 }).lean()
  sendSuccess(res, { rates })
})

export const upsertPricingRateAdmin = asyncHandler(async (req, res) => {
  const { categoryId, clientType, corporateId, ratePerShift, workerRatePerShift, gstPercent } = req.body
  if (!mongoose.Types.ObjectId.isValid(categoryId) || ratePerShift == null) {
    return sendError(res, { message: 'categoryId and ratePerShift required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const rate = await PricingRate.create({
    categoryId,
    clientType: clientType || 'individual',
    corporateId: corporateId && mongoose.Types.ObjectId.isValid(corporateId) ? corporateId : undefined,
    ratePerShift: Number(ratePerShift),
    workerRatePerShift: workerRatePerShift != null ? Number(workerRatePerShift) : undefined,
    gstPercent: gstPercent != null ? Number(gstPercent) : 18,
  })
  sendSuccess(res, { rate }, HTTP_STATUS.CREATED)
})

async function resolveRate(categoryId, sourceType, corporateId) {
  let rate = null
  if (corporateId) {
    rate = await PricingRate.findOne({
      categoryId,
      corporateId,
      isActive: true,
    }).sort({ effectiveFrom: -1 })
  }
  if (!rate) {
    rate = await PricingRate.findOne({
      categoryId,
      clientType: sourceType,
      isActive: true,
      corporateId: { $exists: false },
    }).sort({ effectiveFrom: -1 })
  }
  return rate
}

export const generateInvoiceAdmin = asyncHandler(async (req, res) => {
  const { requestId } = req.body
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return sendError(res, { message: 'requestId required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  const request = await WorkforceRequest.findById(requestId).lean()
  if (!request) return sendError(res, { message: 'Request not found', statusCode: HTTP_STATUS.NOT_FOUND })

  const records = await AttendanceRecord.find({
    requestId,
    billableUnits: { $gt: 0 },
  }).lean()

  const lines = []
  let subtotal = 0
  let gstTotal = 0

  for (const line of request.lines || []) {
    const catId = String(line.categoryId)
    const units = records
      .filter((r) => String(r.categoryId || '') === catId || !r.categoryId)
      .reduce((sum, r) => sum + (r.billableUnits || 0), 0)
    const totalUnits = units || records.reduce((s, r) => s + r.billableUnits, 0)
    const rate = await resolveRate(line.categoryId, request.sourceType, request.clientId)
    const ratePer = rate?.ratePerShift ?? 500
    const gstPct = rate?.gstPercent ?? 18
    const amount = totalUnits * ratePer * (line.quantity || 1)
    const gstAmount = (amount * gstPct) / 100
    lines.push({
      description: `Labour — ${line.quantity} workers`,
      categoryId: line.categoryId,
      billableUnits: totalUnits,
      ratePerUnit: ratePer,
      amount,
      gstAmount,
    })
    subtotal += amount
    gstTotal += gstAmount
  }

  if (!lines.length && records.length) {
    const amount = records.reduce((s, r) => s + r.billableUnits * 500, 0)
    const gstAmount = amount * 0.18
    lines.push({
      description: 'Attendance-based labour',
      billableUnits: records.reduce((s, r) => s + r.billableUnits, 0),
      ratePerUnit: 500,
      amount,
      gstAmount,
    })
    subtotal = amount
    gstTotal = gstAmount
  }

  const invoice = await Invoice.create({
    invoiceNumber: generateInvoiceNumber(),
    corporateId: request.sourceType === 'corporate' ? request.clientId : undefined,
    requestId: request._id,
    projectId: request.projectId,
    type: 'attendance',
    billingMode: request.billingMode,
    status: INVOICE_STATUS.ISSUED,
    lines,
    subtotal,
    gstTotal,
    total: subtotal + gstTotal,
    issuedAt: new Date(),
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  })

  await WorkforceRequest.findByIdAndUpdate(requestId, { status: REQUEST_STATUS.BILLING })
  sendSuccess(res, { invoice }, HTTP_STATUS.CREATED)
})

export const patchInvoiceStatusAdmin = asyncHandler(async (req, res) => {
  const { status } = req.body
  const invoice = await Invoice.findById(req.params.id)
  if (!invoice) return sendError(res, { message: 'Not found', statusCode: HTTP_STATUS.NOT_FOUND })
  if (status) invoice.status = status
  if (status === INVOICE_STATUS.PAID) invoice.paidAt = new Date()
  await invoice.save()
  sendSuccess(res, { invoice })
})

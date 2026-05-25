import mongoose from 'mongoose'
import { INVOICE_STATUS, BILLING_MODE } from '../constants/workforceConstants.js'

const invoiceLineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory' },
    billableUnits: { type: Number, default: 0 },
    ratePerUnit: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
  },
  { _id: true },
)

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true, index: true },
    corporateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkforceRequest' },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    type: { type: String, enum: ['attendance', 'milestone', 'advance'], default: 'attendance' },
    billingMode: { type: String, enum: Object.values(BILLING_MODE) },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.DRAFT,
    },
    lines: [invoiceLineSchema],
    subtotal: { type: Number, default: 0 },
    gstTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    dueDate: Date,
    paidAt: Date,
    gstNumber: String,
    pdfUrl: String,
    issuedAt: Date,
  },
  { timestamps: true },
)

export const Invoice = mongoose.model('Invoice', invoiceSchema)

export function generateInvoiceNumber() {
  return `INV-${Date.now().toString(36).toUpperCase()}`
}

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { WorkforceRequest } from './src/models/WorkforceRequest.js';
import { Invoice, generateInvoiceNumber } from './src/models/Invoice.js';

dotenv.config();

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const paidRequests = await WorkforceRequest.find({ paymentStatus: 'PAID' });
  let createdCount = 0;
  
  for (const request of paidRequests) {
    const existing = await Invoice.findOne({ requestId: request._id, corporateId: request.clientId });
    if (!existing) {
      const baseAmount = request.totalAmount - (request.platformFee || 0) - (request.taxAmount || 0);
      await Invoice.create({
        invoiceNumber: generateInvoiceNumber(),
        corporateId: request.clientId,
        requestId: request._id,
        projectId: request.projectId,
        type: 'advance',
        status: 'paid',
        paidAt: request.updatedAt,
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
      createdCount++;
    }
  }
  
  console.log(`Created ${createdCount} missing corporate invoices`);
  process.exit(0);
}

fix();

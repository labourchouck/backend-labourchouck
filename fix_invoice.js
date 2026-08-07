import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Invoice } from './src/models/Invoice.js';
import { WorkforceRequest } from './src/models/WorkforceRequest.js';

dotenv.config();

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const req = await WorkforceRequest.findById('6a75a3b2ce55bcbcabeeca30');
  const inv = await Invoice.findOne({ requestId: req._id });

  if (req && inv) {
    const actualPaid = 1656;
    const baseAmount = 1340; // 670 * 2
    const actualPlatformFee = actualPaid - baseAmount; // 316

    req.totalAmount = actualPaid;
    req.platformFee = actualPlatformFee;
    await req.save();

    inv.total = actualPaid;
    inv.subtotal = baseAmount;
    await inv.save();
    
    console.log('Fixed invoice & request to 1656');
  }
  process.exit(0);
}
fix();

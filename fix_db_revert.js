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
    req.totalAmount = 1540;
    req.platformFee = 200;
    await req.save();

    inv.total = 1540;
    inv.subtotal = 1340;
    await inv.save();
    
    console.log('Reverted to 1540');
  }
  process.exit(0);
}
fix();

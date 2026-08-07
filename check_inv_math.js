import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Invoice } from './src/models/Invoice.js';
import { WorkforceRequest } from './src/models/WorkforceRequest.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const inv = await Invoice.findById('6a75a43cce55bcbcabeecc8d').populate('requestId');
  console.log('Invoice:', JSON.stringify(inv, null, 2));
  console.log('Request:', JSON.stringify(inv.requestId, null, 2));
  process.exit(0);
}
check();

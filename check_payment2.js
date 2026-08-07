import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { WorkforceRequest } from './src/models/WorkforceRequest.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const req = await WorkforceRequest.findById('6a75a3b2ce55bcbcabeeca30');
  console.log('totalAmount:', req.totalAmount, 'pricingSummary:', JSON.stringify(req.pricingSummary));
  process.exit(0);
}
check();

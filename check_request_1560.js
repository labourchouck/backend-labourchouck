import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { WorkforceRequest } from './src/models/WorkforceRequest.js';
import { Invoice } from './src/models/Invoice.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const inv = await Invoice.findById('6a75900e834e18bda986b409');
  console.log('Invoice:', JSON.stringify(inv, null, 2));
  
  const req = await WorkforceRequest.findById(inv.requestId);
  console.log('Request:', JSON.stringify(req, null, 2));
  
  process.exit(0);
}

check();

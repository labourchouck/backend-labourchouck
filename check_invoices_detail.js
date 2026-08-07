import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Invoice } from './src/models/Invoice.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const invoices = await Invoice.find();
  for (const inv of invoices) {
    console.log(`Invoice ${inv._id}: reqId=${inv.requestId}, corpId=${inv.corporateId}`);
  }
  process.exit(0);
}

check();

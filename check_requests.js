import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { WorkforceRequest } from './src/models/WorkforceRequest.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const requests = await WorkforceRequest.find();
  for (const r of requests) {
    console.log(`Request ${r._id}: status=${r.status}, paymentStatus=${r.paymentStatus}`);
  }
  process.exit(0);
}

check();

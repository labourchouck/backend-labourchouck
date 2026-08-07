import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { WorkforceRequest } from './src/models/WorkforceRequest.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const req = await WorkforceRequest.findById('6a758d96a3d9279b838e6e20');
  console.log('Request 1:', req);
  process.exit(0);
}
check();

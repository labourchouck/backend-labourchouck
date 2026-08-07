import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Assignment } from './src/models/Assignment.js';
import { WorkforceRequest } from './src/models/WorkforceRequest.js';

dotenv.config();

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const requests = await WorkforceRequest.find({ status: 'completed' });
  const requestIds = requests.map(r => r._id);
  
  const result = await Assignment.updateMany(
    { requestId: { $in: requestIds }, status: { $ne: 'COMPLETED' } },
    { $set: { status: 'COMPLETED' } }
  );
  
  console.log(`Updated ${result.modifiedCount} stale assignments`);
  process.exit(0);
}

fix();

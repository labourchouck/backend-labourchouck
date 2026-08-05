import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { WorkforceRequest } from './src/models/WorkforceRequest.js';
import { Assignment } from './src/models/Assignment.js';
import { User } from './src/models/User.js';

dotenv.config();
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const requests = await WorkforceRequest.find()
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('preferredVendorId', 'fullName phone contractorProfile')
    .lean();
    
  const requestIds = requests.map(r => r._id);
  const assignments = await Assignment.find({ requestId: { $in: requestIds } })
    .populate('labourId', 'fullName phone category services')
    .populate('vendorId', 'fullName phone contractorProfile')
    .lean();
    
  for (const req of requests) {
    req.assignments = assignments.filter(a => String(a.requestId) === String(req._id));
  }
  
  console.log(JSON.stringify(requests, null, 2));
  process.exit(0);
}
run();

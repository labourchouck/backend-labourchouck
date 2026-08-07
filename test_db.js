import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const { WorkforceRequest } = await import('./src/models/WorkforceRequest.js');
  const requests = await WorkforceRequest.find({}).lean();
  const statuses = requests.map(r => r.status);
  console.log("All statuses in DB:", [...new Set(statuses)]);
  process.exit(0);
});

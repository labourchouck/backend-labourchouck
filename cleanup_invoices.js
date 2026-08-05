import 'dotenv/config.js';
import mongoose from 'mongoose';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const WorkforceRequest = mongoose.model('WorkforceRequest', new mongoose.Schema({ reference: String }, { strict: false }));
  const Invoice = mongoose.model('Invoice', new mongoose.Schema({ requestId: mongoose.Schema.Types.ObjectId, type: String }, { strict: false }));
  
  const req = await WorkforceRequest.findOne({ reference: 'CR-MSFN0QOG' }).lean();
  if (!req) {
    console.log('Request not found');
    process.exit(0);
  }

  // Delete all attendance invoices that are NOT for this specific request
  const deleted = await Invoice.deleteMany({ type: 'attendance', requestId: { $ne: req._id } });
  console.log('Deleted extra test invoices:', deleted.deletedCount);
  
  process.exit(0);
}).catch(console.error);

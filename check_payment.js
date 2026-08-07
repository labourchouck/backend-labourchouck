import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { PaymentTransaction } from './src/models/PaymentTransaction.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const tx = await PaymentTransaction.find({ 
    $or: [
      { requestId: '6a75a3b2ce55bcbcabeeca30' },
      { 'metadata.requestId': '6a75a3b2ce55bcbcabeeca30' }
    ]
  });
  console.log('Payments:', tx);
  process.exit(0);
}
check();

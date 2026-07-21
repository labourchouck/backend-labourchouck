import 'dotenv/config';
import { connectDb } from './src/config/db.js';
import { Booking } from './src/models/Booking.js';

async function run() {
  await connectDb();
  
  const now = new Date();
  const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
  const bRes = await Booking.updateMany(
    { status: 'BROADCASTING', createdAt: { $lt: tenMinsAgo } },
    { $set: { status: 'FAILED' } }
  );
  console.log('Cleaned up BROADCASTING by createdAt:', bRes.modifiedCount);
  
  process.exit();
}
run().catch(console.error);

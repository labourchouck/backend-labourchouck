import 'dotenv/config';
import { connectDb } from './src/config/db.js';
import { Booking } from './src/models/Booking.js';

async function run() {
  await connectDb();
  
  const now = new Date();
  const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
  const bRes = await Booking.updateMany(
    { status: 'BROADCASTING', updatedAt: { $lt: tenMinsAgo } },
    { $set: { status: 'FAILED' } }
  );
  console.log('Cleaned up BROADCASTING:', bRes.modifiedCount);
  
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const eRes = await Booking.updateMany(
    { status: 'EN_ROUTE', updatedAt: { $lt: oneDayAgo } },
    { $set: { status: 'CANCELLED' } }
  );
  console.log('Cleaned up EN_ROUTE:', eRes.modifiedCount);
  
  process.exit();
}
run().catch(console.error);

import 'dotenv/config';
import { connectDb } from './src/config/db.js';
import { Booking } from './src/models/Booking.js';
import { User } from './src/models/User.js';

async function run() {
  await connectDb();
  const user = await User.findOne({ fullName: /Aryan Pathak/i }).lean();
  const bookings = await Booking.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  console.log('Bookings for Aryan:', bookings.length);
  bookings.forEach(b => {
    console.log(b._id, b.status, b.type, b.scheduledAt, b.createdAt);
  });
  process.exit();
}
run().catch(console.error);

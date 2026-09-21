import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected");
  const usersCount = await mongoose.connection.collection('users').countDocuments();
  console.log("Users:", usersCount);
  const bookingsCount = await mongoose.connection.collection('bookings').countDocuments();
  console.log("Bookings:", bookingsCount);
  process.exit(0);
}
run();

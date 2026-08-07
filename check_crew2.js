import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { VendorCrewLabour } from './src/models/VendorCrewLabour.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const crews = await VendorCrewLabour.find({ _id: { $in: ['6a6d980f7b160e5fcd5bff29', '6a6d98837b160e5fcd5bff76'] } });
  crews.forEach(c => console.log(c._id, c.fullName, c.dailyRate, c.adminPrice));
  process.exit(0);
}
check();

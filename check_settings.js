import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { SystemSetting } from './src/models/SystemSetting.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const settings = await SystemSetting.findOne();
  console.log('Settings:', settings);
  process.exit(0);
}
check();

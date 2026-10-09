import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DEFAULT_SUPPORT_TEXT } from './src/data/defaultLegalDocs.js';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mappto');
  const db = mongoose.connection.db;
  await db.collection('supportpolicies').updateMany({}, { $set: { content: DEFAULT_SUPPORT_TEXT } });
  console.log('Successfully updated all Support Policy records in the database to the long version.');
  process.exit(0);
}
run().catch(console.error);

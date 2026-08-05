import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const statuses = await db.collection('projects').distinct('status');
  const deletedFields = await db.collection('projects').find({ isDeleted: true }).toArray();
  console.log("Distinct statuses:", statuses);
  console.log("Projects with isDeleted true:", deletedFields.length);
  process.exit(0);
});

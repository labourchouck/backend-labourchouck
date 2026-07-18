import 'dotenv/config';
import mongoose from 'mongoose';
import { BuildMartCategory } from '../models/BuildMartCategory.js';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const categories = await BuildMartCategory.find({});
  let updatedCount = 0;

  for (const cat of categories) {
    if (cat.image && cat.image.startsWith('http')) {
      // Set the icon field to the image URL so it renders as an image instead of an icon
      cat.icon = cat.image;
      await cat.save();
      updatedCount++;
      console.log(`Updated category: ${cat.name}`);
    }
  }

  console.log(`Updated ${updatedCount} BuildMart categories to use image URLs for icons.`);
  await mongoose.disconnect();
}

run().catch(console.error);

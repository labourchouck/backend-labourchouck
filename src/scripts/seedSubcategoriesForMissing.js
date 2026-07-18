import 'dotenv/config';
import mongoose from 'mongoose';
import { LabourCategory } from '../models/LabourCategory.js';
import { LabourSubcategory } from '../models/LabourSubcategory.js';
import { LabourService } from '../models/LabourService.js';
import { slugify } from '../utils/slugify.js';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Find all LabourCategories
  const categories = await LabourCategory.find({});
  let addedCount = 0;

  for (const cat of categories) {
    // Check if subcategory exists
    const existingSubcats = await LabourSubcategory.find({ categoryId: cat._id });
    
    if (existingSubcats.length === 0) {
      // Create a default subcategory so it shows up in the UI
      const subcat = await LabourSubcategory.findOneAndUpdate(
        { categoryId: cat._id, name: cat.name },
        {
          $set: {
            categoryId: cat._id,
            name: cat.name,
            description: cat.subtitle || `General ${cat.name} services`,
            isActive: true,
            iconUrl: cat.imageUrl || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=70',
          }
        },
        { upsert: true, new: true }
      );

      // Create a default service
      await LabourService.findOneAndUpdate(
        { subcategoryId: subcat._id, name: 'Standard Service' },
        {
          $set: {
            subcategoryId: subcat._id,
            name: 'Standard Service',
            description: 'Basic standard service',
            basePrice: 500,
            estimatedDurationMins: 60,
            isActive: true,
            iconUrl: subcat.iconUrl,
          }
        },
        { upsert: true, new: true }
      );
      
      addedCount++;
    }
  }

  console.log(`Added default subcategory and service to ${addedCount} categories.`);
  await mongoose.disconnect();
  console.log('Done');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

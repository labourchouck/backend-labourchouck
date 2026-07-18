import 'dotenv/config';
import mongoose from 'mongoose';
import { BuildMartProduct } from '../models/BuildMartProduct.js';

const categoryImageMap = {
  'cement': 'https://images.unsplash.com/photo-1581094797760-3c2f8f4e3b0a?auto=format&fit=crop&w=400&q=70',
  'steel': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=70',
  'bricks': 'https://images.unsplash.com/photo-1585145898858-54c30c8edaf5?auto=format&fit=crop&w=400&q=70',
  'sand': 'https://images.unsplash.com/photo-1563814450508-4361bf6a81b9?auto=format&fit=crop&w=400&q=70',
  'plumbing': 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=400&q=70',
  'electrical': 'https://images.unsplash.com/photo-1555964669-e08711827471?auto=format&fit=crop&w=400&q=70',
  'paint': 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=400&q=70',
  'tiles': 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=400&q=70',
  'hardware': 'https://images.unsplash.com/photo-1542385151-efd9000785a0?auto=format&fit=crop&w=400&q=70',
  'waterproofing': 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&w=400&q=70',
  'safety': 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=400&q=70',
};

// Fallback image
const fallbackImage = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=70';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const products = await BuildMartProduct.find({});
  let updatedCount = 0;

  for (const product of products) {
    if (!product.images || product.images.length === 0) {
      const img = categoryImageMap[product.categoryId] || fallbackImage;
      product.images = [img];
      await product.save();
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} BuildMart products to include images.`);
  await mongoose.disconnect();
}

run().catch(console.error);

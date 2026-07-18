import 'dotenv/config';
import mongoose from 'mongoose';
import { BuildMartProduct } from '../models/BuildMartProduct.js';

const categoryFlickrKeywords = {
  'cement': 'cement,concrete',
  'steel': 'steel,metal,rebar',
  'bricks': 'brick,wall',
  'sand': 'sand,gravel',
  'plumbing': 'pipes,plumbing',
  'electrical': 'wires,electrical',
  'paint': 'paint,colors',
  'tiles': 'tiles,floor',
  'hardware': 'tools,hardware',
  'waterproofing': 'waterproofing,roof',
  'safety': 'hardhat,safety',
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const products = await BuildMartProduct.find({});
  let updatedCount = 0;

  for (const product of products) {
    // Generate a reliable image URL from loremflickr or picsum based on the category and ID so it stays consistent
    const keyword = categoryFlickrKeywords[product.categoryId] || 'construction';
    // Use the product's _id as a seed so the image doesn't change on every reload
    const imgUrl = `https://loremflickr.com/400/400/${keyword}?lock=${product._id.toString().substring(18)}`;
    
    product.images = [imgUrl];
    await product.save();
    updatedCount++;
  }

  console.log(`Successfully replaced images for ${updatedCount} BuildMart products.`);
  await mongoose.disconnect();
}

run().catch(console.error);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Since we are running in the backend, we mock lucide-react to avoid import errors when requiring the frontend catalog.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function () {
  if (arguments[0] === 'lucide-react') {
    return new Proxy({}, { get: () => 'IconMock' });
  }
  return originalRequire.apply(this, arguments);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { connectDb } from '../config/db.js';
import { BuildMartProduct } from '../models/BuildMartProduct.js';

// We can read the frontend file and dynamically import it, but dynamic import bypasses require cache/hacks for ES modules sometimes.
// Let's just read the file and extract the JSON.
const frontendDataPath = path.resolve(__dirname, '../../../frontend/src/data/buildmartCatalog.js');
let fileContent = fs.readFileSync(frontendDataPath, 'utf8');

// Strip out the lucide-react import and BUILDMART_CATEGORIES to safely eval the products array
fileContent = fileContent.replace(/import\s+{[\s\S]*?}\s+from\s+'lucide-react'/g, '');
fileContent = fileContent.replace(/export\s+const\s+BUILDMART_BANNERS\s+=\s+\[[\s\S]*?\]/g, '');
fileContent = fileContent.replace(/export\s+const\s+BUILDMART_CATEGORIES\s+=\s+\[[\s\S]*?\]/g, '');
fileContent = fileContent.replace(/export\s+const\s+BUILDMART_PRODUCTS\s+=/g, 'const BUILDMART_PRODUCTS =');
fileContent = fileContent.replace(/export\s+function\s+getBuildMartProductsByCategory[\s\S]*$/g, '');
fileContent = fileContent.replace(/export\s+function\s+getBuildMartProduct[\s\S]*$/g, '');
fileContent = fileContent.replace(/export\s+function[\s\S]*$/g, '');

fileContent += '\n\nmodule.exports = BUILDMART_PRODUCTS;';

// Write to temp file and require
const tempPath = path.resolve(__dirname, 'tempCatalog.cjs');
fs.writeFileSync(tempPath, fileContent);

const BUILDMART_PRODUCTS = require('./tempCatalog.cjs');

const seedData = async () => {
  try {
    await connectDb();
    console.log('Connected to MongoDB.');

    await BuildMartProduct.deleteMany({});
    console.log('Cleared existing BuildMart products.');

    await BuildMartProduct.insertMany(BUILDMART_PRODUCTS);
    console.log(`Successfully seeded ${BUILDMART_PRODUCTS.length} products.`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
};

seedData();

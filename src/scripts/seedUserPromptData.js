import 'dotenv/config'
import mongoose from 'mongoose'
import { LabourCategoryGroup } from '../models/LabourCategoryGroup.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { BuildMartCategory } from '../models/BuildMartCategory.js'
import { BuildMartProduct } from '../models/BuildMartProduct.js'
import { slugify } from '../utils/slugify.js'

const NEW_LABOUR_GROUPS = [
  {
    group: {
      name: 'Engineering & Technical Professionals',
      slug: 'engineering-technical-professionals',
      description: 'Engineers and technical experts for construction and planning.',
      helperText: 'Select your core technical discipline.',
      kind: 'profile',
      sortOrder: 100,
      imageUrl: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80',
    },
    items: [
      { name: 'Civil Engineer', subtitle: 'Site & structural planning', sortOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80' },
      { name: 'Structural Engineer', subtitle: 'Structural stability expert', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80' },
      { name: 'Mechanical Engineer', subtitle: 'HVAC & machinery planning', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80' },
      { name: 'Electrical Engineer', subtitle: 'Power & circuit design', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583eb92d232?auto=format&fit=crop&w=800&q=80' },
      { name: 'Geotechnical Engineer', subtitle: 'Soil & foundation expert', sortOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80' },
      { name: 'Surveyor / Land Surveyor', subtitle: 'Site mapping & boundaries', sortOrder: 5, imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80' },
      { name: 'Quality Control (QC) Engineer', subtitle: 'Material & build QA', sortOrder: 6, imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80' },
      { name: 'Quantity Surveyor (QS)', subtitle: 'Cost & material estimation', sortOrder: 7, imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80' },
    ]
  },
  {
    group: {
      name: 'Architecture & Design',
      slug: 'architecture-design',
      description: 'Creative and spatial design professionals.',
      helperText: 'Select your design specialization.',
      kind: 'profile',
      sortOrder: 110,
      imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
    },
    items: [
      { name: 'Architect', subtitle: 'Building & space design', sortOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80' },
      { name: 'Interior Designer', subtitle: 'Indoor spatial planning', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1618221195710-e326b4f6d3e0?auto=format&fit=crop&w=800&q=80' },
      { name: 'Landscape Architect', subtitle: 'Outdoor & garden design', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80' },
      { name: 'Urban Planner', subtitle: 'City & community layout', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=800&q=80' },
      { name: 'Draftsman / CAD Technician', subtitle: 'Blueprint & 3D modeling', sortOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80' },
    ]
  },
  {
    group: {
      name: 'Construction Management',
      slug: 'construction-management',
      description: 'Site operations and project leadership.',
      helperText: 'Select your management role.',
      kind: 'profile',
      sortOrder: 120,
      imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80',
    },
    items: [
      { name: 'Project Manager', subtitle: 'Overall project leadership', sortOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80' },
      { name: 'Construction Manager', subtitle: 'Site execution head', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1508873699372-7aeab60b44ab?auto=format&fit=crop&w=800&q=80' },
      { name: 'Site Supervisor / Foreman', subtitle: 'Daily crew management', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1581094797760-3c2f8f4e3b0a?auto=format&fit=crop&w=800&q=80' },
      { name: 'Safety Officer / HSE Manager', subtitle: 'Site safety & compliance', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80' },
      { name: 'Estimator', subtitle: 'Cost & budget analysis', sortOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80' },
    ]
  },
  {
    group: {
      name: 'Specialized Building Experts',
      slug: 'specialized-building-experts',
      description: 'Consultants for specialized construction niches.',
      helperText: 'Select your consulting niche.',
      kind: 'profile',
      sortOrder: 130,
      imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
    },
    items: [
      { name: 'Waterproofing Consultant', subtitle: 'Moisture & leak solutions', sortOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80' },
      { name: 'Tile Consultant', subtitle: 'Flooring & tile expertise', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1502005097973-6a7082348e28?auto=format&fit=crop&w=800&q=80' },
      { name: 'Acoustic Consultant', subtitle: 'Soundproofing & audio design', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1516280440502-850972b22031?auto=format&fit=crop&w=800&q=80' },
      { name: 'Green Building Consultant', subtitle: 'LEED & sustainable design', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=800&q=80' },
      { name: 'Fire Safety Consultant', subtitle: 'Fire prevention & systems', sortOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1582131503261-f2f2be3eb03a?auto=format&fit=crop&w=800&q=80' },
    ]
  },
  {
    group: {
      name: 'MEP & Utility Experts',
      slug: 'mep-utility-experts',
      description: 'Mechanical, electrical, and plumbing contractors.',
      helperText: 'Select your utility contracting specialty.',
      kind: 'profile',
      sortOrder: 140,
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6f269e?auto=format&fit=crop&w=800&q=80',
    },
    items: [
      { name: 'Electrical Contractor', subtitle: 'Wiring & power systems', sortOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6f269e?auto=format&fit=crop&w=800&q=80' },
      { name: 'Plumbing Contractor', subtitle: 'Pipes & water supply', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80' },
      { name: 'HVAC Contractor', subtitle: 'Heating & cooling systems', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80' },
      { name: 'Solar Installation Contractor', subtitle: 'Solar panel deployment', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1509391366360-1f9509e088bf?auto=format&fit=crop&w=800&q=80' },
      { name: 'Elevator/Escalator Contractor', subtitle: 'Vertical transport systems', sortOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1517607994966-24e5d32155de?auto=format&fit=crop&w=800&q=80' },
    ]
  }
];

const NEW_BUILDMART_CATEGORIES = [
  { id: 'cement', name: 'Cement & Concrete', icon: 'Container', image: 'https://images.unsplash.com/photo-1581094797760-3c2f8f4e3b0a?auto=format&fit=crop&w=800&q=80', color: 'bg-orange-100 text-orange-800' },
  { id: 'sand', name: 'Sand & Aggregates', icon: 'Shovel', image: 'https://images.unsplash.com/photo-1618221195710-e326b4f6d3e0?auto=format&fit=crop&w=800&q=80', color: 'bg-amber-100 text-amber-900' },
  { id: 'steel', name: 'Steel & Metal', icon: 'Layers', image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80', color: 'bg-slate-100 text-slate-800' },
  { id: 'plumbing', name: 'Plumbing', icon: 'Pipette', image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80', color: 'bg-cyan-100 text-cyan-900' },
  { id: 'electrical', name: 'Electrical', icon: 'Zap', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6f269e?auto=format&fit=crop&w=800&q=80', color: 'bg-yellow-100 text-yellow-900' },
  { id: 'paint', name: 'Paint', icon: 'Paintbrush', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80', color: 'bg-sky-100 text-sky-900' },
  { id: 'tiles', name: 'Tiles & Flooring', icon: 'CircleDot', image: 'https://images.unsplash.com/photo-1502005097973-6a7082348e28?auto=format&fit=crop&w=800&q=80', color: 'bg-violet-100 text-violet-900' },
  { id: 'hardware', name: 'Hardware', icon: 'Wrench', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80', color: 'bg-emerald-100 text-emerald-900' },
  { id: 'waterproofing', name: 'Waterproofing', icon: 'Droplets', image: 'https://images.unsplash.com/photo-1584483788775-680f4f9f7d45?auto=format&fit=crop&w=800&q=80', color: 'bg-blue-100 text-blue-900' },
  { id: 'safety', name: 'Safety Equipment', icon: 'Shield', image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80', color: 'bg-red-100 text-red-900' },
];

const NEW_BUILDMART_PRODUCTS = [
  // Cement & Concrete Materials
  { name: 'Cement (OPC)', categoryId: 'cement', priceLabel: '₹350/bag' },
  { name: 'Cement (PPC)', categoryId: 'cement', priceLabel: '₹340/bag' },
  { name: 'White Cement', categoryId: 'cement', priceLabel: '₹800/bag' },
  { name: 'Ready-Mix Concrete (RMC)', categoryId: 'cement', priceLabel: '₹4500/cum' },
  { name: 'Concrete Blocks (Solid/Hollow)', categoryId: 'cement', priceLabel: '₹40/pc' },
  { name: 'AAC Blocks', categoryId: 'cement', priceLabel: '₹3500/cum' },
  { name: 'Fly Ash Bricks', categoryId: 'cement', priceLabel: '₹5/pc' },
  { name: 'Red Clay Bricks', categoryId: 'cement', priceLabel: '₹7/pc' },
  { name: 'Paver Blocks', categoryId: 'cement', priceLabel: '₹30/pc' },

  // Sand & Aggregates
  { name: 'River Sand', categoryId: 'sand', priceLabel: '₹3000/ton' },
  { name: 'M-Sand (Manufactured Sand)', categoryId: 'sand', priceLabel: '₹2500/ton' },
  { name: 'Plaster Sand', categoryId: 'sand', priceLabel: '₹2800/ton' },
  { name: 'Coarse Aggregates (10mm, 20mm, 40mm)', categoryId: 'sand', priceLabel: '₹1500/ton' },
  { name: 'Stone Dust', categoryId: 'sand', priceLabel: '₹1200/ton' },
  { name: 'Gravel', categoryId: 'sand', priceLabel: '₹1400/ton' },

  // Steel & Metal
  { name: 'TMT Bars (Fe-500, Fe-550)', categoryId: 'steel', priceLabel: '₹60/kg' },
  { name: 'Mild Steel (MS) Angles & Channels', categoryId: 'steel', priceLabel: '₹55/kg' },
  { name: 'Binding Wire', categoryId: 'steel', priceLabel: '₹70/kg' },
  { name: 'Structural Steel (I-Beams, H-Beams)', categoryId: 'steel', priceLabel: '₹65/kg' },
  { name: 'Stainless Steel Pipes / Railings', categoryId: 'steel', priceLabel: '₹150/kg' },
  { name: 'Aluminum Sections', categoryId: 'steel', priceLabel: '₹180/kg' },
  { name: 'Roofing Sheets (GI, Color Coated)', categoryId: 'steel', priceLabel: '₹400/sheet' },

  // Plumbing
  { name: 'PVC Pipes & Fittings', categoryId: 'plumbing', priceLabel: '₹200/length' },
  { name: 'CPVC / UPVC Pipes', categoryId: 'plumbing', priceLabel: '₹250/length' },
  { name: 'GI Pipes & Fittings', categoryId: 'plumbing', priceLabel: '₹350/length' },
  { name: 'Water Tanks (Syntax etc.)', categoryId: 'plumbing', priceLabel: '₹3000/unit' },
  { name: 'Sanitaryware', categoryId: 'plumbing', priceLabel: '₹1500/unit' },
  { name: 'Faucets & Taps', categoryId: 'plumbing', priceLabel: '₹500/unit' },
  { name: 'Manhole Covers', categoryId: 'plumbing', priceLabel: '₹800/unit' },

  // Electrical
  { name: 'Wires & Cables (Copper/Aluminium)', categoryId: 'electrical', priceLabel: '₹1500/coil' },
  { name: 'Conduit Pipes (PVC/MS)', categoryId: 'electrical', priceLabel: '₹80/length' },
  { name: 'Switches & Sockets', categoryId: 'electrical', priceLabel: '₹50/pc' },
  { name: 'MCB & Distribution Boards', categoryId: 'electrical', priceLabel: '₹250/pc' },
  { name: 'Lighting (LED Bulbs, Tube Lights)', categoryId: 'electrical', priceLabel: '₹100/pc' },
  { name: 'Fans & Exhausts', categoryId: 'electrical', priceLabel: '₹1200/unit' },

  // Paint
  { name: 'Wall Putty', categoryId: 'paint', priceLabel: '₹400/bag' },
  { name: 'Primer (Interior & Exterior)', categoryId: 'paint', priceLabel: '₹200/L' },
  { name: 'Emulsion Paint', categoryId: 'paint', priceLabel: '₹300/L' },
  { name: 'Enamel Paint', categoryId: 'paint', priceLabel: '₹250/L' },
  { name: 'Distemper', categoryId: 'paint', priceLabel: '₹100/kg' },
  { name: 'Wood Polish & Varnish', categoryId: 'paint', priceLabel: '₹400/L' },

  // Tiles & Flooring
  { name: 'Ceramic Tiles', categoryId: 'tiles', priceLabel: '₹40/sqft' },
  { name: 'Vitrified Tiles', categoryId: 'tiles', priceLabel: '₹60/sqft' },
  { name: 'Granite / Marble Slabs', categoryId: 'tiles', priceLabel: '₹120/sqft' },
  { name: 'Wooden Flooring', categoryId: 'tiles', priceLabel: '₹80/sqft' },
  { name: 'Tile Adhesive & Grout', categoryId: 'tiles', priceLabel: '₹350/bag' },
  { name: 'Skirting Tiles', categoryId: 'tiles', priceLabel: '₹20/pc' },

  // Hardware
  { name: 'Nails & Screws', categoryId: 'hardware', priceLabel: '₹150/kg' },
  { name: 'Hinges, Handles & Locks', categoryId: 'hardware', priceLabel: '₹100/pc' },
  { name: 'Door & Window Frames', categoryId: 'hardware', priceLabel: '₹800/unit' },
  { name: 'Plywood & Blockboards', categoryId: 'hardware', priceLabel: '₹60/sqft' },
  { name: 'Laminates & Veneers', categoryId: 'hardware', priceLabel: '₹800/sheet' },

  // Waterproofing
  { name: 'Liquid Waterproofing Compounds', categoryId: 'waterproofing', priceLabel: '₹400/L' },
  { name: 'Bitumen Sheets', categoryId: 'waterproofing', priceLabel: '₹1500/roll' },
  { name: 'Waterproofing Tapes', categoryId: 'waterproofing', priceLabel: '₹300/roll' },

  // Safety Equipment
  { name: 'Safety Helmets', categoryId: 'safety', priceLabel: '₹150/pc' },
  { name: 'Safety Shoes', categoryId: 'safety', priceLabel: '₹600/pair' },
  { name: 'Reflective Jackets', categoryId: 'safety', priceLabel: '₹200/pc' },
  { name: 'Safety Nets', categoryId: 'safety', priceLabel: '₹1200/net' },
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Seed Labour Categories
  for (const row of NEW_LABOUR_GROUPS) {
    const g = await LabourCategoryGroup.findOneAndUpdate(
      { slug: row.group.slug },
      {
        $set: {
          name: row.group.name,
          slug: row.group.slug,
          description: row.group.description,
          helperText: row.group.helperText,
          kind: row.group.kind,
          sortOrder: row.group.sortOrder,
          imageUrl: row.group.imageUrl || '',
          isActive: true,
        },
      },
      { upsert: true, new: true },
    );

    for (const item of row.items) {
      const base = slugify(item.name);
      const slug = `${row.group.slug}-${base}-${item.sortOrder}`;
      await LabourCategory.findOneAndUpdate(
        { slug },
        {
          $set: {
            group: g._id,
            name: item.name,
            slug,
            subtitle: item.subtitle || '',
            imageUrl: item.imageUrl || '',
            sortOrder: item.sortOrder,
            isActive: true,
          },
        },
        { upsert: true, new: true },
      );
    }
  }
  console.log('Seeded Labour Categories');

  // Seed BuildMart Categories
  for (const cat of NEW_BUILDMART_CATEGORIES) {
    await BuildMartCategory.findOneAndUpdate(
      { id: cat.id },
      {
        $set: {
          name: cat.name,
          icon: cat.icon,
          image: cat.image,
          color: cat.color,
        },
      },
      { upsert: true, new: true },
    );
  }
  console.log('Seeded BuildMart Categories');

  // Seed BuildMart Products
  for (const prod of NEW_BUILDMART_PRODUCTS) {
    const id = slugify(prod.name);
    // Find category to get appropriate image fallback if needed
    const catObj = NEW_BUILDMART_CATEGORIES.find(c => c.id === prod.categoryId);
    
    await BuildMartProduct.findOneAndUpdate(
      { id },
      {
        $set: {
          name: prod.name,
          brand: 'Generic',
          categoryId: prod.categoryId,
          shortDescription: `${prod.name} for construction needs.`,
          description: `High quality ${prod.name} suitable for various construction and building projects. Ensure the best materials for your site.`,
          images: [
            catObj?.image || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80'
          ],
          specs: [
            { label: 'Type', value: prod.name },
          ],
          deliveryInfo: 'Site drop within 24–48 hrs',
          availability: 'in_stock',
          supplier: { name: 'BuildMart Wholesale', rating: 4.5, city: 'Delhi NCR' },
          variantCount: 1,
          priceLabel: prod.priceLabel,
          variants: [
            { 
              id: 'v1', 
              label: 'Standard Unit', 
              size: '1', 
              unit: prod.priceLabel.split('/')[1] || 'unit', 
              retailPrice: parseInt(prod.priceLabel.replace(/\D/g, '')) || 100, 
              contractorPrice: (parseInt(prod.priceLabel.replace(/\D/g, '')) || 100) * 0.95, 
              moq: 1 
            }
          ]
        },
      },
      { upsert: true, new: true }
    );
  }
  console.log('Seeded BuildMart Products');

  await mongoose.disconnect();
  console.log('Done');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Applies the Mappto 3D icon set to labour services/sub-categories and BuildMart
 * categories/products (matched by exact name).
 *
 * - Each icon file is uploaded to Cloudinary once per run and reused.
 * - Idempotent: a record whose image already points at the same icon slug is skipped.
 * - BuildMart products: only placeholder stock photos (loremflickr) are replaced,
 *   unless the product is listed in FORCE_PRODUCTS; real product photos are kept.
 * - Products left with only placeholder photos get their BuildMart category icon.
 * - Every replaced URL is appended to assets/catalog-icons/previous-urls.json so it
 *   can be restored.
 *
 * Usage: npm run seed:icons
 */
import '../config/env.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { connectDb } from '../config/db.js'
import { LabourService } from '../models/LabourService.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { BuildMartCategory } from '../models/BuildMartCategory.js'
import { BuildMartProduct } from '../models/BuildMartProduct.js'
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ICON_DIR = path.join(__dirname, 'assets', 'catalog-icons')
const BACKUP_FILE = path.join(ICON_DIR, 'previous-urls.json')
const SLUG_PREFIX = 'mappto-icon-'

/** Labour service name → icon file (without .webp). */
const SERVICES = {
  Electrician: 'electrician',
  Plumber: 'plumber',
  Carpenter: 'carpenter',
  Painter: 'painter',
  'Mason (Raj Mistri)': 'mason',
  Welder: 'welder',
  'Loader / Unloader': 'loader',
  'Construction Helper': 'construction-helper',
  'Interior Designer Helper': 'interior-designer',
  'AC Technician': 'ac-technician',
  'Pest Control Worker': 'pest-control',
  'Housekeeping Staff': 'housekeeping',
  'Office Cleaner': 'office-cleaner',
  'CCTV Installer': 'cctv-installer',
  'Washing Machine Technician': 'washing-machine-tech',
  'Solar Panel Technician': 'solar-technician',
  'Gardener / Mali': 'gardener',
  'Refrigerator Technician': 'fridge-washer',
  'Home Appliance Repair Technician': 'home-appliances',
  'Modular Kitchen Installer': 'modular-kitchen',
  'Drill Machine Operator': 'power-tools',
}

/** Labour sub-category name → icon file. */
const SUBCATEGORIES = {
  'Pest Control': 'sanitization',
  'Site Operations': 'site-supervisor',
  'Security & Automation': 'smart-lock',
  'HVAC & Cooling': 'ac-outdoor-unit',
  'Equipment Support': 'angle-grinder-drill',
}

/** BuildMart category name → icon file. */
const MART_CATEGORIES = {
  Cement: 'cement',
  Tiling: 'tiles-slabs',
  Painting: 'paint',
  Waterproofing: 'waterproofing',
  Electrical: 'wires-mcb',
  Hardware: 'hinges-handles',
  Plumbing: 'pvc-pipes',
  Furniture: 'wardrobe',
  'Sand & Aggregates': 'sand-aggregates',
}

/** BuildMart product name → icon file. */
const MART_PRODUCTS = {
  'PVC Pipes & Fittings': 'pvc-pipes',
  'CPVC / UPVC Pipes': 'cpvc-fittings',
  'Water Tanks (Syntax etc.)': 'water-tanks',
  Sanitaryware: 'sanitaryware',
  'Faucets & Taps': 'basin-faucet',
  'Wires & Cables (Copper/Aluminium)': 'wires-mcb',
  'Switches & Sockets': 'switches-sockets',
  'MCB & Distribution Boards': 'distribution-board',
  'Lighting (LED Bulbs, Tube Lights)': 'lighting',
  'Fans & Exhausts': 'ceiling-fan',
  'Wall Putty': 'wall-putty',
  'Emulsion Paint': 'paint',
  'Ceramic Tiles': 'ceramic-tiles',
  'Vitrified Tiles': 'tiles-slabs',
  'Plywood & Blockboards': 'plywood',
  'Hinges, Handles & Locks': 'hinges-handles',
  'Door & Window Frames': 'door-window-frames',
  'Liquid Waterproofing Compounds': 'waterproofing',
  'Bitumen Sheets': 'bitumen-sheets',
  'Red Clay Bricks': 'red-bricks',
  'Concrete Blocks (Solid/Hollow)': 'concrete-blocks',
  // Variants that share the closest matching icon.
  'Primer (Interior & Exterior)': 'paint',
  'Enamel Paint': 'paint',
  'Wood Polish & Varnish': 'paint',
  Distemper: 'wall-putty',
  'Granite / Marble Slabs': 'tiles-slabs',
  'Skirting Tiles': 'ceramic-tiles',
  'Tile Adhesive & Grout': 'cement',
  'Wooden Flooring': 'plywood',
  'Laminates & Veneers': 'plywood',
  'GI Pipes & Fittings': 'pvc-pipes',
  'Conduit Pipes (PVC/MS)': 'pvc-pipes',
  'Waterproofing Tapes': 'bitumen-sheets',
  // Cut-outs from the Safety / Steel / Hardware category art so each product looks distinct.
  'Reflective Jackets': 'reflective-jacket',
  'Safety Helmets': 'safety-helmet',
  'Safety Shoes': 'safety-shoes',
  'TMT Bars (Fe-500, Fe-550)': 'tmt-bars',
  'Mild Steel (MS) Angles & Channels': 'ms-angles-channels',
  'Stainless Steel Pipes / Railings': 'steel-square-pipes',
  'Aluminum Sections': 'aluminium-sections',
  'Nails & Screws': 'nails-screws',
}
/** Products whose current (non-placeholder) photo should still be replaced. */
const FORCE_PRODUCTS = new Set([
  'Red Clay Bricks',
  'Concrete Blocks (Solid/Hollow)',
  'Reflective Jackets',
  'Safety Helmets',
  'Safety Shoes',
  'TMT Bars (Fe-500, Fe-550)',
  'Mild Steel (MS) Angles & Channels',
  'Stainless Steel Pipes / Railings',
  'Aluminum Sections',
  'Nails & Screws',
])

const isPlaceholder = (url) => /loremflickr\.com|picsum\.photos|placehold/i.test(String(url || ''))
const hasIcon = (url, icon) => String(url || '').includes(`${SLUG_PREFIX}${icon}`)

const uploaded = new Map()
async function iconUrl(icon) {
  if (uploaded.has(icon)) return uploaded.get(icon)
  const file = `${SLUG_PREFIX}${icon}.webp`
  const asset = await uploadBufferToCloudinary({
    buffer: fs.readFileSync(path.join(ICON_DIR, `${icon}.webp`)),
    mimetype: 'image/webp',
    folder: 'catalog-icons',
    userId: 'seed',
    originalName: file,
    resourceType: 'image',
  })
  uploaded.set(icon, asset.url)
  return asset.url
}

const backup = []
const stats = { updated: 0, skipped: 0, missing: [] }

/** Generic updater for a single-URL field. */
async function applyField(Model, label, mapping, field) {
  for (const [name, icon] of Object.entries(mapping)) {
    const docs = await Model.find({ name })
    if (!docs.length) {
      stats.missing.push(`${label}: ${name}`)
      continue
    }
    for (const doc of docs) {
      if (hasIcon(doc[field], icon)) {
        stats.skipped += 1
        continue
      }
      backup.push({ model: label, id: String(doc._id), name, field, previous: doc[field] || '' })
      doc[field] = await iconUrl(icon)
      await doc.save()
      stats.updated += 1
      console.log(`[seed:icons] ${label} · ${name} → ${icon}`)
    }
  }
}

async function applyProducts() {
  // A category icon used as a stand-in photo is not a real product photo; drop it on replace.
  const categoryIcons = new Set(
    (await BuildMartCategory.find({}).select('icon').lean()).map((c) => c.icon).filter(Boolean),
  )
  for (const [name, icon] of Object.entries(MART_PRODUCTS)) {
    const docs = await BuildMartProduct.find({ name })
    if (!docs.length) {
      stats.missing.push(`product: ${name}`)
      continue
    }
    for (const doc of docs) {
      const images = doc.images || []
      if (hasIcon(images[0], icon)) {
        stats.skipped += 1
        continue
      }
      const realPhotos = images.filter((u) => u && !isPlaceholder(u) && !categoryIcons.has(u))
      if (realPhotos.length && !FORCE_PRODUCTS.has(name)) {
        stats.skipped += 1
        console.log(`[seed:icons] product · ${name} kept (has a real photo)`)
        continue
      }
      backup.push({ model: 'product', id: String(doc._id), name, field: 'images', previous: images })
      doc.images = [await iconUrl(icon), ...realPhotos]
      await doc.save()
      stats.updated += 1
      console.log(`[seed:icons] product · ${name} → ${icon}`)
    }
  }
}

/**
 * Any product still left with only placeholder photos (no matching icon in the set)
 * falls back to its BuildMart category's own icon, so nothing renders broken.
 */
async function applyCategoryFallback() {
  const categories = await BuildMartCategory.find({ icon: { $nin: [null, ''] } }).lean()
  const iconById = new Map(categories.map((c) => [c.id, c.icon]))

  const products = await BuildMartProduct.find({})
  for (const doc of products) {
    const images = doc.images || []
    if (images.some((u) => u && !isPlaceholder(u))) continue
    const icon = iconById.get(doc.categoryId)
    if (!icon) {
      stats.missing.push(`category icon for product: ${doc.name} (${doc.categoryId})`)
      continue
    }
    backup.push({ model: 'product', id: String(doc._id), name: doc.name, field: 'images', previous: images })
    doc.images = [icon]
    await doc.save()
    stats.updated += 1
    console.log(`[seed:icons] product · ${doc.name} → category icon (${doc.categoryId})`)
  }
}

async function run() {
  await connectDb()

  await applyField(LabourService, 'service', SERVICES, 'iconUrl')
  await applyField(LabourSubcategory, 'subcategory', SUBCATEGORIES, 'iconUrl')
  await applyField(BuildMartCategory, 'mart-category', MART_CATEGORIES, 'image')
  await applyProducts()
  await applyCategoryFallback()

  if (backup.length) {
    const prev = fs.existsSync(BACKUP_FILE) ? JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8')) : []
    prev.push({ at: new Date().toISOString(), changes: backup })
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(prev, null, 2))
  }

  console.log(`[seed:icons] done · updated ${stats.updated}, skipped ${stats.skipped}, uploads ${uploaded.size}`)
  if (stats.missing.length) console.log(`[seed:icons] not found: ${stats.missing.join('; ')}`)
}

run()
  .catch((err) => {
    console.error('[seed:icons] failed:', err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())

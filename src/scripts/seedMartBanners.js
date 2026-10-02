/**
 * Seeds built-in BuildMart (Mart) banners.
 *
 * - Uploads each image to Cloudinary and upserts a BuildMartBanner by its `id`.
 * - Idempotent: an existing banner is left untouched, so admin edits survive re-runs.
 * - Banners that never had an order are given 10, 20, 30… (keeping their creation
 *   order) so the seeded ones show first.
 *
 * Usage: npm run seed:mart-banners
 */
import '../config/env.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { connectDb } from '../config/db.js'
import { BuildMartBanner } from '../models/BuildMartBanner.js'
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSET_DIR = path.join(__dirname, 'assets', 'banners')

const SEED_BANNERS = [
  {
    id: 'site-essentials',
    file: 'mart-site-essentials.webp',
    title: 'Everything for your site',
    subtitle: 'Cement, steel, bricks & tiles — delivered',
    cta: 'Shop now',
    // `all` opens the full product list in the app.
    categoryId: 'all',
    sortOrder: 1,
  },
  {
    id: 'finishing-made-easy',
    file: 'mart-finishing.webp',
    title: 'Finishing Made Easy',
    subtitle: 'Paints, pipes & electricals at best rates',
    cta: 'Shop now',
    categoryId: 'paint',
    sortOrder: 2,
  },
  {
    id: 'floors-that-wow',
    file: 'mart-tiles.webp',
    title: 'Floors That Wow',
    subtitle: 'Premium tiles & flooring, delivered to site',
    cta: 'Shop tiles',
    categoryId: 'tiles',
    sortOrder: 3,
  },
  {
    id: 'gear-up-your-crew',
    file: 'mart-safety.webp',
    title: 'Gear Up Your Crew',
    subtitle: 'Helmets, boots & safety kits for every site',
    cta: 'Shop safety gear',
    categoryId: 'safety',
    sortOrder: 4,
  },
]

async function run() {
  await connectDb()

  let inserted = 0
  for (const seed of SEED_BANNERS) {
    if (await BuildMartBanner.exists({ id: seed.id })) {
      console.log(`[seed:mart-banners] exists, skipped: ${seed.id}`)
      continue
    }
    const asset = await uploadBufferToCloudinary({
      buffer: fs.readFileSync(path.join(ASSET_DIR, seed.file)),
      mimetype: 'image/webp',
      folder: 'buildmart-banners',
      userId: 'seed',
      originalName: seed.file,
      resourceType: 'image',
    })
    const { file: _file, ...fields } = seed
    await BuildMartBanner.create({ ...fields, imageUrl: asset.url, image: asset.url, active: true })
    inserted += 1
    console.log(`[seed:mart-banners] created: ${seed.id}`)
  }

  // Older banners predate `sortOrder`; place them after the seeded ones, keeping their order.
  // updateOne (not save) so legacy rows with missing fields don't fail validation.
  const seededIds = SEED_BANNERS.map((s) => s.id)
  // Natural (insertion) order = the order the app showed them in before; some legacy rows lack createdAt.
  const unordered = await BuildMartBanner.find({ id: { $nin: seededIds }, sortOrder: { $exists: false } })
    .sort({ $natural: 1 })
    .select('id')
    .lean()
  let order = 10
  for (const b of unordered) {
    await BuildMartBanner.updateOne({ id: b.id }, { $set: { sortOrder: order } })
    order += 10
  }
  if (unordered.length) console.log(`[seed:mart-banners] ordered ${unordered.length} existing banner(s) after the seeded ones`)

  console.log(`[seed:mart-banners] done (${inserted} created)`)
}

run()
  .catch((err) => {
    console.error('[seed:mart-banners] failed:', err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())

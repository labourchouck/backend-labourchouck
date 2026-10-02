/**
 * Seeds the built-in Mappto home banners into the APP banner carousel.
 *
 * - Uploads each image to Cloudinary and creates a Banner row (panel APP).
 * - Idempotent: a banner is matched by its file slug in `imageUrl`, so re-running
 *   never duplicates it and never overwrites what an admin changed later.
 * - On first insert, existing APP banners still at the default sortOrder 0 are
 *   moved behind the seeded ones (keeping their current relative order).
 *
 * Usage: npm run seed:banners
 */
import '../config/env.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { connectDb } from '../config/db.js'
import { Banner } from '../models/Banner.js'
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSET_DIR = path.join(__dirname, 'assets', 'banners')

const SEED_BANNERS = [
  {
    slug: 'mappto-home-book-trusted',
    file: 'mappto-home-book-trusted.webp',
    targetUrl: '/app/search',
    sortOrder: 1,
  },
  {
    slug: 'mappto-home-schedule',
    file: 'mappto-home-schedule.webp',
    // Opens the Schedule booking picker on the user home screen.
    targetUrl: '/app?book=scheduled',
    sortOrder: 2,
  },
  {
    slug: 'mappto-home-buildmart',
    file: 'mappto-home-buildmart.webp',
    targetUrl: '/app/buildmart',
    sortOrder: 3,
  },
]

const APP_PANEL_FILTER = { $or: [{ panel: 'APP' }, { panel: { $exists: false } }] }

async function run() {
  await connectDb()

  let inserted = 0
  for (const seed of SEED_BANNERS) {
    const existing = await Banner.findOne({ imageUrl: { $regex: seed.slug } })
    if (existing) {
      console.log(`[seed:banners] exists, skipped: ${seed.slug} (${existing._id})`)
      continue
    }

    const buffer = fs.readFileSync(path.join(ASSET_DIR, seed.file))
    const asset = await uploadBufferToCloudinary({
      buffer,
      mimetype: 'image/webp',
      folder: 'banners',
      userId: 'seed',
      originalName: seed.file,
      resourceType: 'image',
    })

    const banner = await Banner.create({
      imageUrl: asset.url,
      targetUrl: seed.targetUrl,
      isActive: true,
      sortOrder: seed.sortOrder,
      panel: 'APP',
    })
    inserted += 1
    console.log(`[seed:banners] created: ${seed.slug} (${banner._id})`)
  }

  if (inserted > 0) {
    const seededSlugs = SEED_BANNERS.map((s) => s.slug).join('|')
    const others = await Banner.find({
      ...APP_PANEL_FILTER,
      sortOrder: 0,
      imageUrl: { $not: { $regex: seededSlugs } },
    }).sort({ createdAt: -1 })

    let order = 10
    for (const b of others) {
      b.sortOrder = order
      order += 10
      await b.save()
    }
    if (others.length) console.log(`[seed:banners] moved ${others.length} existing banner(s) after the seeded ones`)
  }

  console.log(`[seed:banners] done (${inserted} created)`)
}

run()
  .catch((err) => {
    console.error('[seed:banners] failed:', err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())

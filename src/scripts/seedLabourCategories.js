import 'dotenv/config'
import mongoose from 'mongoose'
import { LabourCategoryGroup } from '../models/LabourCategoryGroup.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LABOUR_CATEGORY_SEED } from '../data/labourCategorySeed.js'
import { slugify } from '../utils/slugify.js'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)

  for (const row of LABOUR_CATEGORY_SEED) {
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
          isActive: true,
        },
      },
      { upsert: true, new: true },
    )

    for (const item of row.items) {
      const base = slugify(item.name)
      const slug = `${row.group.slug}-${base}-${item.sortOrder}`
      await LabourCategory.findOneAndUpdate(
        { slug },
        {
          $set: {
            group: g._id,
            name: item.name,
            slug,
            subtitle: item.subtitle || '',
            sortOrder: item.sortOrder,
            isActive: true,
          },
        },
        { upsert: true, new: true },
      )
    }
  }

  console.log('Labour categories seeded:', LABOUR_CATEGORY_SEED.length, 'groups')
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

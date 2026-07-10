import { LabourCategoryGroup, LABOUR_GROUP_KIND } from '../models/LabourCategoryGroup.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'

/** GET /labour-categories/grouped — active catalogue for worker UI & admin */
export const listGrouped = asyncHandler(async (_req, res) => {
  const groups = await LabourCategoryGroup.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean()
  const groupIds = groups.map((g) => g._id)
  const categories = await LabourCategory.find({
    isActive: true,
    group: { $in: groupIds },
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean()

  const subcats = await import('../models/LabourSubcategory.js').then(m => m.LabourSubcategory.find({ isActive: true }).sort({ name: 1 }).lean())
  
  const subcatsByCat = new Map()
  for (const sc of subcats) {
    const k = String(sc.categoryId)
    if (!subcatsByCat.has(k)) subcatsByCat.set(k, [])
    subcatsByCat.get(k).push(sc)
  }

  const byGroup = new Map()
  for (const g of groups) {
    byGroup.set(String(g._id), [])
  }
  for (const c of categories) {
    const key = String(c.group)
    if (!byGroup.has(key)) continue
    byGroup.get(key).push({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      subtitle: c.subtitle,
      imageUrl: c.imageUrl || '',
      sortOrder: c.sortOrder,
      subcategories: subcatsByCat.get(String(c._id)) || []
    })
  }

  const data = {
    groups: groups.map((g) => ({
      _id: g._id,
      name: g.name,
      slug: g.slug,
      description: g.description,
      helperText: g.helperText,
      kind: g.kind,
      sortOrder: g.sortOrder,
      imageUrl: g.imageUrl || '',
      categories: byGroup.get(String(g._id)) ?? [],
    })),
    meta: {
      profileKind: LABOUR_GROUP_KIND.PROFILE,
      tradeKind: LABOUR_GROUP_KIND.TRADE,
    },
  }

  return sendSuccess(res, { data })
})

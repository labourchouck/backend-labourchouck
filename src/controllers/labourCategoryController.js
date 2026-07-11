import { LabourCategoryGroup, LABOUR_GROUP_KIND } from '../models/LabourCategoryGroup.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'

/** GET /labour-categories/grouped — active catalogue for worker UI & admin */
export const listGrouped = asyncHandler(async (_req, res) => {
  const categories = await LabourCategory.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean()

  const subcats = await import('../models/LabourSubcategory.js').then(m => m.LabourSubcategory.find({ isActive: true }).sort({ name: 1 }).lean())
  const services = await import('../models/LabourService.js').then(m => m.LabourService.find({ isActive: true }).sort({ name: 1 }).lean())

  const servicesBySubcat = new Map()
  for (const s of services) {
    const k = String(s.subcategoryId)
    if (!servicesBySubcat.has(k)) servicesBySubcat.set(k, [])
    servicesBySubcat.get(k).push(s)
  }
  
  const subcatsByCat = new Map()
  for (const sc of subcats) {
    sc.services = servicesBySubcat.get(String(sc._id)) ?? []
    const k = String(sc.categoryId)
    if (!subcatsByCat.has(k)) subcatsByCat.set(k, [])
    subcatsByCat.get(k).push({
      _id: sc._id,
      name: sc.name,
      slug: sc.slug || sc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      subtitle: sc.description || '',
      imageUrl: sc.iconUrl || '',
      sortOrder: sc.sortOrder || 0,
      services: sc.services
    })
  }

  const data = {
    groups: categories.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      description: c.subtitle || '',
      helperText: '',
      kind: LABOUR_GROUP_KIND.TRADE, // Mock as trade so frontend picks it up
      sortOrder: c.sortOrder,
      imageUrl: c.imageUrl || '',
      categories: subcatsByCat.get(String(c._id)) ?? [],
    })),
    meta: {
      profileKind: LABOUR_GROUP_KIND.PROFILE,
      tradeKind: LABOUR_GROUP_KIND.TRADE,
    },
  }

  return sendSuccess(res, { data })
})

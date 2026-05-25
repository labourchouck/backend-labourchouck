import { USER_ROLES } from '../constants/roles.js'

export async function populateLabourCategories(user) {
  if (!user || user.role !== USER_ROLES.LABOUR) return user
  const ids = user.labourProfile?.categoryIds
  if (!ids?.length) return user
  await user.populate({
    path: 'labourProfile.categoryIds',
    select: 'name slug subtitle group isActive',
    populate: { path: 'group', select: 'name slug kind sortOrder' },
  })
  return user
}

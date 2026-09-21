import { Referral, REFERRAL_STATUS } from '../models/Referral.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

/**
 * GET /admin/referrals?status=&search=&page=&limit=
 * Paginated list plus headline totals for the admin Refer & Earn page.
 */
export const listReferrals = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(200, Math.max(5, parseInt(req.query.limit, 10) || 25))

  const filter = {}
  if (req.query.status && REFERRAL_STATUS[req.query.status]) {
    filter.status = req.query.status
  }

  const [items, total, statusCounts, paidAgg] = await Promise.all([
    Referral.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('referrerId', 'fullName phone role referralCode')
      .populate('refereeId', 'fullName phone role createdAt')
      .lean(),
    Referral.countDocuments(filter),
    Referral.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Referral.aggregate([
      { $match: { status: REFERRAL_STATUS.REWARDED } },
      {
        $group: {
          _id: null,
          referrerPaid: { $sum: '$referrerReward' },
          refereePaid: { $sum: '$refereeReward' },
        },
      },
    ]),
  ])

  const counts = { PENDING: 0, QUALIFIED: 0, REWARDED: 0, REJECTED: 0 }
  for (const row of statusCounts) {
    if (row._id in counts) counts[row._id] = row.count
  }

  const paid = paidAgg[0] ?? { referrerPaid: 0, refereePaid: 0 }

  return sendSuccess(res, {
    data: {
      items,
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
      summary: {
        counts,
        totalReferrals: Object.values(counts).reduce((a, b) => a + b, 0),
        totalPaid: (paid.referrerPaid || 0) + (paid.refereePaid || 0),
      },
    },
  })
})

/**
 * PATCH /admin/referrals/:id/reject — block a referral that has not been paid.
 * Already-rewarded rows are left alone; money that has been credited is not
 * clawed back from here.
 */
export const rejectReferral = asyncHandler(async (req, res) => {
  const updated = await Referral.findOneAndUpdate(
    {
      _id: req.params.id,
      status: { $in: [REFERRAL_STATUS.PENDING, REFERRAL_STATUS.QUALIFIED] },
    },
    {
      $set: {
        status: REFERRAL_STATUS.REJECTED,
        note: String(req.body?.note || '').slice(0, 500),
      },
    },
    { new: true },
  )

  if (!updated) {
    return sendError(res, {
      message: 'Referral not found, or it has already been rewarded',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'REFERRAL_NOT_PENDING',
    })
  }

  return sendSuccess(res, { message: 'Referral rejected', data: { referral: updated } })
})

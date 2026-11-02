import { BuildMartLead } from '../models/BuildMartLead.js'
import { USER_ROLES } from '../constants/roles.js'
import { sendToUser } from './notificationService.js'

export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost']

/**
 * A request only moves forward: new -> contacted -> quoted -> won / lost (steps may be skipped).
 * Won and lost are final. This stops a lead from being bounced back to an earlier status, which would
 * also send the buyer misleading "updates".
 */
export const NEXT_STATUSES = {
  new: ['contacted', 'quoted', 'won', 'lost'],
  contacted: ['quoted', 'won', 'lost'],
  quoted: ['won', 'lost'],
  won: [],
  lost: [],
}

export const transitionError = (from, to) =>
  NEXT_STATUSES[from]?.length === 0
    ? `This request is already marked ${from} and can no longer be changed.`
    : `A request can only move forward. It is already ${from}, so it cannot go back to ${to}.`

/** Where a requester opens their Mart orders, per app. */
export const ordersLinkForRole = (role) => (role === USER_ROLES.CORPORATE ? '/corporate/mart/orders' : '/app/buildmart/orders')

const customerCopy = (status, { productName, sellerName }) => {
  const product = productName || 'your request'
  switch (status) {
    case 'contacted':
      return { title: 'Seller contacted you', body: `${sellerName} has seen your request for ${product} and will reach out shortly.` }
    case 'quoted':
      return { title: 'Your quote is ready', body: `${sellerName} sent a quote for ${product}. Check your phone or WhatsApp.` }
    case 'won':
      return { title: 'Order confirmed', body: `Your order for ${product} is confirmed with ${sellerName}.` }
    case 'lost':
      return { title: 'Request closed', body: `Your request for ${product} was closed. You can request a quote again anytime.` }
    default:
      return null
  }
}

/**
 * Moves a Mart request to a new status, records it in the request's history and tells the requester.
 * @param {{ filter: object, status: string, note?: string, actor: { role: string, name?: string } }} args
 * @returns {Promise<{ lead: object|null, changed: boolean, rejected?: string }>}
 */
export async function changeLeadStatus({ filter, status, note, actor }) {
  const existing = await BuildMartLead.findOne(filter).populate('vendorId', 'fullName contractorProfile.businessName').lean()
  if (!existing) return { lead: null, changed: false }

  if (status !== existing.status && !NEXT_STATUSES[existing.status]?.includes(status)) {
    return { lead: existing, changed: false, rejected: transitionError(existing.status, status) }
  }

  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 300) : ''
  if (existing.status === status && !cleanNote) return { lead: existing, changed: false }

  const lead = await BuildMartLead.findOneAndUpdate(
    { _id: existing._id },
    {
      $set: { status },
      $push: {
        statusHistory: {
          status,
          note: cleanNote || undefined,
          by: actor?.role || 'system',
          byName: actor?.name || undefined,
          at: new Date(),
        },
      },
    },
    { new: true, runValidators: true },
  ).lean()

  const statusChanged = existing.status !== status
  if (statusChanged && lead.userId) {
    const sellerName = existing.vendorId?.contractorProfile?.businessName || existing.vendorId?.fullName || 'The Mappto team'
    const copy = customerCopy(status, { productName: lead.productName, sellerName })
    if (copy) {
      console.log(`[MART] lead ${lead._id}: ${existing.status} -> ${status} by ${actor?.role}; notifying requester ${lead.userId}`)
      sendToUser(lead.userId, {
        ...copy,
        type: 'BUILDMART_QUOTE_UPDATE',
        data: { leadId: String(lead._id), status, link: ordersLinkForRole(lead.userRole) },
      }).catch((err) => console.error('Push notify (mart request update) failed:', err))
    }
  }
  return { lead, changed: statusChanged }
}

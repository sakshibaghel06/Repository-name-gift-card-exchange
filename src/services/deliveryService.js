const DELIVERY_KEY = 'giftly-deliveries'
export const DELIVERY_CHANGE_EVENT = 'giftly-delivery-change'
export const DELIVERY_NOTICE = 'Delivery channels are simulated in this prototype. Production deployment requires secure backend infrastructure and verified email/SMS providers.'

export const DELIVERY_STATUSES = ['PENDING', 'DELIVERED', 'VIEWED', 'FAILED', 'CANCELLED']
export const DELIVERY_CHANNELS = ['IN_APP', 'EMAIL', 'SMS']

function read() {
  try { return JSON.parse(localStorage.getItem(DELIVERY_KEY)) || [] } catch { return [] }
}

function write(records) {
  localStorage.setItem(DELIVERY_KEY, JSON.stringify(records))
  window.dispatchEvent(new CustomEvent(DELIVERY_CHANGE_EVENT))
  return records
}

function makeReference() {
  const serial = String(Date.now()).slice(-6).padStart(6, '0')
  return `GX-DEL-${new Date().getFullYear()}-${serial}`
}

function requireUser(actor) {
  if (!actor?.email) throw new Error('Sign in to access this delivery.')
}

function requireAdmin(actor) {
  requireUser(actor)
  if (actor.role !== 'admin') throw new Error('Admin access is required for this action.')
}

function assertParty(record, actor) {
  requireUser(actor)
  const isParty = actor.email === record.buyerId || actor.email === record.sellerId
  if (!isParty && actor.role !== 'admin') throw new Error('This delivery is not available to your account.')
}

function findRecord(records, deliveryId) {
  return records.find((record) => record.id === deliveryId || record.deliveryId === deliveryId)
}

// Simulated only — no real email provider is contacted in this prototype.
export function simulateEmailDelivery(record) {
  return { channel: 'EMAIL', status: 'SENT', sentAt: new Date().toISOString(), note: `Simulated email to a masked address for ${record.brand} delivery.` }
}

// Simulated only — no real SMS provider is contacted in this prototype.
export function simulateSmsDelivery(record) {
  return { channel: 'SMS', status: 'SENT', sentAt: new Date().toISOString(), note: `Simulated SMS to a masked number for ${record.brand} delivery.` }
}

function sendAllChannels(record) {
  const now = new Date().toISOString()
  return [
    { channel: 'IN_APP', status: 'SENT', sentAt: now, note: 'Available securely in-app.' },
    simulateEmailDelivery(record),
    simulateSmsDelivery(record),
  ]
}

// Creates a delivery record once escrow reaches the delivered/buyer-review
// stage. Idempotent per escrow record so re-invoking (e.g. a re-render or a
// retry) never creates duplicate deliveries. Only stores masked card data
// that already existed on the escrow record — never a full card number, PIN,
// CVV, or any other sensitive value.
export function createDelivery(escrow, actor) {
  requireUser(actor)
  if (actor.email !== escrow.sellerId && actor.role !== 'admin') throw new Error('Only the seller can create a delivery for this transaction.')
  const records = read()
  const existing = records.find((record) => record.escrowRecordId === escrow.id)
  if (existing) return markDelivered(existing.id)

  const now = new Date().toISOString()
  const record = {
    id: `del-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    deliveryId: makeReference(),
    escrowId: escrow.escrowId,
    escrowRecordId: escrow.id,
    transactionId: escrow.transactionId,
    buyerId: escrow.buyerId,
    sellerId: escrow.sellerId,
    brand: escrow.brand,
    currency: escrow.currency,
    faceValue: escrow.faceValue,
    maskedCardNumber: escrow.maskedCardNumber,
    status: 'PENDING',
    channels: DELIVERY_CHANNELS.map((channel) => ({ channel, status: 'PENDING', sentAt: null })),
    createdAt: now,
    deliveredAt: null,
    viewedAt: null,
    cancelledAt: null,
  }
  write([record, ...records])
  return markDelivered(record.id)
}

// Transitions a delivery to DELIVERED and simulates all three channels.
// Safe to call again (e.g. an admin "resend" action) — it re-simulates the
// channel sends without changing the original createdAt.
export function markDelivered(deliveryId) {
  const records = read()
  const record = findRecord(records, deliveryId)
  if (!record) throw new Error('Delivery record not found.')
  if (record.status === 'CANCELLED') throw new Error('This delivery was cancelled and cannot be re-delivered.')
  const now = new Date().toISOString()
  const updated = { ...record, status: record.status === 'VIEWED' ? 'VIEWED' : 'DELIVERED', deliveredAt: record.deliveredAt || now, channels: sendAllChannels(record) }
  write(records.map((item) => item.id === record.id ? updated : item))
  return updated
}

// Buyer-only: marks the delivery as viewed the first time the buyer opens
// the secure reveal panel, recording a viewedAt timestamp.
export function markViewed(deliveryId, actor) {
  const records = read()
  const record = findRecord(records, deliveryId)
  if (!record) throw new Error('Delivery record not found.')
  requireUser(actor)
  if (actor.email !== record.buyerId && actor.role !== 'admin') throw new Error('Only the buyer can open this secure delivery.')
  if (record.status !== 'DELIVERED' && record.status !== 'VIEWED') return record
  const updated = record.status === 'VIEWED' ? record : { ...record, status: 'VIEWED', viewedAt: new Date().toISOString() }
  write(records.map((item) => item.id === record.id ? updated : item))
  return updated
}

export function cancelDelivery(deliveryId, actor) {
  requireAdmin(actor)
  const records = read()
  const record = findRecord(records, deliveryId)
  if (!record) throw new Error('Delivery record not found.')
  const updated = { ...record, status: 'CANCELLED', cancelledAt: new Date().toISOString() }
  write(records.map((item) => item.id === record.id ? updated : item))
  return updated
}

export function getDelivery(deliveryId, actor) {
  const records = read()
  const record = findRecord(records, deliveryId)
  if (!record) throw new Error('Delivery record not found.')
  assertParty(record, actor)
  return record
}

export function getDeliveryByEscrow(escrowRecordId) {
  return read().find((record) => record.escrowRecordId === escrowRecordId) || null
}

export function getDeliveryStatus(deliveryId) {
  return findRecord(read(), deliveryId)?.status || null
}

export function getUserDeliveries(userId) {
  return read()
    .filter((record) => record.buyerId === userId || record.sellerId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function getAdminDeliveries(actor) {
  requireAdmin(actor)
  return read().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}
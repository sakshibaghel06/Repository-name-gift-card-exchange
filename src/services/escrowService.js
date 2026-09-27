import { recordLinkedTransaction, SUPPORTED_CURRENCIES } from './walletService'

const ESCROW_KEY = 'giftly-escrows'
const DISPUTE_KEY = 'giftly-disputes'
const LISTING_KEY = 'giftly-trading-listings'
const TRANSACTION_KEY = 'giftly-trading-transactions'
const sessionEvidence = new Map()
const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 70))

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] }
}

function write(key, records) {
  localStorage.setItem(key, JSON.stringify(records))
  window.dispatchEvent(new CustomEvent('giftly-trading-change'))
  window.dispatchEvent(new CustomEvent('giftly-escrow-change'))
  return records
}

function makeReference(prefix) {
  const serial = String(Date.now()).slice(-6).padStart(6, '0')
  return `GX-${prefix}-${new Date().getFullYear()}-${serial}`
}

function requireUser(actor) {
  if (!actor?.email) throw new Error('Sign in to access this escrow action.')
}

function requireAdmin(actor) {
  requireUser(actor)
  if (actor.role !== 'admin') throw new Error('Admin access is required for this action.')
}

function requireParty(escrow, actor) {
  requireUser(actor)
  if (actor.role === 'admin' || actor.email === escrow.buyerId || actor.email === escrow.sellerId) return
  throw new Error('This escrow is not available to your account.')
}

function findEscrow(escrowId) {
  return read(ESCROW_KEY).find((escrow) => escrow.id === escrowId || escrow.escrowId === escrowId)
}

function saveEscrow(updated) {
  const escrows = read(ESCROW_KEY)
  write(ESCROW_KEY, escrows.map((escrow) => escrow.id === updated.id ? updated : escrow))
  return updated
}

function updateTransaction(transactionId, changes) {
  const transactions = read(TRANSACTION_KEY)
  const transaction = transactions.find((item) => item.id === transactionId || item.transactionId === transactionId)
  if (!transaction) throw new Error('Related transaction could not be found.')
  write(TRANSACTION_KEY, transactions.map((item) => item.id === transaction.id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item))
}

function updateListing(listingId, changes) {
  const listings = read(LISTING_KEY)
  const listing = listings.find((item) => item.id === listingId)
  if (!listing) throw new Error('Related listing could not be found.')
  write(LISTING_KEY, listings.map((item) => item.id === listingId ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item))
}

function recordWalletEvent(escrow, userId, type, status, description) {
  if (!SUPPORTED_CURRENCIES.some(({ code }) => code === escrow.currency)) return
  recordLinkedTransaction({
    userId, type, currency: escrow.currency, amount: escrow.amount,
    status, description, relatedId: escrow.escrowId,
  })
}

function markExpiredIfNeeded(escrow) {
  if (!escrow || !['FUNDS_SECURED', 'CARD_LOCKED', 'DELIVERED', 'BUYER_REVIEW'].includes(escrow.status) || Date.now() < new Date(escrow.expiresAt).getTime()) return escrow
  const now = new Date().toISOString()
  const expired = { ...escrow, status: 'EXPIRED', expiredAt: now, updatedAt: now }
  saveEscrow(expired)
  updateTransaction(escrow.transactionRecordId, { status: 'ADMIN_REVIEW', escrowStatus: 'EXPIRED' })
  return expired
}

export function getCurrentSessionEvidence(disputeId) {
  return sessionEvidence.get(disputeId) || []
}

export function rollbackEscrowCreation(transaction, actor) {
  requireUser(actor)
  const persistedTransaction = read(TRANSACTION_KEY).find((item) => item.id === transaction?.id)
  if (!persistedTransaction || persistedTransaction.userId !== actor.email || transaction.userId !== actor.email) throw new Error('Only the purchasing account can roll back its failed escrow setup.')
  const transactionId = transaction.id
  const listingId = transaction.listingId
  const transactions = read(TRANSACTION_KEY).filter((item) => item.id !== transactionId)
  const escrows = read(ESCROW_KEY)
  const createdEscrows = escrows.filter((escrow) => escrow.transactionRecordId === transactionId)
  write(ESCROW_KEY, escrows.filter((escrow) => escrow.transactionRecordId !== transactionId))
  write(TRANSACTION_KEY, transactions)
  const listing = read(LISTING_KEY).find((item) => item.id === listingId)
  if (listing && (createdEscrows.length || listing.status === 'ACTIVE')) {
    updateListing(listingId, { status: 'ACTIVE', escrowId: null })
  }
}

// Prototype/mock implementation — no real escrow provider or payment custody is connected.
export async function createEscrow({ transaction, listing, buyer }) {
  requireUser(buyer)
  if (!transaction || transaction.method !== 'p2p' || transaction.userId !== buyer.email) throw new Error('A valid P2P purchase is required to create escrow.')
  const persistedTransaction = read(TRANSACTION_KEY).find((item) => item.id === transaction.id && item.method === 'p2p' && item.userId === buyer.email && item.listingId === listing?.id && item.status === 'ESCROW')
  if (!persistedTransaction) throw new Error('The buyer purchase transaction must exist before escrow can be created.')
  if (!listing || listing.id !== transaction.listingId || listing.sellerId === buyer.email) throw new Error('This listing cannot be placed into escrow.')
  const currentListing = read(LISTING_KEY).find((item) => item.id === listing.id)
  if (!currentListing || currentListing.status !== 'ACTIVE') throw new Error('This gift card is no longer available for escrow.')
  const existing = read(ESCROW_KEY).find((item) => item.listingId === listing.id && !['RELEASED', 'RESOLVED', 'CANCELLED'].includes(item.status))
  if (existing) throw new Error('This gift card is already locked in another escrow.')
  const now = new Date()
  const record = {
    id: `esc-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    escrowId: makeReference('ESC'),
    transactionId: transaction.transactionId,
    transactionRecordId: transaction.id,
    listingId: listing.id,
    giftCardVerificationId: listing.giftCardVerificationId,
    buyerId: buyer.email,
    buyerName: buyer.name,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    brand: listing.brand,
    country: listing.country,
    currency: listing.currency,
    amount: listing.askingPrice,
    faceValue: listing.faceValue,
    maskedCardNumber: listing.maskedCardNumber,
    giftCardVerificationStatus: listing.verificationStatus,
    balanceVerificationStatus: listing.balanceStatus,
    riskStatus: listing.riskStatus || 'LOW RISK',
    riskFlags: listing.riskFlags || [],
    status: 'CREATED',
    paymentStatus: 'PENDING',
    cardStatus: 'AVAILABLE',
    deliveryStatus: 'PENDING',
    buyerConfirmation: 'PENDING',
    disputeStatus: 'NONE',
    disputeId: null,
    createdAt: now.toISOString(),
    paymentConfirmedAt: null,
    deliveredAt: null,
    buyerConfirmedAt: null,
    releasedAt: null,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now.toISOString(),
    prototype: true,
  }
  write(ESCROW_KEY, [record, ...read(ESCROW_KEY)])
  updateListing(listing.id, { status: 'IN_ESCROW', escrowId: record.escrowId })
  await securePaymentForNewEscrow(record.id)
  await lockCardForNewEscrow(record.id)
  recordWalletEvent(record, buyer.email, 'ESCROW_HOLD', 'PENDING', 'Simulated escrow hold record; no real funds are held.')
  return delay(findEscrow(record.id))
}

async function securePaymentForNewEscrow(escrowId) {
  const escrow = findEscrow(escrowId)
  if (!escrow) throw new Error('Escrow was not found.')
  if (!['CREATED', 'PAYMENT_PENDING'].includes(escrow.status)) throw new Error('Payment cannot be secured at this escrow stage.')
  const now = new Date().toISOString()
  const updated = { ...escrow, status: 'FUNDS_SECURED', paymentStatus: 'SIMULATED_PAID', paymentConfirmedAt: now, updatedAt: now }
  saveEscrow(updated)
  updateTransaction(escrow.transactionRecordId, { status: 'PAYMENT_SECURED', paymentStatus: 'SIMULATED_PAID', escrowId: escrow.escrowId, escrowRecordId: escrow.id })
  return delay(updated)
}

export async function markPaymentSecured(escrowId, actor) {
  requireAdmin(actor)
  return securePaymentForNewEscrow(escrowId)
}

async function lockCardForNewEscrow(escrowId) {
  const escrow = findEscrow(escrowId)
  if (!escrow) throw new Error('Escrow was not found.')
  if (escrow.paymentStatus !== 'SIMULATED_PAID' || escrow.cardStatus !== 'AVAILABLE') throw new Error('The card is not available to lock.')
  const now = new Date().toISOString()
  const updated = { ...escrow, status: 'CARD_LOCKED', cardStatus: 'LOCKED', updatedAt: now }
  saveEscrow(updated)
  updateListing(escrow.listingId, { status: 'IN_ESCROW', escrowId: escrow.escrowId })
  updateTransaction(escrow.transactionRecordId, { status: 'CARD_LOCKED', escrowId: escrow.escrowId, escrowRecordId: escrow.id, escrowStatus: updated.status, cardStatus: 'LOCKED' })
  return delay(updated)
}

export async function lockGiftCard(escrowId, actor) {
  requireAdmin(actor)
  return lockCardForNewEscrow(escrowId)
}

export async function getEscrow(escrowId, actor) {
  requireUser(actor)
  const storedEscrow = findEscrow(escrowId)
  if (!storedEscrow) return delay(null)
  requireParty(storedEscrow, actor)
  const escrow = markExpiredIfNeeded(storedEscrow)
  return delay(escrow)
}

export async function getEscrows(actor, filter = 'All') {
  requireUser(actor)
  const escrows = read(ESCROW_KEY).map(markExpiredIfNeeded).filter((escrow) => actor.role === 'admin' || escrow.buyerId === actor.email || escrow.sellerId === actor.email)
  const filtered = filter === 'All' ? escrows : escrows.filter((escrow) => escrow.status === filter)
  return delay(filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)))
}

export async function getUserEscrows(actor) {
  return getEscrows(actor, 'All')
}

export async function getAdminEscrows(actor, filter = 'All') {
  requireAdmin(actor)
  const escrows = read(ESCROW_KEY).map(markExpiredIfNeeded)
  const filtered = filter === 'All' ? escrows : filter === 'Active' ? escrows.filter((item) => ['FUNDS_SECURED', 'CARD_LOCKED', 'DELIVERED', 'BUYER_REVIEW'].includes(item.status)) : filter === 'Disputed' ? escrows.filter((item) => item.status === 'DISPUTED') : filter === 'Released' ? escrows.filter((item) => item.status === 'RELEASED' || item.status === 'RESOLVED') : filter === 'Expired' ? escrows.filter((item) => item.status === 'EXPIRED') : escrows
  return delay(filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
}

export async function deliverGiftCard(escrowId, seller) {
  requireUser(seller)
  const escrow = markExpiredIfNeeded(findEscrow(escrowId))
  if (!escrow) throw new Error('Escrow was not found.')
  if (seller.email !== escrow.sellerId) throw new Error('Only the seller can deliver this gift card.')
  if (!['FUNDS_SECURED', 'CARD_LOCKED'].includes(escrow.status) || escrow.cardStatus !== 'LOCKED') throw new Error('This card is not ready for delivery.')
  const now = new Date().toISOString()
  const updated = { ...escrow, status: 'BUYER_REVIEW', deliveryStatus: 'DELIVERED', deliveredAt: now, updatedAt: now }
  saveEscrow(updated)
  updateTransaction(escrow.transactionRecordId, { status: 'BUYER_REVIEW', deliveryStatus: 'DELIVERED' })
  return delay(updated)
}

export async function releaseEscrow(escrowId, actor, { buyerConfirmed = false } = {}) {
  requireUser(actor)
  const escrow = markExpiredIfNeeded(findEscrow(escrowId))
  if (!escrow) throw new Error('Escrow was not found.')
  if (!buyerConfirmed) requireAdmin(actor)
  else if (actor.email !== escrow.buyerId) throw new Error('Only the buyer can confirm and release this transaction.')
  if (buyerConfirmed && (escrow.status !== 'BUYER_REVIEW' || escrow.disputeId)) throw new Error('Only the buyer can confirm an undisputed delivered card.')
  const adminExpiredReview = !buyerConfirmed && actor.role === 'admin' && escrow.status === 'EXPIRED' && escrow.reviewStatus === 'UNDER_REVIEW'
  if (!buyerConfirmed && !adminExpiredReview && !['BUYER_REVIEW', 'DELIVERED', 'DISPUTED'].includes(escrow.status)) throw new Error('This escrow is not ready to be released.')
  if (!buyerConfirmed && escrow.status === 'DISPUTED' && !['OPEN', 'UNDER_REVIEW'].includes(escrow.disputeStatus)) throw new Error('This dispute is already closed.')
  const now = new Date().toISOString()
  const updated = {
    ...escrow,
    status: 'RELEASED',
    cardStatus: 'RELEASED',
    deliveryStatus: buyerConfirmed ? 'CONFIRMED' : escrow.deliveryStatus,
    buyerConfirmation: buyerConfirmed ? 'CONFIRMED' : escrow.buyerConfirmation,
    disputeStatus: escrow.disputeStatus === 'OPEN' || escrow.disputeStatus === 'UNDER_REVIEW' ? 'RESOLVED_SELLER' : escrow.disputeStatus,
    buyerConfirmedAt: buyerConfirmed ? now : escrow.buyerConfirmedAt,
    releasedAt: now,
    updatedAt: now,
  }
  saveEscrow(updated)
  updateTransaction(escrow.transactionRecordId, { status: 'COMPLETED', escrowStatus: 'RELEASED', releasedAt: now })
  updateListing(escrow.listingId, { status: 'SOLD', soldAt: now })
  if (escrow.disputeId) updateDisputeStatus(escrow.disputeId, 'RESOLVED_SELLER', actor, now)
  recordWalletEvent(escrow, escrow.sellerId, 'ESCROW_RELEASE', 'COMPLETED', 'Simulated escrow release ledger entry; no real funds were transferred.')
  return delay(updated)
}

export async function confirmGiftCard(escrowId, buyer, confirmed) {
  requireUser(buyer)
  if (!confirmed) throw new Error('Confirm the validity and displayed balance before release.')
  const escrow = markExpiredIfNeeded(findEscrow(escrowId))
  if (!escrow || buyer.email !== escrow.buyerId) throw new Error('Only the buyer can confirm this gift card.')
  if (escrow.status !== 'BUYER_REVIEW' || escrow.deliveryStatus !== 'DELIVERED' || escrow.disputeId) throw new Error('This gift card is not available for buyer confirmation.')
  return releaseEscrow(escrowId, buyer, { buyerConfirmed: true })
}

export async function openDispute({ escrowId, buyer, reason, description, evidence = [] }) {
  requireUser(buyer)
  const escrow = markExpiredIfNeeded(findEscrow(escrowId))
  if (!escrow) throw new Error('Escrow was not found.')
  if (buyer.email !== escrow.buyerId) throw new Error('Only the buyer can report a problem.')
  if (!['BUYER_REVIEW', 'DELIVERED'].includes(escrow.status)) throw new Error('A dispute can only be opened after delivery.')
  if (!reason || !String(description || '').trim()) throw new Error('Choose a problem type and describe the issue.')
  const now = new Date().toISOString()
  const dispute = {
    id: `dsp-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    disputeId: makeReference('DSP'), escrowId: escrow.escrowId, escrowRecordId: escrow.id,
    transactionId: escrow.transactionId, transactionRecordId: escrow.transactionRecordId,
    listingId: escrow.listingId, buyerId: escrow.buyerId, buyerName: escrow.buyerName,
    sellerId: escrow.sellerId, sellerName: escrow.sellerName, brand: escrow.brand,
    currency: escrow.currency, amount: escrow.amount, reason,
    description: String(description).trim(), evidenceCount: evidence.length,
    status: 'OPEN', createdAt: now,
    updatedAt: now, timeline: [{ event: 'Dispute Submitted', at: now, actor: buyer.email }],
  }
  sessionEvidence.set(dispute.id, evidence)
  write(DISPUTE_KEY, [dispute, ...read(DISPUTE_KEY)])
  saveEscrow({ ...escrow, status: 'DISPUTED', disputeStatus: 'OPEN', disputeId: dispute.id, updatedAt: now })
  updateTransaction(escrow.transactionRecordId, { status: 'DISPUTED', disputeStatus: 'OPEN' })
  return delay(dispute)
}

function updateDisputeStatus(disputeId, status, actor, at = new Date().toISOString(), event = 'Decision') {
  const disputes = read(DISPUTE_KEY)
  write(DISPUTE_KEY, disputes.map((dispute) => dispute.id === disputeId ? {
    ...dispute, status, updatedAt: at,
    timeline: [...(dispute.timeline || []), { event, at, actor: actor?.email || 'Giftly admin' }],
  } : dispute))
}

export async function getDisputes(actor) {
  requireUser(actor)
  return delay(read(DISPUTE_KEY).filter((dispute) => actor.role === 'admin' || dispute.buyerId === actor.email || dispute.sellerId === actor.email).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
}

export async function getDispute(disputeId, actor) {
  requireUser(actor)
  const dispute = read(DISPUTE_KEY).find((item) => item.id === disputeId || item.disputeId === disputeId)
  if (!dispute) return delay(null)
  if (actor.role !== 'admin' && actor.email !== dispute.buyerId && actor.email !== dispute.sellerId) throw new Error('This dispute is not available to your account.')
  return delay(dispute)
}

export async function requestMoreInformation(escrowId, actor, message = '') {
  requireAdmin(actor)
  const escrow = findEscrow(escrowId)
  if (!escrow) throw new Error('Escrow was not found.')
  if (['RELEASED', 'RESOLVED', 'CANCELLED'].includes(escrow.status)) throw new Error('More information cannot be requested for a closed escrow.')
  const now = new Date().toISOString()
  const updated = {
    ...escrow,
    status: escrow.disputeId ? 'DISPUTED' : escrow.status,
    disputeStatus: escrow.disputeId ? 'UNDER_REVIEW' : escrow.disputeStatus,
    reviewStatus: 'UNDER_REVIEW', reviewNote: String(message).slice(0, 500), updatedAt: now,
  }
  saveEscrow(updated)
  updateTransaction(escrow.transactionRecordId, { status: 'ADMIN_REVIEW', disputeStatus: updated.disputeStatus, reviewStatus: 'UNDER_REVIEW' })
  if (escrow.disputeId) updateDisputeStatus(escrow.disputeId, 'UNDER_REVIEW', actor, now, 'More Information Requested')
  return delay(updated)
}

export async function resolveDispute(escrowId, actor, outcome) {
  requireAdmin(actor)
  const escrow = findEscrow(escrowId)
  if (!escrow || !escrow.disputeId) throw new Error('No dispute is associated with this escrow.')
  const dispute = read(DISPUTE_KEY).find((item) => item.id === escrow.disputeId)
  if (escrow.status !== 'DISPUTED' || !dispute || !['OPEN', 'UNDER_REVIEW'].includes(dispute.status)) throw new Error('This dispute is already closed or not ready for resolution.')
  if (!['buyer', 'seller'].includes(outcome)) throw new Error('Choose a valid dispute resolution.')
  if (outcome === 'seller') return releaseEscrow(escrowId, actor)
  const now = new Date().toISOString()
  const updated = { ...escrow, status: 'RESOLVED', paymentStatus: 'REFUNDED', cardStatus: 'AVAILABLE', disputeStatus: 'RESOLVED_BUYER', updatedAt: now, resolvedAt: now }
  saveEscrow(updated)
  updateTransaction(escrow.transactionRecordId, { status: 'REFUNDED', paymentStatus: 'REFUNDED', disputeStatus: 'RESOLVED_BUYER', resolvedAt: now })
  updateListing(escrow.listingId, { status: 'ACTIVE', escrowId: null, cardReturnedAvailable: true })
  updateDisputeStatus(escrow.disputeId, 'RESOLVED_BUYER', actor, now)
  recordWalletEvent(escrow, escrow.buyerId, 'REFUND', 'COMPLETED', 'Simulated buyer refund record; no real funds were transferred.')
  return delay(updated)
}

export async function refundEscrow(escrowId, actor) {
  requireAdmin(actor)
  const escrow = findEscrow(escrowId)
  if (!escrow || ['RELEASED', 'RESOLVED', 'CANCELLED'].includes(escrow.status)) throw new Error('This escrow cannot be refunded.')
  const now = new Date().toISOString()
  const updated = { ...escrow, status: 'RESOLVED', paymentStatus: 'REFUNDED', cardStatus: 'AVAILABLE', disputeStatus: escrow.disputeId ? 'RESOLVED_BUYER' : escrow.disputeStatus, resolvedAt: now, updatedAt: now }
  saveEscrow(updated)
  updateTransaction(escrow.transactionRecordId, { status: 'REFUNDED', paymentStatus: 'REFUNDED', disputeStatus: updated.disputeStatus, resolvedAt: now })
  updateListing(escrow.listingId, { status: 'ACTIVE', escrowId: null, cardReturnedAvailable: true })
  if (escrow.disputeId) updateDisputeStatus(escrow.disputeId, 'RESOLVED_BUYER', actor, now)
  recordWalletEvent(escrow, escrow.buyerId, 'REFUND', 'COMPLETED', 'Simulated buyer refund record; no real funds were transferred.')
  return delay(updated)
}

export async function expireEscrow(escrowId, actor) {
  requireAdmin(actor)
  const escrow = findEscrow(escrowId)
  if (!escrow) throw new Error('Escrow was not found.')
  if (Date.now() < new Date(escrow.expiresAt).getTime()) return delay(escrow)
  return delay(markExpiredIfNeeded(escrow))
}

export async function cancelEscrow(escrowId, actor) {
  requireAdmin(actor)
  const escrow = findEscrow(escrowId)
  if (!escrow || escrow.deliveredAt || ['RELEASED', 'RESOLVED', 'DISPUTED'].includes(escrow.status)) throw new Error('This escrow cannot be cancelled after delivery or review.')
  const now = new Date().toISOString()
  const updated = { ...escrow, status: 'CANCELLED', paymentStatus: escrow.paymentStatus === 'SIMULATED_PAID' ? 'REFUNDED' : escrow.paymentStatus, cardStatus: 'AVAILABLE', updatedAt: now, cancelledAt: now }
  saveEscrow(updated)
  updateTransaction(escrow.transactionRecordId, { status: 'CANCELLED', paymentStatus: updated.paymentStatus })
  updateListing(escrow.listingId, { status: 'CANCELLED', escrowId: null, cardReturnedAvailable: true })
  if (escrow.paymentStatus === 'SIMULATED_PAID') recordWalletEvent(escrow, escrow.buyerId, 'REFUND', 'COMPLETED', 'Simulated escrow cancellation refund record; no real funds were transferred.')
  return delay(updated)
}

export async function addEvidence(disputeId, actor, files) {
  const dispute = await getDispute(disputeId, actor)
  if (!dispute || actor.email !== dispute.buyerId) throw new Error('Only the buyer can add evidence.')
  sessionEvidence.set(dispute.id, [...getCurrentSessionEvidence(dispute.id), ...files])
  const now = new Date().toISOString()
  const disputes = read(DISPUTE_KEY)
  const updated = disputes.map((item) => item.id === dispute.id ? {
    ...item, evidenceCount: (item.evidenceCount || 0) + files.length,
    updatedAt: now,
    timeline: [...(item.timeline || []), { event: 'Evidence Added', at: now, actor: actor.email }],
  } : item)
  write(DISPUTE_KEY, updated)
  return delay(updated.find((item) => item.id === dispute.id))
}

export async function setDisputeUnderReview(disputeId, actor, message = '') {
  requireAdmin(actor)
  const dispute = read(DISPUTE_KEY).find((item) => item.id === disputeId)
  if (!dispute) throw new Error('Dispute was not found.')
  if (!['OPEN', 'UNDER_REVIEW'].includes(dispute.status)) throw new Error('This dispute is already closed.')
  const now = new Date().toISOString()
  const updated = read(DISPUTE_KEY).map((item) => item.id === disputeId ? {
    ...item, status: 'UNDER_REVIEW', reviewNote: String(message).slice(0, 500), updatedAt: now,
    timeline: [...(item.timeline || []), { event: 'Admin Review', at: now, actor: actor.email }],
  } : item)
  write(DISPUTE_KEY, updated)
  const escrow = findEscrow(dispute.escrowRecordId)
  if (escrow) {
    saveEscrow({ ...escrow, status: 'DISPUTED', disputeStatus: 'UNDER_REVIEW', updatedAt: now })
    updateTransaction(escrow.transactionRecordId, { status: 'ADMIN_REVIEW', disputeStatus: 'UNDER_REVIEW' })
  }
  return delay(updated.find((item) => item.id === disputeId))
}

export async function resolveDisputeRecord(disputeId, actor, outcome) {
  requireAdmin(actor)
  const dispute = read(DISPUTE_KEY).find((item) => item.id === disputeId)
  if (!dispute) throw new Error('Dispute was not found.')
  return resolveDispute(dispute.escrowRecordId, actor, outcome)
}

export async function adminReviewEscrow(escrowId, actor, status, note = '') {
  requireAdmin(actor)
  const escrow = findEscrow(escrowId)
  if (!escrow) throw new Error('Escrow was not found.')
  if (status === 'UNDER_REVIEW' && escrow.status === 'EXPIRED') {
    const now = new Date().toISOString()
    const updated = { ...escrow, reviewStatus: 'UNDER_REVIEW', reviewNote: String(note).slice(0, 500), updatedAt: now }
    saveEscrow(updated)
    updateTransaction(escrow.transactionRecordId, { status: 'ADMIN_REVIEW', reviewStatus: 'UNDER_REVIEW' })
    return delay(updated)
  }
  if (status === 'UNDER_REVIEW') return requestMoreInformation(escrowId, actor, note)
  if (status === 'RELEASED') return releaseEscrow(escrowId, actor)
  if (status === 'REFUNDED') return refundEscrow(escrowId, actor)
  if (status === 'CANCELLED') return cancelEscrow(escrowId, actor)
  if (status === 'EXPIRED') return expireEscrow(escrowId, actor)
  throw new Error('Unsupported escrow review action.')
}

export async function adminOpenDispute(escrowId, actor, message = '') {
  requireAdmin(actor)
  const escrow = findEscrow(escrowId)
  if (!escrow) throw new Error('Escrow was not found.')
  if (!['FUNDS_SECURED', 'CARD_LOCKED', 'BUYER_REVIEW'].includes(escrow.status) || escrow.disputeId) throw new Error('A dispute cannot be opened at this escrow stage.')
  const now = new Date().toISOString()
  const dispute = {
    id: `dsp-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    disputeId: makeReference('DSP'), escrowId: escrow.escrowId, escrowRecordId: escrow.id,
    transactionId: escrow.transactionId, transactionRecordId: escrow.transactionRecordId,
    listingId: escrow.listingId, buyerId: escrow.buyerId, buyerName: escrow.buyerName,
    sellerId: escrow.sellerId, sellerName: escrow.sellerName, brand: escrow.brand,
    currency: escrow.currency, amount: escrow.amount, reason: 'Admin Review',
    description: String(message || 'Escalated to prototype dispute review by admin.').trim(),
    evidenceCount: 0, status: 'OPEN', createdAt: now, updatedAt: now,
    timeline: [{ event: 'Admin Review', at: now, actor: actor.email }],
  }
  write(DISPUTE_KEY, [dispute, ...read(DISPUTE_KEY)])
  saveEscrow({ ...escrow, status: 'DISPUTED', disputeStatus: 'OPEN', disputeId: dispute.id, updatedAt: now })
  updateTransaction(escrow.transactionRecordId, { status: 'DISPUTED', disputeStatus: 'OPEN' })
  return delay(dispute)
}
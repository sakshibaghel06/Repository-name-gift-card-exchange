import { createEscrow, rollbackEscrowCreation } from './escrowService'

const STORAGE_KEYS = {
  listings: 'giftly-trading-listings',
  auctions: 'giftly-trading-auctions',
  bids: 'giftly-trading-bids',
  transactions: 'giftly-trading-transactions',
}

const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 90))
const read = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] }
}
const write = (key, records) => {
  localStorage.setItem(key, JSON.stringify(records))
  window.dispatchEvent(new CustomEvent('giftly-trading-change'))
  return records
}
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`
const transactionReference = () => `GX-TX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

export const calculateFee = (faceValue, rate = 0.05) => {
  const fee = Math.round(Number(faceValue || 0) * rate * 100) / 100
  return { fee, estimatedPayout: Math.max(0, Math.round((Number(faceValue || 0) - fee) * 100) / 100), rate }
}

function safeTradingCard(record) {
  return {
    giftCardVerificationId: record.id,
    brand: record.brand,
    country: record.country,
    currency: record.currency,
    maskedCardNumber: record.maskedCardNumber,
    faceValue: Number(record.mockBalance || 0),
    verificationStatus: record.verificationStatus,
    balanceStatus: record.balanceStatus,
    sellerVerified: true,
  }
}

function assertVerified(record) {
  if (!record || record.verificationStatus !== 'SUCCESSFUL' || record.balanceStatus !== 'VERIFIED') {
    throw new Error('A successfully verified gift card is required for trading.')
  }
}

  function assertCardAvailableForTrading(verificationId) {
    const listingUsesCard = read(STORAGE_KEYS.listings).some((listing) => listing.giftCardVerificationId === verificationId && ['ACTIVE', 'IN_ESCROW', 'SOLD', 'REFUNDED', 'COMPLETED'].includes(listing.status))
    const auctionUsesCard = read(STORAGE_KEYS.auctions).some((auction) => auction.giftCardVerificationId === verificationId && (auction.status === 'LIVE' || auction.status === 'ENDED' && auction.bidCount > 0))
    const cashoutPending = read(STORAGE_KEYS.transactions).some((transaction) => transaction.giftCardVerificationId === verificationId && transaction.method === 'instant' && !['CANCELLED', 'FAILED', 'REFUNDED'].includes(transaction.status))
    if (listingUsesCard || auctionUsesCard || cashoutPending) throw new Error('This verified gift card is already listed, locked in escrow, sold, or committed to another transaction.')
  }

export async function createInstantCashout({ verification, user, payoutMethod }) {
  assertVerified(verification)
  assertCardAvailableForTrading(verification.id)
  const card = safeTradingCard(verification)
  const { fee, estimatedPayout } = calculateFee(card.faceValue)
  const transaction = {
    id: makeId('txn'), transactionId: transactionReference(), userId: user.email,
    userName: user.name, giftCardVerificationId: verification.id, method: 'instant',
    type: 'Instant Cash-Out', brand: card.brand, currency: card.currency,
    faceValue: card.faceValue, fee, estimatedPayout, payoutMethod,
    status: 'PROCESSING', createdAt: new Date().toISOString(),
  }
  write(STORAGE_KEYS.transactions, [transaction, ...read(STORAGE_KEYS.transactions)])
  return delay(transaction)
}

export async function createP2PListing({ verification, user, askingPrice, minimumPrice, duration, description }) {
  assertVerified(verification)
    assertCardAvailableForTrading(verification.id)
  const card = safeTradingCard(verification)
  const price = Number(askingPrice)
  if (!Number.isFinite(price) || price <= 0 || price > card.faceValue) throw new Error('Enter a selling price above zero and no higher than the verified balance.')
  const discountPercent = Math.round((1 - price / card.faceValue) * 10000) / 100
  const createdAt = new Date()
  const listing = {
    id: makeId('lst'), sellerId: user.email, sellerName: user.name,
    ...card, faceValue: card.faceValue, askingPrice: price,
    minimumPrice: Math.min(Number(minimumPrice) || price, price), discountPercent,
    description: String(description || '').trim(), sellerVerified: true,
    status: 'ACTIVE', durationDays: Number(duration), createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + Number(duration) * 86400000).toISOString(),
  }
  write(STORAGE_KEYS.listings, [listing, ...read(STORAGE_KEYS.listings)])
  return delay(listing)
}

export async function getMarketplaceListings(filters = {}) {
  const now = Date.now()
  const storedListings = read(STORAGE_KEYS.listings)
  let changed = false
  let listings = storedListings.map((listing) => {
    if (listing.status === 'ACTIVE' && new Date(listing.expiresAt).getTime() <= now) {
      changed = true
      return { ...listing, status: 'EXPIRED' }
    }
    return listing
  })
  if (changed) write(STORAGE_KEYS.listings, listings)
  listings = listings.filter((listing) => listing.status === 'ACTIVE')
  if (filters.brand) listings = listings.filter((listing) => listing.brand === filters.brand)
  if (filters.country) listings = listings.filter((listing) => listing.country === filters.country)
  if (filters.currency) listings = listings.filter((listing) => listing.currency === filters.currency)
  if (filters.verifiedOnly) listings = listings.filter((listing) => listing.sellerVerified)
  if (Number(filters.minPrice)) listings = listings.filter((listing) => listing.askingPrice >= Number(filters.minPrice))
  if (Number(filters.maxPrice)) listings = listings.filter((listing) => listing.askingPrice <= Number(filters.maxPrice))
  if (Number(filters.minDiscount)) listings = listings.filter((listing) => listing.discountPercent >= Number(filters.minDiscount))
  if (filters.sort === 'price-low') listings.sort((a, b) => a.askingPrice - b.askingPrice)
  else if (filters.sort === 'price-high') listings.sort((a, b) => b.askingPrice - a.askingPrice)
  else if (filters.sort === 'discount') listings.sort((a, b) => b.discountPercent - a.discountPercent)
  else listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return delay(listings)
}

export async function purchaseListing({ listing, buyer }) {
  if (!buyer?.email) throw new Error('Sign in before purchasing a listing.')
  const storedListing = read(STORAGE_KEYS.listings).find((item) => item.id === listing?.id)
  if (!listing || !storedListing || storedListing.status !== 'ACTIVE') throw new Error('This listing is no longer available.')
  if (listing.sellerId === buyer.email) throw new Error('You cannot buy your own listing.')
  const transaction = {
    id: makeId('txn'), transactionId: transactionReference(), userId: buyer.email,
    userName: buyer.name, sellerId: storedListing.sellerId, listingId: storedListing.id,
    giftCardVerificationId: storedListing.giftCardVerificationId, method: 'p2p',
    type: 'P2P Purchase', brand: storedListing.brand, currency: storedListing.currency,
    faceValue: storedListing.faceValue, fee: 0, estimatedPayout: storedListing.askingPrice,
    amount: storedListing.askingPrice, status: 'ESCROW', createdAt: new Date().toISOString(),
  }
  write(STORAGE_KEYS.transactions, [transaction, ...read(STORAGE_KEYS.transactions)])
  let escrow
  try {
    escrow = await createEscrow({ transaction, listing: storedListing, buyer })
  } catch (error) {
    rollbackEscrowCreation(transaction, buyer)
    throw error
  }
  return delay({ ...transaction, status: 'CARD_LOCKED', escrowId: escrow.escrowId, escrowRecordId: escrow.id, escrowStatus: escrow.status, paymentStatus: escrow.paymentStatus })
}

export async function createAuction({ verification, user, startingBid, minimumBid, duration, description }) {
  assertVerified(verification)
    assertCardAvailableForTrading(verification.id)
  const card = safeTradingCard(verification)
  const bid = Number(startingBid)
  if (!Number.isFinite(bid) || bid <= 0 || bid > card.faceValue) throw new Error('Starting bid must be above zero and no higher than the verified balance.')
  const createdAt = new Date()
  const auction = {
    id: makeId('auc'), sellerId: user.email, sellerName: user.name,
    ...card, startingBid: bid, currentBid: bid,
    minimumBid: Math.max(Number(minimumBid) || bid, bid + 1),
    highestBidderId: '', bidCount: 0, status: 'LIVE',
    description: String(description || '').trim(), durationHours: Number(duration),
    createdAt: createdAt.toISOString(), endsAt: new Date(createdAt.getTime() + Number(duration) * 3600000).toISOString(),
  }
  write(STORAGE_KEYS.auctions, [auction, ...read(STORAGE_KEYS.auctions)])
  return delay(auction)
}

export async function getActiveAuctions() {
  const now = Date.now()
  let changed = false
  const auctions = read(STORAGE_KEYS.auctions).map((auction) => {
    if (auction.status === 'LIVE' && new Date(auction.endsAt).getTime() <= now) {
      changed = true
      return { ...auction, status: 'ENDED', endedAt: new Date().toISOString() }
    }
    return auction
  })
  if (changed) {
    write(STORAGE_KEYS.auctions, auctions)
    const transactions = read(STORAGE_KEYS.transactions)
    const settlements = auctions.filter((auction) => auction.status === 'ENDED' && auction.highestBidderId && !transactions.some((item) => item.auctionId === auction.id && item.method === 'auction'))
      .map((auction) => ({
        id: makeId('txn'), transactionId: transactionReference(), userId: auction.sellerId,
        userName: auction.sellerName, sellerId: auction.sellerId, buyerId: auction.highestBidderId,
        auctionId: auction.id, giftCardVerificationId: auction.giftCardVerificationId,
        method: 'auction', type: 'Auction Settlement', brand: auction.brand,
        currency: auction.currency, faceValue: auction.faceValue, fee: 0,
        estimatedPayout: auction.currentBid, amount: auction.currentBid,
        status: 'AWAITING_SETTLEMENT', createdAt: new Date().toISOString(),
      }))
    if (settlements.length) write(STORAGE_KEYS.transactions, [...settlements, ...transactions])
  }
  return delay(auctions.filter((auction) => ['LIVE', 'ENDED'].includes(auction.status)))
}

export async function placeBid({ auctionId, bidder, amount }) {
  const auctions = read(STORAGE_KEYS.auctions)
  const auction = auctions.find((item) => item.id === auctionId)
  if (!auction || auction.status !== 'LIVE' || new Date(auction.endsAt).getTime() <= Date.now()) throw new Error('This auction has ended.')
  if (auction.sellerId === bidder.email) throw new Error('You cannot bid on your own auction.')
  const bidAmount = Number(amount)
  const minimum = Math.max(Number(auction.minimumBid), Number(auction.currentBid) + 1)
  if (!Number.isFinite(bidAmount) || bidAmount < minimum) throw new Error(`Your bid must be at least ${auction.currency} ${minimum}.`)
  const bid = { id: makeId('bid'), auctionId, bidderId: bidder.email, amount: bidAmount, createdAt: new Date().toISOString() }
  write(STORAGE_KEYS.bids, [bid, ...read(STORAGE_KEYS.bids)])
  write(STORAGE_KEYS.auctions, auctions.map((item) => item.id === auctionId ? { ...item, currentBid: bidAmount, highestBidderId: bidder.email, bidCount: item.bidCount + 1, minimumBid: bidAmount + 1 } : item))
  return delay(bid)
}

export async function getMyListings(userId) {
  return delay([
    ...read(STORAGE_KEYS.transactions).filter((transaction) => transaction.userId === userId && transaction.method === 'instant').map((transaction) => ({ ...transaction, kind: 'Instant Cash-Out', brand: transaction.brand, amount: transaction.estimatedPayout })),
    ...read(STORAGE_KEYS.listings).filter((listing) => listing.sellerId === userId).map((listing) => ({ ...listing, kind: 'P2P Listing', amount: listing.askingPrice })),
    ...read(STORAGE_KEYS.auctions).filter((auction) => auction.sellerId === userId).map((auction) => ({ ...auction, kind: 'Auction', amount: auction.currentBid })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
}

export async function getMyBids(userId) {
  const bids = read(STORAGE_KEYS.bids).filter((bid) => bid.bidderId === userId)
  const auctions = read(STORAGE_KEYS.auctions)
  const latest = new Map()
  for (const bid of bids) {
    const existing = latest.get(bid.auctionId)
    if (!existing || new Date(existing.createdAt) < new Date(bid.createdAt)) latest.set(bid.auctionId, bid)
  }
  return delay([...latest.values()].map((bid) => {
    const auction = auctions.find((item) => item.id === bid.auctionId)
    if (!auction) return null
    const status = auction.status === 'LIVE' ? auction.highestBidderId === userId ? 'Leading' : 'Outbid' : auction.highestBidderId === userId ? 'Won' : 'Lost'
    return { ...bid, auction, status }
  }).filter(Boolean))
}

export async function getTransactions(userId) {
  const transactions = read(STORAGE_KEYS.transactions)
  return delay(userId ? transactions.filter((transaction) => transaction.userId === userId || transaction.sellerId === userId || transaction.buyerId === userId) : transactions)
}

export async function getTransactionById(id, userId) {
  const transaction = read(STORAGE_KEYS.transactions).find((item) => item.id === id || item.transactionId === id)
  return delay(transaction && (!userId || transaction.userId === userId || transaction.sellerId === userId || transaction.buyerId === userId) ? transaction : null)
}

export async function cancelListing(id, userId) {
  const listings = read(STORAGE_KEYS.listings)
  const target = listings.find((listing) => listing.id === id && (!userId || listing.sellerId === userId))
  if (!target || target.status !== 'ACTIVE') throw new Error('This listing can no longer be cancelled.')
  const updated = { ...target, status: 'CANCELLED', cancelledAt: new Date().toISOString() }
  write(STORAGE_KEYS.listings, listings.map((listing) => listing.id === id ? updated : listing))
  return delay(updated)
}

export async function cancelAuction(id, userId) {
  const auctions = read(STORAGE_KEYS.auctions)
  const target = auctions.find((auction) => auction.id === id && (!userId || auction.sellerId === userId))
  if (!target || target.status !== 'LIVE' || target.bidCount > 0) throw new Error('This auction can no longer be cancelled.')
  const updated = { ...target, status: 'CANCELLED', cancelledAt: new Date().toISOString() }
  write(STORAGE_KEYS.auctions, auctions.map((auction) => auction.id === id ? updated : auction))
  return delay(updated)
}

export async function getBidsByAuction(auctionId) {
  const masked = read(STORAGE_KEYS.bids).filter((bid) => bid.auctionId === auctionId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((bid) => ({ ...bid, bidderLabel: `Bidder #${String(bid.bidderId).replace(/[^a-z\d]/gi, '').slice(-4).toUpperCase() || 'GIFT'}` }))
  return delay(masked)
}

export async function getAdminTradingData() {
  return delay({ listings: read(STORAGE_KEYS.listings), auctions: read(STORAGE_KEYS.auctions), transactions: read(STORAGE_KEYS.transactions) })
}

export async function adminUpdateRecord(type, id, changes) {
  const key = type === 'listing' ? STORAGE_KEYS.listings : type === 'auction' ? STORAGE_KEYS.auctions : STORAGE_KEYS.transactions
  const records = read(key)
  const updated = records.map((record) => record.id === id ? { ...record, ...changes, updatedAt: new Date().toISOString() } : record)
  write(key, updated)
  return delay(updated.find((record) => record.id === id) || null)
}
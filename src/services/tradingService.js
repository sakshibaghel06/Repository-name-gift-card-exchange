import { supabase } from '../lib/supabase'
import { recordLinkedTransaction, SUPPORTED_CURRENCIES } from './walletService'

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
const PURCHASE_TRANSACTION_SELECT = `
  id, user_id, order_id, type, amount, currency, status, metadata, created_at,
  order:orders!transactions_order_id_fkey(id, listing_id, status, payment_secured_at)
`
const MY_P2P_LISTINGS_SELECT = `
  id, seller_id, inventory_id, listing_type, asking_price, currency, status, created_at, updated_at,
  seller:profiles!listings_seller_id_fkey(full_name, email),
  inventory:gift_card_inventory!listings_inventory_id_fkey(
    id, verification_id, masked_card_number, currency,
    gift_card:gift_cards!gift_card_inventory_gift_card_id_fkey(id, title, description, image_url, country, currency, denomination, discount_percent),
    verification:gift_card_verifications!gift_card_inventory_verification_id_fkey(id, brand, country, currency, masked_card_number, verification_status, balance_status, mock_balance)
  )
`

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

export async function createDevelopmentTestListing(user) {
  if (!import.meta.env.DEV) {
    throw new Error('Test listings are available only in development builds.')
  }
  if (!user?.id) {
    throw new Error('A signed-in user with a valid profile id is required to create a test listing.')
  }

  const { data: giftCard, error: catalogError } = await supabase
    .from('gift_cards')
    .select('id')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (catalogError) throw catalogError
  if (!giftCard) throw new Error('No active gift card catalog record is available.')

  const { data: inventory, error: inventoryError } = await supabase
    .from('gift_card_inventory')
    .insert({
      gift_card_id: giftCard.id,
      seller_id: user.id,
      status: 'pending',
      sale_price: 100,
      currency: 'INR',
      masked_card_number: 'TEST-****-0100',
      verification_id: null,
    })
    .select('id')
    .single()

  if (inventoryError) throw inventoryError

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      inventory_id: inventory.id,
      seller_id: user.id,
      listing_type: 'fixed_price',
      asking_price: 100,
      currency: 'INR',
      status: 'active',
    })
    .select('id')
    .single()

  if (listingError) {
    await supabase.from('gift_card_inventory').delete().eq('id', inventory.id)
    throw listingError
  }

  window.dispatchEvent(new CustomEvent('giftly-trading-change'))
  return listing
}

export async function createP2PListing({ verification, user, askingPrice, minimumPrice, duration, description }) {
  assertVerified(verification)

  if (!user?.id) {
    throw new Error('A signed-in user with a valid profile id is required to create a listing.')
  }

  const faceValue = Number(verification.mockBalance ?? verification.faceValue ?? 0)
  const price = Number(askingPrice)

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Enter a selling price above zero.')
  }
  if (!Number.isFinite(faceValue) || faceValue <= 0) {
    throw new Error('The verified card has no usable face value.')
  }
  if (price > faceValue) {
    throw new Error('Enter a selling price no higher than the verified card balance.')
  }

  const duplicateQuery = supabase
    .from('gift_card_inventory')
    .select('id, status, verification_id')
    .eq('verification_id', verification.id)
    .in('status', ['pending', 'available', 'reserved', 'sold', 'disabled'])
    .limit(1)

  const { data: duplicateInventory, error: duplicateError } = await duplicateQuery
  if (duplicateError) throw duplicateError
  if (duplicateInventory && duplicateInventory.length > 0) {
    throw new Error('This verified gift card is already listed or committed to another transaction.')
  }

  let catalogQuery = supabase
    .from('gift_cards')
    .select('id, brand_id, title, description, image_url, country, currency, denomination, discount_percent, status')

  if (verification.gift_card_id) {
    catalogQuery = catalogQuery.eq('id', verification.gift_card_id)
  } else {
    if (verification.country) catalogQuery = catalogQuery.eq('country', verification.country)
    if (verification.currency) catalogQuery = catalogQuery.eq('currency', verification.currency)
  }

  const { data: catalogCards, error: catalogError } = await catalogQuery.limit(1)

  if (catalogError) throw catalogError
  const giftCard = catalogCards && catalogCards.length > 0 ? catalogCards[0] : null
  if (!giftCard) {
    throw new Error('No matching gift card catalog record was found for this verified card.')
  }

  const inventoryPayload = {
    gift_card_id: giftCard.id,
    seller_id: user.id,
    status: 'pending',
    sale_price: price,
    currency: String(giftCard.currency || verification.currency || 'USD'),
    masked_card_number: verification.maskedCardNumber || null,
    verification_id: verification.id,
  }

  const { data: inventoryRow, error: inventoryInsertError } = await supabase
    .from('gift_card_inventory')
    .insert([inventoryPayload])
    .select('id, gift_card_id, seller_id, status, sale_price, currency, masked_card_number, verification_id')
    .single()

  if (inventoryInsertError) throw inventoryInsertError

  const listingPayload = {
    inventory_id: inventoryRow.id,
    seller_id: user.id,
    listing_type: 'fixed_price',
    asking_price: price,
    currency: String(inventoryRow.currency || giftCard.currency || verification.currency || 'USD'),
    status: 'active',
  }

  const { data: listingRow, error: listingInsertError } = await supabase
    .from('listings')
    .insert([listingPayload])
    .select('id, inventory_id, seller_id, listing_type, asking_price, currency, status, created_at, updated_at')
    .single()

  if (listingInsertError) {
    await supabase.from('gift_card_inventory').delete().eq('id', inventoryRow.id)
    throw listingInsertError
  }

  const discountPercent = Number((((faceValue - price) / faceValue) * 100).toFixed(2))
  const createdAt = listingRow?.created_at || new Date().toISOString()

  return {
    id: listingRow.id,
    inventoryId: inventoryRow.id,
    sellerId: user.id,
    sellerName: user.name || user.email || 'Verified Seller',
    giftCardVerificationId: verification.id,
    giftCard: {
      id: giftCard.id,
      title: giftCard.title,
      description: giftCard.description,
      imageUrl: giftCard.image_url,
      country: giftCard.country,
      currency: giftCard.currency,
      denomination: Number(giftCard.denomination),
      discountPercent: Number(giftCard.discount_percent),
    },
    brand: verification.brand || giftCard.title || 'Gift Card',
    country: verification.country || giftCard.country || 'Unknown',
    currency: String(listingRow.currency || giftCard.currency || verification.currency || 'USD'),
    maskedCardNumber: inventoryRow.masked_card_number || verification.maskedCardNumber || '',
    faceValue,
    verificationStatus: verification.verificationStatus,
    balanceStatus: verification.balanceStatus,
    sellerVerified: true,
    askingPrice: Number(listingRow.asking_price),
    minimumPrice: Math.min(Number(minimumPrice) || price, price),
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : 0,
    description: String(description || '').trim() || giftCard.description || 'Verified gift card available for sale.',
    status: 'ACTIVE',
    listingType: listingRow.listing_type,
    durationDays: Number(duration) || 7,
    createdAt,
    expiresAt: null,
  }
}

export async function getMarketplaceListings(filters = {}) {
  const { data, error } = await supabase.rpc('get_marketplace_listings')
  if (error) throw error

  let listings = (data || []).map((row) => ({
    id: row.id,
    inventoryId: row.inventory_id,
    sellerId: row.seller_id,
    sellerName: row.seller_name || row.sellerName || 'Verified Seller',
    giftCardVerificationId: row.verification_id || row.gift_card_verification_id || null,
    giftCard: row.gift_card || (row.gift_card_id || row.title ? {
      id: row.gift_card_id,
      title: row.title,
      imageUrl: row.image_url,
      country: row.country,
      currency: row.currency,
    } : null),
    listingType: row.listing_type,
    brand: row.brand,
    country: row.country,
    currency: row.currency,
    maskedCardNumber: row.masked_card_number,
    faceValue: Number(row.face_value || 0),
    askingPrice: Number(row.asking_price || 0),
    discountPercent: Number(row.discount_percent || 0),
    minimumPrice: row.minimum_price == null ? null : Number(row.minimum_price),
    durationDays: row.duration_days == null ? null : Number(row.duration_days),
    imageUrl: row.image_url,
    title: row.title,
    description: row.description || '',
    status: String(row.status || 'active').toUpperCase(),
    verificationStatus: row.verification_status?.toUpperCase() || null,
    balanceStatus: row.balance_status?.toUpperCase() || null,
    createdAt: row.created_at,
    expiresAt: row.expires_at || null,
    sellerVerified: true,
  }))

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
  if (!buyer?.id) throw new Error('Sign in before purchasing a listing.')
  if (!listing?.id) throw new Error('A marketplace listing is required.')

  const { data, error } = await supabase.rpc('purchase_marketplace_listing', {
    p_listing_id: listing.id,
  })
  if (error) throw error

  const result = Array.isArray(data) ? data[0] : data
  if (!result) throw new Error('The purchase request did not return an order.')

  return {
    id: result.transaction_id,
    transactionId: result.transaction_id,
    orderId: result.order_id,
    userId: buyer.id,
    userName: buyer.name,
    sellerId: result.seller_id,
    sellerName: listing.sellerName,
    listingId: result.listing_id,
    giftCardVerificationId: listing.giftCardVerificationId || null,
    method: 'p2p',
    type: 'P2P Purchase',
    brand: listing.brand,
    country: listing.country,
    currency: result.currency,
    faceValue: listing.faceValue,
    maskedCardNumber: listing.maskedCardNumber,
    amount: Number(result.amount),
    status: String(result.status || 'pending').toUpperCase(),
    escrowId: result.escrow_id,
    escrowRecordId: result.escrow_id,
    escrowStatus: 'PENDING',
    paymentStatus: 'NOT_STARTED',
    createdAt: result.created_at,
  }
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

export async function getMyListings(userId, legacyUserId = userId) {
  if (!userId) return delay([])

  const { data: listingRows, error } = await supabase
    .from('listings')
    .select(MY_P2P_LISTINGS_SELECT)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const p2pListings = (listingRows || []).map((row) => {
    const inventory = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory
    const giftCard = Array.isArray(inventory?.gift_card) ? inventory.gift_card[0] : inventory?.gift_card
    const verification = Array.isArray(inventory?.verification) ? inventory.verification[0] : inventory?.verification
    const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller
    const verificationStatus = verification?.verification_status === 'verified'
      ? 'SUCCESSFUL'
      : verification?.verification_status?.toUpperCase()
    const balanceStatus = verification?.balance_status?.toUpperCase()
    const faceValue = Number(verification?.mock_balance ?? 0)
    const askingPrice = Number(row.asking_price)

    return {
      id: row.id,
      inventoryId: row.inventory_id,
      sellerId: row.seller_id,
      sellerName: seller?.full_name || seller?.email || 'Verified Seller',
      giftCardVerificationId: inventory?.verification_id || null,
      giftCard: giftCard ? {
        id: giftCard.id,
        title: giftCard.title,
        description: giftCard.description,
        imageUrl: giftCard.image_url,
        country: giftCard.country,
        currency: giftCard.currency,
        denomination: Number(giftCard.denomination),
        discountPercent: Number(giftCard.discount_percent),
      } : null,
      brand: verification?.brand || giftCard?.title || 'Gift Card',
      country: verification?.country || giftCard?.country || 'Unknown',
      currency: row.currency,
      maskedCardNumber: inventory?.masked_card_number || verification?.masked_card_number || '',
      faceValue,
      verificationStatus,
      balanceStatus,
      sellerVerified: ['SUCCESSFUL', 'VERIFIED'].includes(verificationStatus) && balanceStatus === 'VERIFIED',
      askingPrice,
      amount: askingPrice,
      minimumPrice: null,
      discountPercent: faceValue > 0 ? Number((((faceValue - askingPrice) / faceValue) * 100).toFixed(2)) : 0,
      description: giftCard?.description || 'Verified gift card available for sale.',
      status: String(row.status || '').toUpperCase(),
      listingType: row.listing_type,
      kind: 'P2P Listing',
      createdAt: row.created_at,
      expiresAt: null,
    }
  })

  return delay([
    ...read(STORAGE_KEYS.transactions).filter((transaction) => transaction.userId === legacyUserId && transaction.method === 'instant').map((transaction) => ({ ...transaction, kind: 'Instant Cash-Out', brand: transaction.brand, amount: transaction.estimatedPayout })),
    ...p2pListings,
    ...read(STORAGE_KEYS.auctions).filter((auction) => auction.sellerId === legacyUserId).map((auction) => ({ ...auction, kind: 'Auction', amount: auction.currentBid })),
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

function mapPurchaseTransaction(row, escrowByOrder = new Map(), deliveryByOrder = new Map()) {
  const order = Array.isArray(row.order) ? row.order[0] : row.order
  const metadata = row.metadata || {}
  const escrow = escrowByOrder.get(row.order_id)
  const delivery = deliveryByOrder.get(row.order_id)
  const isPayout = row.type === 'payout'

  return {
    id: row.id,
    transactionId: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    sellerId: metadata.seller_id || null,
    listingId: order?.listing_id || metadata.listing_id || null,
    giftCardVerificationId: metadata.gift_card_verification_id || null,
    method: isPayout ? 'payout' : 'p2p',
    type: isPayout ? 'Seller Payout' : 'P2P Purchase',
    brand: metadata.brand || 'Gift Card',
    country: metadata.country || null,
    currency: row.currency,
    faceValue: metadata.face_value == null ? null : Number(metadata.face_value),
    maskedCardNumber: metadata.masked_card_number || null,
    amount: Number(row.amount),
    status: String(row.status || '').toUpperCase(),
    escrowId: escrow?.id || null,
    escrowRecordId: escrow?.id || null,
    escrowStatus: escrow?.status?.toUpperCase() || null,
    orderStatus: order?.status?.toUpperCase() || null,
    paymentSecuredAt: order?.payment_secured_at || escrow?.funded_at || null,
    paymentStatus: escrow?.funded_at ? 'SIMULATED_PAID' : 'NOT_STARTED',
    deliveryStatus: delivery?.status?.toUpperCase() || (['release_pending', 'released'].includes(escrow?.status) ? 'DELIVERED' : 'PENDING'),
    deliveredAt: delivery?.delivered_at || null,
    buyerConfirmation: escrow?.status === 'released' ? 'CONFIRMED' : 'PENDING',
    databaseBacked: true,
    createdAt: row.created_at,
  }
}

async function getPurchaseTransactions(userId, transactionId) {
  if (!userId) return []

  let query = supabase.from('transactions').select(PURCHASE_TRANSACTION_SELECT).eq('user_id', userId).in('type', ['purchase', 'payout'])
  if (transactionId) query = query.eq('id', transactionId)
  else query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error

  const rows = data || []
  const orderIds = rows.map((row) => row.order_id)
  if (!orderIds.length) return []

  const { data: escrows, error: escrowError } = await supabase
    .from('escrow_transactions')
    .select('id, order_id, status, funded_at, released_at')
    .in('order_id', orderIds)
  if (escrowError) throw escrowError

  const escrowByOrder = new Map((escrows || []).map((escrow) => [escrow.order_id, escrow]))
  const { data: deliveries, error: deliveryError } = await supabase
    .from('deliveries')
    .select('order_id, status, delivered_at')
    .in('order_id', orderIds)
  if (deliveryError) throw deliveryError

  const deliveryByOrder = new Map((deliveries || []).map((delivery) => [delivery.order_id, delivery]))
  return rows.map((row) => mapPurchaseTransaction(row, escrowByOrder, deliveryByOrder))
}

export async function getTransactions(userId, legacyUserId = userId) {
  const [purchaseTransactions, legacyTransactions] = await Promise.all([
    getPurchaseTransactions(userId),
    Promise.resolve(read(STORAGE_KEYS.transactions).filter((transaction) =>
      transaction.userId === legacyUserId || transaction.sellerId === legacyUserId || transaction.buyerId === legacyUserId
    )),
  ])

  const legacyPurchaseIds = new Set(legacyTransactions.filter((item) => item.method === 'p2p').map((item) => item.listingId))
  const transactions = [
    ...purchaseTransactions.filter((item) => !legacyPurchaseIds.has(item.listingId)),
    ...legacyTransactions,
  ]
  return delay(transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
}

export async function getTransactionById(id, userId, legacyUserId = userId) {
  const legacyTransaction = read(STORAGE_KEYS.transactions).find((item) => item.id === id || item.transactionId === id)
  if (legacyTransaction && (!legacyUserId || legacyTransaction.userId === legacyUserId || legacyTransaction.sellerId === legacyUserId || legacyTransaction.buyerId === legacyUserId)) {
    return delay(legacyTransaction)
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id)) || !userId) return delay(null)
  const [transaction] = await getPurchaseTransactions(userId, id)
  return delay(transaction || null)
}

export async function cancelListing(id, userId) {
  if (!userId) throw new Error('A user id is required to cancel a listing.')

  const { data: target, error: findError } = await supabase
    .from('listings')
    .select(MY_P2P_LISTINGS_SELECT)
    .eq('id', id)
    .eq('seller_id', userId)
    .single()

  if (findError) {
    if (findError.code === 'PGRST116') throw new Error('This listing could not be found for this seller.')
    throw findError
  }

  if (!target || String(target.status).toLowerCase() !== 'active') {
    throw new Error('This listing can no longer be cancelled.')
  }

  const { data: updated, error: updateError } = await supabase
    .from('listings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('seller_id', userId)
    .eq('status', 'active')
    .select(MY_P2P_LISTINGS_SELECT)
    .single()

  if (updateError) {
    if (updateError.message?.includes('listing status are controlled fields')) {
      throw new Error('The database currently prevents sellers from changing listing status. Cancellation requires an authorized database-side lifecycle change.')
    }
    throw updateError
  }

  const inventory = Array.isArray(updated.inventory) ? updated.inventory[0] : updated.inventory
  const giftCard = Array.isArray(inventory?.gift_card) ? inventory.gift_card[0] : inventory?.gift_card
  const verification = Array.isArray(inventory?.verification) ? inventory.verification[0] : inventory?.verification
  const seller = Array.isArray(updated.seller) ? updated.seller[0] : updated.seller

  window.dispatchEvent(new CustomEvent('giftly-trading-change'))

  return {
    id: updated.id,
    inventoryId: updated.inventory_id,
    sellerId: updated.seller_id,
    sellerName: seller?.full_name || seller?.email || 'Verified Seller',
    giftCardVerificationId: inventory?.verification_id || null,
    giftCard: giftCard || null,
    brand: verification?.brand || giftCard?.title || 'Gift Card',
    country: verification?.country || giftCard?.country || 'Unknown',
    status: 'CANCELLED',
    listingType: updated.listing_type,
    askingPrice: Number(updated.asking_price || 0),
    currency: updated.currency,
    createdAt: updated.created_at,
    cancelledAt: updated.updated_at,
    expiresAt: null,
  }
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
  const existing = records.find((record) => record.id === id)
  const updated = records.map((record) => record.id === id ? { ...record, ...changes, updatedAt: new Date().toISOString() } : record)
  write(key, updated)
  const result = updated.find((record) => record.id === id) || null
  if (type === 'transaction' && existing?.method === 'instant' && existing.status !== 'COMPLETED' && result?.status === 'COMPLETED' && SUPPORTED_CURRENCIES.some(({ code }) => code === result.currency)) {
    recordLinkedTransaction({
      userId: result.userId, type: 'TRADE_CREDIT', currency: result.currency,
      amount: result.estimatedPayout, status: 'COMPLETED', relatedId: result.transactionId,
      balanceEffect: 1, description: 'Simulated instant cash-out credit; no real funds were transferred.',
    })
  }
  return delay(result)
}
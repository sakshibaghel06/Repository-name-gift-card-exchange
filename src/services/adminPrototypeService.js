import { categories, giftCards, mockExchanges, mockOrders, offers } from '../data'
import { getAdminDeliveries } from './deliveryService'
import { getAdminEscrows } from './escrowService'
import { getAdminWalletOverview, SUPPORTED_CURRENCIES } from './walletService'
import { getAdminTradingData } from './tradingService'
import { getAdminNotifications } from './notificationService'
import { getAdminVerificationRecords } from '../Verification'

const COLLECTIONS = {
  'gift-cards': ['giftly-admin-gift-cards', giftCards.map((item) => ({ ...item, active: true }))],
  categories: ['giftly-admin-categories', categories.map((item) => ({ ...item, active: true }))],
  orders: ['giftly-orders', mockOrders],
  exchanges: ['giftly-exchanges', mockExchanges],
  offers: ['giftly-admin-offers', offers.map((item) => ({ ...item, active: true }))],
}
const changed = () => window.dispatchEvent(new CustomEvent('giftly-admin-data-change'))

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value ?? fallback
  } catch { return fallback }
}

function requireAdmin(actor) {
  if (!actor?.email || actor.role !== 'admin') throw new Error('Admin access is required.')
}

export function getAdminCollection(section, actor) {
  requireAdmin(actor)
  if (section === 'users') return getAdminUsers(actor)
  if (section === 'settings') return read('giftly-admin-settings', { platformName: 'Giftly Exchange', defaultRegion: 'India', prototypeMode: true, supportedCurrencies: SUPPORTED_CURRENCIES.map(({ code }) => code) })
  const collection = COLLECTIONS[section]
  if (!collection) throw new Error('Unsupported admin section.')
  return read(collection[0], collection[1])
}

export function getAdminUsers(actor) {
  requireAdmin(actor)
  const verificationRecords = read('giftly-verification-records', {})
  const wallets = read('giftly-wallets', {})
  const cardRecords = read('giftly-card-verifications', [])
  const deliveries = read('giftly-deliveries', [])
  const notifications = read('giftly-notifications', [])
  const emails = new Set([
    ...Object.keys(verificationRecords), ...Object.keys(wallets),
    ...cardRecords.map((item) => item.userId).filter(Boolean),
    ...deliveries.flatMap((item) => [item.buyerId, item.sellerId]).filter(Boolean),
    ...notifications.map((item) => item.userId).filter(Boolean), actor.email,
  ])
  return [...emails].map((email) => ({
    id: email,
    email,
    name: email === actor.email ? actor.name : 'Giftly member',
    role: email.toLowerCase().includes('admin') ? 'admin' : 'customer',
    verificationStatus: verificationRecords[email]?.identityStatus || 'Not Started',
    accountStatus: 'Prototype metadata only',
    walletId: wallets[email]?.walletId || null,
  })).sort((a, b) => a.email.localeCompare(b.email))
}

export function saveAdminCollection(section, records, actor) {
  requireAdmin(actor)
  const collection = COLLECTIONS[section]
  if (!collection || !Array.isArray(records)) throw new Error('Unsupported collection update.')
  localStorage.setItem(collection[0], JSON.stringify(records))
  changed()
  return records
}

export function saveAdminSettings(settings, actor) {
  requireAdmin(actor)
  const safe = {
    platformName: String(settings.platformName || 'Giftly Exchange').slice(0, 80),
    defaultRegion: String(settings.defaultRegion || 'India').slice(0, 80),
    prototypeMode: true,
    supportedCurrencies: SUPPORTED_CURRENCIES.map(({ code }) => code),
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem('giftly-admin-settings', JSON.stringify(safe))
  changed()
  return safe
}

export function getAdminOperationsSnapshot(actor) {
  requireAdmin(actor)
  return Promise.all([
    getAdminEscrows(actor), getAdminTradingData(), getAdminDeliveries(actor), getAdminNotifications(actor),
  ]).then(([escrows, trading, deliveries, notifications]) => {
    const wallet = getAdminWalletOverview()
    const kyc = getAdminVerificationRecords()
    const cards = read('giftly-card-verifications', [])
    const disputes = read('giftly-disputes', [])
    const orders = read('giftly-orders', mockOrders)
    const users = getAdminUsers(actor)
    const giftCardRecords = getAdminCollection('gift-cards', actor)
    const metrics = [
      { id: 'users', label: 'Known prototype users', value: users.length, href: '/admin/users', tone: 'violet' },
      { id: 'kyc', label: 'Pending KYC', value: kyc.filter((item) => ['Pending Review', 'Requires More Information'].includes(item.status)).length, href: '/admin/verifications', tone: 'gold' },
      { id: 'gift-card-checks', label: 'Gift-card review queue', value: cards.filter((item) => ['REQUIRES REVIEW', 'PARTIALLY VERIFIED', 'PENDING'].includes(item.verificationStatus)).length, href: '/admin/gift-card-verifications', tone: 'pink' },
      { id: 'escrows', label: 'Active escrows', value: escrows.filter((item) => ['FUNDS_SECURED', 'CARD_LOCKED', 'DELIVERED', 'BUYER_REVIEW'].includes(item.status)).length, href: '/admin/escrow', tone: 'violet' },
      { id: 'disputes', label: 'Open disputes', value: disputes.filter((item) => ['OPEN', 'UNDER_REVIEW'].includes(item.status)).length, href: '/admin/disputes', tone: 'gold' },
      { id: 'fraud', label: 'Prototype risk alerts', value: cards.filter((item) => ['HIGH RISK', 'MEDIUM RISK'].includes(item.riskStatus)).length, href: '/admin/fraud', tone: 'pink' },
      { id: 'cashouts', label: 'Pending cash-outs', value: trading.transactions.filter((item) => item.method === 'instant' && ['PENDING', 'PROCESSING'].includes(item.status)).length, href: '/admin/trading', tone: 'gold' },
      { id: 'deliveries', label: 'Pending deliveries', value: deliveries.filter((item) => item.status === 'PENDING').length, href: '/admin/deliveries', tone: 'violet' },
      { id: 'p2p', label: 'Active P2P listings', value: trading.listings.filter((item) => item.status === 'ACTIVE').length, href: '/admin/trading', tone: 'pink' },
      { id: 'auctions', label: 'Active auctions', value: trading.auctions.filter((item) => item.status === 'LIVE').length, href: '/admin/trading', tone: 'gold' },
      { id: 'wallet', label: 'Wallet activity', value: wallet.transactions.length, href: '/admin/wallet', tone: 'violet' },
      { id: 'orders', label: 'Prototype orders', value: orders.length, href: '/admin/orders', tone: 'pink' },
      { id: 'gift-cards', label: 'Active catalog cards', value: giftCardRecords.filter((item) => item.active !== false).length, href: '/admin/gift-cards', tone: 'gold' },
    ]
    const recentActivity = [
      ...escrows.map((item) => ({ id: item.id, type: 'ESCROW', label: `${item.brand} escrow · ${item.status.replaceAll('_', ' ')}`, at: item.updatedAt || item.createdAt, href: `/admin/escrow/${item.id}` })),
      ...deliveries.map((item) => ({ id: item.id, type: 'DELIVERY', label: `${item.brand} delivery · ${item.status}`, at: item.viewedAt || item.deliveredAt || item.createdAt, href: '/admin/deliveries' })),
      ...trading.transactions.map((item) => ({ id: item.id, type: 'TRADE', label: `${item.type || item.method} · ${item.status}`, at: item.updatedAt || item.createdAt, href: '/admin/trading' })),
      ...wallet.transactions.map((item) => ({ id: item.id, type: 'WALLET', label: `${item.type.replaceAll('_', ' ')} · ${item.currency} · ${item.status}`, at: item.updatedAt || item.createdAt, href: '/admin/wallet' })),
      ...kyc.map((item) => ({ id: item.id, type: 'VERIFICATION', label: `Identity review · ${item.status}`, at: item.reviewedAt || item.submittedAt, href: '/admin/verifications' })),
      ...cards.map((item) => ({ id: item.id, type: 'GIFT_CARD', label: `${item.brand} check · ${item.verificationStatus}`, at: item.verifiedAt || item.submittedAt, href: '/admin/gift-card-verifications' })),
      ...notifications.map((item) => ({ id: item.notificationId, type: item.type, label: item.title, at: item.createdAt, href: item.href || '/admin/notifications' })),
    ].filter((item) => item.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8)
    return { metrics, recentActivity, generatedAt: new Date().toISOString() }
  })
}

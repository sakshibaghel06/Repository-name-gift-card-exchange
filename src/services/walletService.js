const STORAGE_KEY = 'giftly-wallets'
const EVENT_NAME = 'giftly-wallet-change'
const DEMO_RATES = { INR: 1, USD: 83, EUR: 90, GBP: 105, AED: 22.6, SGD: 62, AUD: 54, CAD: 61 }
const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
]
const DEFAULT_BALANCES = Object.fromEntries(CURRENCIES.map(({ code }) => [code, { available: 0, pending: 0 }]))
const round = (amount) => Math.round((Number(amount) + Number.EPSILON) * 100) / 100
const readAll = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
const makeId = () => `GX-WLT-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`
const requireCurrency = (currency) => {
  if (!DEMO_RATES[currency]) throw new Error('Choose a supported wallet currency.')
  return currency
}
const requireAmount = (amount) => {
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) throw new Error('Enter an amount greater than zero.')
  return round(value)
}
const requireUser = (userId) => {
  if (!userId) throw new Error('Sign in to access your wallet.')
}

function persist(wallets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets))
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

function normalizeWallet(wallet, userId) {
  return {
    walletId: wallet?.walletId || `WLT-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    userId,
    preferredCurrency: CURRENCIES.some(({ code }) => code === wallet?.preferredCurrency) ? wallet.preferredCurrency : 'INR',
    balances: Object.fromEntries(CURRENCIES.map(({ code }) => [code, {
      available: round(wallet?.balances?.[code]?.available || 0),
      pending: round(wallet?.balances?.[code]?.pending || 0),
    }])),
    transactions: Array.isArray(wallet?.transactions) ? wallet.transactions : [],
    createdAt: wallet?.createdAt || new Date().toISOString(),
  }
}

export function initializeWallet(userId) {
  requireUser(userId)
  const wallets = readAll()
  if (!wallets[userId]) {
    wallets[userId] = normalizeWallet({ balances: DEFAULT_BALANCES }, userId)
    persist(wallets)
  }
  return normalizeWallet(wallets[userId], userId)
}

export function getWallet(userId) {
  return initializeWallet(userId)
}

export function getBalances(userId) {
  return getWallet(userId).balances
}

function updateWallet(userId, updater) {
  const wallets = readAll()
  const wallet = normalizeWallet(wallets[userId], userId)
  const updated = updater(wallet)
  wallets[userId] = updated
  persist(wallets)
  return updated
}

function addTransaction(wallet, transaction) {
  return { ...wallet, transactions: [transaction, ...wallet.transactions] }
}

function makeTransaction({ type, currency, amount, status = 'COMPLETED', description, fee = 0, ...metadata }) {
  const now = new Date().toISOString()
  return {
    id: makeId(), transactionId: makeId(), type, currency, amount: round(amount), fee: round(fee),
    status, description, createdAt: now, updatedAt: now, prototype: true, ...metadata,
  }
}

export function createTransaction(userId, details) {
  requireUser(userId)
  requireCurrency(details.currency)
  const amount = requireAmount(details.amount)
  const transaction = makeTransaction({ ...details, amount })
  updateWallet(userId, (wallet) => addTransaction(wallet, transaction))
  return transaction
}

function changeBalance(userId, currency, amount, balanceKey, direction) {
  requireUser(userId)
  requireCurrency(currency)
  const value = requireAmount(amount)
  return updateWallet(userId, (wallet) => {
    const current = wallet.balances[currency][balanceKey]
    if (direction < 0 && current < value) throw new Error('Insufficient wallet balance.')
    wallet.balances[currency][balanceKey] = round(current + direction * value)
    return wallet
  })
}

export function simulateDeposit({ userId, currency, amount, paymentMethod }) {
  const value = requireAmount(amount)
  const wallet = changeBalance(userId, currency, value, 'available', 1)
  const transaction = makeTransaction({ type: 'DEPOSIT', currency, amount: value, status: 'COMPLETED', paymentMethod, description: `Simulated deposit via ${paymentMethod}.` })
  updateWallet(userId, (current) => addTransaction({ ...current, balances: wallet.balances }, transaction))
  return transaction
}

export function simulateWithdrawal({ userId, currency, amount, destinationType }) {
  const value = requireAmount(amount)
  requireCurrency(currency)
  const fee = round(value * 0.005)
  const received = round(value - fee)
  const wallet = changeBalance(userId, currency, value, 'available', -1)
  wallet.balances[currency].pending = round(wallet.balances[currency].pending + received)
  const transaction = makeTransaction({
    type: 'WITHDRAWAL', currency, amount: value, fee, receivedAmount: received,
    status: 'PROCESSING', destinationType,
    description: `Simulated withdrawal to ${destinationType}; no transfer was made.`,
  })
  updateWallet(userId, (current) => addTransaction({ ...current, balances: wallet.balances }, transaction))
  return transaction
}

export function convertCurrency({ userId, fromCurrency, toCurrency, amount }) {
  requireUser(userId)
  requireCurrency(fromCurrency)
  requireCurrency(toCurrency)
  if (fromCurrency === toCurrency) throw new Error('Choose two different currencies to convert.')
  const sourceAmount = requireAmount(amount)
  const rate = DEMO_RATES[fromCurrency] / DEMO_RATES[toCurrency]
  const grossAmount = round(sourceAmount * rate)
  const fee = round(grossAmount * 0.005)
  const receivedAmount = round(grossAmount - fee)
  const wallet = updateWallet(userId, (current) => {
    if (current.balances[fromCurrency].available < sourceAmount) throw new Error('Insufficient wallet balance.')
    current.balances[fromCurrency].available = round(current.balances[fromCurrency].available - sourceAmount)
    current.balances[toCurrency].available = round(current.balances[toCurrency].available + receivedAmount)
    return current
  })
  const transaction = makeTransaction({
    type: 'CONVERSION', currency: fromCurrency, amount: sourceAmount, fee,
    toCurrency, convertedAmount: receivedAmount, exchangeRate: rate, feeCurrency: toCurrency,
    status: 'COMPLETED', description: `Converted ${fromCurrency} to ${toCurrency} at a demo rate.`,
  })
  updateWallet(userId, (current) => addTransaction({ ...current, balances: wallet.balances }, transaction))
  return transaction
}

export function setPreferredCurrency(userId, currency) {
  requireUser(userId)
  requireCurrency(currency)
  return updateWallet(userId, (wallet) => ({ ...wallet, preferredCurrency: currency }))
}

export function getTransactions(userId) {
  return getWallet(userId).transactions
}

export function getTransaction(userId, transactionId) {
  return getTransactions(userId).find((transaction) => transaction.id === transactionId || transaction.transactionId === transactionId) || null
}

export function getExchangeRates() {
  return { baseCurrency: 'INR', rates: { ...DEMO_RATES }, label: 'DEMO / PROTOTYPE RATES', updatedAt: null }
}

export function getWalletSummary(userId, currency = getWallet(userId).preferredCurrency) {
  requireCurrency(currency)
  const wallet = getWallet(userId)
  const total = CURRENCIES.reduce((sum, { code }) => sum + wallet.balances[code].available * DEMO_RATES[code], 0) / DEMO_RATES[currency]
  return {
    totalValue: round(total), currency, supportedCurrencyCount: CURRENCIES.length,
    balances: wallet.balances, preferredCurrency: wallet.preferredCurrency,
    recentTransactions: wallet.transactions.slice(0, 5),
  }
}

export function getAdminWalletOverview() {
  const wallets = Object.values(readAll()).map((wallet) => normalizeWallet(wallet, wallet.userId))
  const balances = Object.fromEntries(CURRENCIES.map(({ code }) => [code, { available: 0, pending: 0 }]))
  const transactions = wallets.flatMap((wallet) => wallet.transactions.map((transaction) => ({ ...transaction, walletId: wallet.walletId })))
  wallets.forEach((wallet) => CURRENCIES.forEach(({ code }) => {
    balances[code].available = round(balances[code].available + wallet.balances[code].available)
    balances[code].pending = round(balances[code].pending + wallet.balances[code].pending)
  }))
  return { userCount: wallets.length, balances, transactions: transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) }
}

export function recordLinkedTransaction({ userId, type, currency, amount, status = 'COMPLETED', description, relatedId, balanceEffect = 0 }) {
  requireUser(userId)
  requireCurrency(currency)
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return null
  const existing = getTransactions(userId).find((transaction) => transaction.relatedId === relatedId && transaction.type === type)
  if (existing) return existing
  const value = round(amount)
  if (balanceEffect) changeBalance(userId, currency, value, 'available', balanceEffect)
  const transaction = makeTransaction({ type, currency, amount: value, status, description, relatedId })
  updateWallet(userId, (wallet) => addTransaction(wallet, transaction))
  return transaction
}

export { CURRENCIES as SUPPORTED_CURRENCIES, DEMO_RATES as DEMO_EXCHANGE_RATES, EVENT_NAME as WALLET_CHANGE_EVENT }
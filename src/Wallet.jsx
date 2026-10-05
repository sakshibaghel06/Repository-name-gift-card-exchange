import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpRight,
  Banknote, Check, Clock3, Info, Landmark, Search, ShieldCheck,
  Wallet as WalletIcon, X,
} from 'lucide-react'
import { useAuth, useWallet } from './contexts'
import {
  getExchangeRates, getMarketplaceCashouts, getMarketplaceEarnings, getTransaction,
  requestMarketplaceCashout, SUPPORTED_CURRENCIES,
} from './services/walletService'
import './Wallet.css'

const rates = getExchangeRates()
const number = (currency, amount) => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount) || 0) }
  catch { return `${currency} ${(Number(amount) || 0).toFixed(2)}` }
}
const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const labels = { DEPOSIT: 'Deposit', WITHDRAWAL: 'Withdrawal', CONVERSION: 'Conversion', TRADE_CREDIT: 'Trading credit', TRADE_DEBIT: 'Trading debit', ESCROW_HOLD: 'Escrow activity', ESCROW_RELEASE: 'Escrow release', REFUND: 'Refund' }

function PrototypeNotice() {
  return <div className="wallet-prototype-notice"><Info size={17} /><span>Marketplace Wallet shows sale settlements recorded in Supabase. Demo Wallet actions are simulations and do not affect marketplace funds.</span></div>
}

function WalletToast() {
  const { notification, setNotification } = useWallet()
  useEffect(() => {
    if (!notification) return undefined
    const timer = window.setTimeout(() => setNotification(''), 4200)
    return () => window.clearTimeout(timer)
  }, [notification, setNotification])
  if (!notification) return null
  const isError = /insufficient|invalid|same|error|supported|sign in/i.test(notification)
  return <div className={`wallet-toast ${isError ? 'is-error' : ''}`} role={isError ? 'alert' : 'status'}><span>{isError ? <Info size={17} /> : <Check size={17} />}{notification}</span><button onClick={() => setNotification('')} aria-label="Dismiss notification"><X size={16} /></button></div>
}

function WalletHeading({ eyebrow = 'Giftly Exchange', title, text, action }) {
  return <header className="wallet-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{text && <p>{text}</p>}</div>{action}</header>
}

function CurrencyOptions() {
  return SUPPORTED_CURRENCIES.map(({ code, name }) => <option key={code} value={code}>{code} · {name}</option>)
}

function WalletNav() {
  return <nav className="wallet-subnav" aria-label="Wallet sections">
    <Link to="/wallet"><WalletIcon size={15} /> Overview</Link>
    <Link to="/wallet/cashout"><ArrowUpRight size={15} /> Marketplace Cash-out</Link>
    <Link to="/wallet/deposit"><ArrowDownLeft size={15} /> Demo Deposit</Link>
    <Link to="/wallet/withdraw"><ArrowUpRight size={15} /> Demo Withdraw</Link>
    <Link to="/wallet/convert"><ArrowLeftRight size={15} /> Demo Convert</Link>
    <Link to="/wallet/transactions"><Clock3 size={15} /> Demo History</Link>
  </nav>
}

function WalletShell({ children }) {
  return <main className="page wallet-page"><WalletToast /><PrototypeNotice /><WalletNav />{children}</main>
}

export function WalletPage() {
  const {
    balances, selectedCurrency, setSelectedCurrency, transactions,
    marketplaceBalances, marketplaceWallets, marketplaceWalletLoading,
    marketplaceWalletError, refreshMarketplaceWallet,
  } = useWallet()
  const { user } = useAuth()
  const [marketplaceEarnings, setMarketplaceEarnings] = useState([])
  const [earningsLoading, setEarningsLoading] = useState(true)
  const [earningsError, setEarningsError] = useState('')
  const selectedMarketplaceWallet = marketplaceWallets.find((item) => item.currency === selectedCurrency)
  useEffect(() => {
    let active = true
    refreshMarketplaceWallet()
    getMarketplaceEarnings(user.id)
      .then((records) => { if (active) setMarketplaceEarnings(records) })
      .catch((error) => { if (active) setEarningsError(error.message) })
      .finally(() => { if (active) setEarningsLoading(false) })
    return () => { active = false }
  }, [user.id, refreshMarketplaceWallet])
  return <WalletShell>
    <WalletHeading eyebrow="Marketplace Wallet" title="Wallet" text="Real marketplace earnings stored in Supabase. Demo Wallet actions are separate and do not change these balances." action={<Link className="button primary" to="/wallet/deposit"><ArrowDownLeft size={16} /> Add demo funds</Link>} />
    <section className="wallet-overview">
      <div className="wallet-total"><div className="wallet-total-top"><span className="wallet-mark"><WalletIcon size={20} /></span><label>Display currency<select aria-label="Preferred wallet currency" value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value)}><CurrencyOptions /></select></label></div><p>Marketplace wallet balance · {selectedCurrency}</p><strong>{marketplaceWalletLoading ? 'Loading…' : marketplaceWalletError ? 'Unavailable' : selectedMarketplaceWallet ? number(selectedCurrency, selectedMarketplaceWallet.balance) : 'No wallet'}</strong><small>{marketplaceWalletLoading ? 'Loading your Supabase wallet balance.' : marketplaceWalletError ? marketplaceWalletError : selectedMarketplaceWallet ? `Stored ${selectedCurrency} balance · ${selectedMarketplaceWallet.status}` : `No ${selectedCurrency} marketplace wallet exists.`}</small><div className="wallet-total-links"><Link to="/wallet/cashout">Marketplace Cash-out <ArrowUpRight size={15} /></Link><Link to="/wallet/deposit">Demo Deposit <ArrowDownLeft size={15} /></Link><Link to="/wallet/withdraw">Demo Withdraw <ArrowUpRight size={15} /></Link><Link to="/wallet/convert">Demo Convert <ArrowLeftRight size={15} /></Link></div></div>
      <div className="wallet-overview-side"><div><span>Marketplace wallet ID</span><b>{marketplaceWalletLoading ? 'Loading…' : selectedMarketplaceWallet?.id || 'No wallet for selected currency'}</b></div><div><span>Currency balances</span><b>{marketplaceWalletLoading ? 'Loading…' : marketplaceWallets.length ? `${marketplaceWallets.length} wallet${marketplaceWallets.length === 1 ? '' : 's'} in Supabase` : marketplaceWalletError ? 'Unavailable' : 'No marketplace wallets yet'}</b></div><div><span>Balance source</span><b className="wallet-rate-label">SUPABASE · READ ONLY</b></div><p>Balances are displayed in their stored currency. No currency conversion is applied.</p></div>
    </section>
    <div className="wallet-section-title"><div><p className="eyebrow">Marketplace Wallet</p><h2>Marketplace balances</h2></div><span>Stored per currency in Supabase</span></div>
    {marketplaceWalletError && <p className="wallet-form-error" role="alert">Unable to load marketplace wallet balances: {marketplaceWalletError}</p>}
    <section className="wallet-currency-grid">{SUPPORTED_CURRENCIES.map((currency, index) => {
      const hasWallet = Object.prototype.hasOwnProperty.call(marketplaceBalances, currency.code)
      const marketplaceWallet = marketplaceWallets.find((item) => item.currency === currency.code)
      const value = marketplaceWalletLoading ? 'Loading…' : marketplaceWalletError ? 'Unavailable' : hasWallet ? number(currency.code, marketplaceBalances[currency.code]) : 'No wallet'
      const detail = marketplaceWalletLoading ? 'Loading balance' : marketplaceWalletError ? 'Balance unavailable' : hasWallet ? `Wallet ${marketplaceWallet.status}` : 'No marketplace wallet exists'
      return <article className={`wallet-currency-card currency-tone-${index % 4}`} key={currency.code}><div className="currency-card-heading"><span>{currency.code}</span><small>{currency.name}</small></div><strong>{value}</strong><div className="currency-card-pending"><span>Marketplace balance</span><b>{detail}</b></div></article>
    })}</section>
    <section className="wallet-recent panel"><div className="wallet-section-title"><div><p className="eyebrow">Supabase ledger · read only</p><h2>Marketplace Earnings</h2></div></div><p>Completed marketplace sale credits settled into your Giftly wallet. These database earnings are separate from the local demo wallet balance.</p>{earningsError ? <p className="wallet-form-error" role="alert">Unable to load marketplace earnings: {earningsError}</p> : earningsLoading ? <p>Loading marketplace earnings…</p> : marketplaceEarnings.length ? <div className="wallet-recent-list">{marketplaceEarnings.map((item) => <article className="wallet-transaction-row" key={item.id}><span className="transaction-type-icon type-trade_credit"><ArrowDownLeft size={17} /></span><span className="transaction-row-main"><b>Marketplace sale settlement</b><small>{item.description} · Order {item.reference_id}</small></span><span className="transaction-row-amount"><b>+{number(item.currency, item.amount)}</b><small>{dateTime(item.created_at)}</small></span></article>)}</div> : <WalletEmpty title="No marketplace earnings yet" text="Completed marketplace sale credits will appear here." />}</section>
    <section className="wallet-demo-section"><div className="wallet-section-title"><div><p className="eyebrow">Demo Wallet</p><h2>Prototype-only balances</h2></div><span>Separate from marketplace funds</span></div><p>Prototype-only balance. Deposit, Withdraw and Convert are simulations and do not affect marketplace funds.</p><section className="wallet-currency-grid">{SUPPORTED_CURRENCIES.map((currency, index) => {
      const balance = balances[currency.code] || { available: 0, pending: 0 }
      return <article className={`wallet-currency-card currency-tone-${index % 4}`} key={currency.code}><div className="currency-card-heading"><span>{currency.code}</span><small>{currency.name}</small></div><strong>{number(currency.code, balance.available)}</strong><div className="currency-card-pending"><span>Available · demo</span><b>{number(currency.code, balance.available)}</b></div><div className="currency-card-pending"><span>Pending · demo</span><b>{number(currency.code, balance.pending)}</b></div><Link to={`/wallet/convert?from=${currency.code}`}>Demo convert <ArrowRight size={14} /></Link></article>
    })}</section></section>
    <div className="wallet-lower-grid"><section className="wallet-recent panel"><div className="wallet-section-title"><div><p className="eyebrow">Demo Wallet · local history</p><h2>Demo transaction history</h2></div><Link to="/wallet/transactions">View history <ArrowRight size={15} /></Link></div>{transactions.length ? <div className="wallet-recent-list">{transactions.slice(0, 5).map((item) => <TransactionRow key={item.id} transaction={item} />)}</div> : <WalletEmpty title="No demo activity yet" text="Demo deposits, conversions, and other wallet records will show up here." />}</section>
      <aside className="wallet-quick-actions"><p className="eyebrow">Demo actions</p><h2>Demo Wallet actions</h2><Link to="/wallet/deposit"><span><ArrowDownLeft size={18} /></span><b>Demo Deposit</b><small>Simulate a wallet top-up</small><ArrowRight size={15} /></Link><Link to="/wallet/withdraw"><span><ArrowUpRight size={18} /></span><b>Demo Withdraw</b><small>Submit a simulated request</small><ArrowRight size={15} /></Link><Link to="/wallet/convert"><span><ArrowLeftRight size={18} /></span><b>Demo Convert</b><small>Move value between demo currencies</small><ArrowRight size={15} /></Link><Link to="/wallet/transactions"><span><Clock3 size={18} /></span><b>Demo transaction history</b><small>Search local prototype records</small><ArrowRight size={15} /></Link></aside>
    </div>
  </WalletShell>
}

export function MarketplaceCashoutPage() {
  const { user, authReady } = useAuth()
  const userId = user?.id
  const {
    selectedCurrency,
    marketplaceWallets, marketplaceWalletLoading, marketplaceWalletError,
    refreshMarketplaceWallet,
  } = useWallet()
  const activeWallets = marketplaceWallets.filter((wallet) => wallet.status === 'active')
  const [currency, setCurrency] = useState(selectedCurrency)
  const [amount, setAmount] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [success, setSuccess] = useState(null)
  const [cashouts, setCashouts] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [pendingRequest, setPendingRequest] = useState(null)
  const [pendingRequestLoadedFor, setPendingRequestLoadedFor] = useState('')
  const [pendingRequestStorageError, setPendingRequestStorageError] = useState('')
  const idempotencyStorageKey = userId ? `giftly-marketplace-cashout:${userId}` : ''
  const pendingRequestReady = Boolean(authReady && userId && pendingRequestLoadedFor === userId)
  const cashoutCurrency = activeWallets.some((wallet) => wallet.currency === currency)
    ? currency
    : activeWallets[0]?.currency || ''
  const selectedWallet = activeWallets.find((wallet) => wallet.currency === cashoutCurrency)
  const available = selectedWallet ? Number(selectedWallet.balance) : null
  const amountValue = Number(amount)
  const validAmount = Number.isFinite(amountValue)
    && amountValue > 0
    && Math.round(amountValue * 100) / 100 === amountValue
    && available !== null
    && amountValue <= available

  const loadCashouts = useCallback(async () => {
    if (!userId) return
    try {
      const records = await getMarketplaceCashouts(userId)
      setCashouts(records)
      setHistoryError('')
    } catch (error) {
      setHistoryError(error?.message || 'Unable to load cash-out history.')
    } finally {
      setHistoryLoading(false)
    }
  }, [userId])

  useEffect(() => {
    const timer = window.setTimeout(loadCashouts, 0)
    return () => window.clearTimeout(timer)
  }, [loadCashouts])

  useEffect(() => {
    if (!authReady || !userId || !idempotencyStorageKey) return undefined
    let active = true
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(idempotencyStorageKey)
        setPendingRequest(null)
        setCurrency(selectedCurrency)
        setAmount('')
        setRequestError('')
        setPendingRequestStorageError('')
        if (saved) {
          const request = JSON.parse(saved)
          if (
            !/^[A-Z]{3}$/.test(request?.currency || '')
            || !Number.isFinite(Number(request?.amount))
            || Number(request.amount) <= 0
            || !/^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request?.idempotencyKey || '')
          ) {
            throw new Error('A saved cash-out retry record is invalid. It cannot be safely replaced.')
          }
          setPendingRequest(request)
          setCurrency(request.currency)
          setAmount(String(request.amount))
        }
      } catch (error) {
        const message = error?.message || 'Unable to restore the saved cash-out retry key.'
        setRequestError(message)
        setPendingRequestStorageError(message)
      } finally {
        if (active) setPendingRequestLoadedFor(userId)
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [authReady, idempotencyStorageKey, selectedCurrency, userId])

  const submit = async (event) => {
    event.preventDefault()
    setRequestError('')
    setSuccess(null)
    if (!pendingRequestReady) {
      setRequestError('Preparing the saved cash-out request. Please try again in a moment.')
      return
    }
    if (pendingRequestStorageError) {
      setRequestError(pendingRequestStorageError)
      return
    }
    if (!selectedWallet || !validAmount) {
      setRequestError('Choose an active marketplace wallet and enter an amount within its available balance.')
      return
    }
    if (!globalThis.crypto?.randomUUID) {
      setRequestError('Secure cash-out request IDs are unavailable in this browser.')
      return
    }
    const fingerprint = `${cashoutCurrency}:${amountValue.toFixed(2)}`
    let request = pendingRequest
    if (request && `${request.currency}:${Number(request.amount).toFixed(2)}` !== fingerprint) {
      setRequestError('Retry the saved cash-out request without changing its currency or amount.')
      return
    }
    if (!request) {
      request = {
        currency: cashoutCurrency,
        amount: amountValue,
        idempotencyKey: globalThis.crypto.randomUUID(),
      }
    }
    try {
      localStorage.setItem(idempotencyStorageKey, JSON.stringify(request))
      setPendingRequest(request)
    } catch (error) {
      setRequestError(error?.message || 'Unable to persist a safe cash-out retry key. No request was sent.')
      return
    }

    setRequesting(true)
    let payout
    try {
      payout = await requestMarketplaceCashout({
        currency: cashoutCurrency,
        amount: amountValue,
        idempotencyKey: request.idempotencyKey,
      })
    } catch (error) {
      setRequestError(error?.message || 'Cash-out request failed. Please retry the request.')
      setRequesting(false)
      return
    }

    setSuccess(payout)
    try {
      localStorage.removeItem(idempotencyStorageKey)
      setPendingRequest(null)
      setAmount('')
    } catch {
      setRequestError('Cash-out succeeded, but the retry key could not be cleared. Retry safely with the saved request.')
    }
    await Promise.allSettled([refreshMarketplaceWallet(), loadCashouts()])
    setRequesting(false)
  }

  return <WalletShell>
    <Link className="wallet-back-link" to="/wallet"><ArrowLeft size={15} /> Marketplace Wallet</Link>
    <WalletHeading eyebrow="Marketplace Wallet" title="Marketplace Cash-out" text="Request a simulated cash-out from your Supabase marketplace balance. No real funds are transferred." />
    <div className="wallet-action-layout">
      <form className="wallet-form-panel panel" onSubmit={submit}>
        <h2>Cash-out request</h2>
        {marketplaceWalletError && <p className="wallet-form-error" role="alert">Unable to load marketplace wallets: {marketplaceWalletError}</p>}
        {marketplaceWalletLoading
          ? <p>Loading marketplace wallets…</p>
          : activeWallets.length
            ? <>
              <label>Currency<select value={cashoutCurrency} disabled={Boolean(pendingRequest)} onChange={(event) => setCurrency(event.target.value)}>{activeWallets.map((wallet) => <option key={wallet.id} value={wallet.currency}>{wallet.currency}</option>)}</select></label>
              <p className="wallet-available-hint">Available <b>{selectedWallet ? number(cashoutCurrency, available) : 'Select an active wallet'}</b></p>
              <label>Amount<input type="number" min="0.01" max={available ?? undefined} step="0.01" required disabled={Boolean(pendingRequest)} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label>
              <div className="wallet-withdraw-breakdown">
                <div><span>Fee</span><b>{number(cashoutCurrency, 0)}</b></div>
                <div><span>You receive</span><b>{number(cashoutCurrency, validAmount ? amountValue : 0)}</b></div>
              </div>
              {!validAmount && amount && <p className="wallet-form-error" role="alert">Enter an amount greater than zero, with up to two decimal places, not exceeding the available balance.</p>}
            </>
            : <p>{marketplaceWalletError ? 'Wallet availability could not be verified.' : 'No active marketplace wallet is available for cash-out.'}</p>}
        {requestError && <p className="wallet-form-error" role="alert">{requestError}</p>}
        <button className="button primary" type="submit" disabled={requesting || !pendingRequestReady || Boolean(pendingRequestStorageError) || marketplaceWalletLoading || !selectedWallet || !validAmount}>
          <ArrowUpRight size={16} />{requesting ? 'Submitting request…' : pendingRequest ? 'Retry Cash-out Request' : 'Request Cash-out'}
        </button>
        <p>Marketplace cash-outs are simulated in this prototype. No real funds are transferred.</p>
        {success && <div className="wallet-success" role="status"><Check size={18} /><span><b>Cash-out request · {success.status}</b><small>Payout ID · {success.payout_id}</small></span></div>}
      </form>
      <WalletSideNote title="Simulated cash-out" text="A successful request reserves its amount from your marketplace wallet and remains pending. No bank, UPI, crypto, or external payout service is connected." />
    </div>
    <section className="wallet-recent panel">
      <div className="wallet-section-title"><div><p className="eyebrow">Supabase · read only</p><h2>Marketplace Cash-out History</h2></div></div>
      {historyError ? <p className="wallet-form-error" role="alert">Unable to load cash-out history: {historyError}</p>
        : historyLoading ? <p>Loading cash-out requests…</p>
          : cashouts.length ? <div className="wallet-recent-list">{cashouts.map((payout) => <article className="wallet-transaction-row" key={payout.id}>
            <span className="transaction-type-icon type-withdrawal"><ArrowUpRight size={17} /></span>
            <span className="transaction-row-main"><b>{number(payout.currency, payout.amount)} · {payout.status}</b><small>{dateTime(payout.requested_at)} · {payout.provider || 'giftly_demo'}</small></span>
            <span className="transaction-row-amount"><b>{payout.provider_reference || payout.id}</b><small>Payout reference</small></span>
          </article>)}</div>
            : <WalletEmpty title="No marketplace cash-outs yet" text="Your simulated marketplace cash-out requests will appear here." />}
    </section>
  </WalletShell>
}

function WalletEmpty({ title, text }) {
  return <div className="wallet-empty"><span><WalletIcon size={23} /></span><h3>{title}</h3><p>{text}</p></div>
}

function TransactionRow({ transaction }) {
  const icon = transaction.type === 'DEPOSIT' ? ArrowDownLeft : transaction.type === 'WITHDRAWAL' ? ArrowUpRight : transaction.type === 'CONVERSION' ? ArrowLeftRight : Banknote
  const Icon = icon
  const displayedAmount = transaction.type === 'CONVERSION' ? transaction.amount : transaction.amount
  return <Link className="wallet-transaction-row" to={`/wallet/transactions/${transaction.id}`}><span className={`transaction-type-icon type-${transaction.type.toLowerCase()}`}><Icon size={17} /></span><span className="transaction-row-main"><b>{labels[transaction.type] || transaction.type.replaceAll('_', ' ')}</b><small>{transaction.description}</small></span><span className="transaction-row-amount"><b>{number(transaction.currency, displayedAmount)}</b><small>{dateTime(transaction.createdAt)}</small></span><span className={`wallet-status status-${transaction.status.toLowerCase()}`}>{transaction.status}</span><ArrowRight className="transaction-row-arrow" size={15} /></Link>
}

export function WalletDepositPage() {
  const { deposit, balances } = useWallet()
  const [currency, setCurrency] = useState('INR')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI Demo')
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')
  const submit = (event) => {
    event.preventDefault(); setError(''); setSuccess(null)
    if (!window.confirm(`Simulate adding ${number(currency, amount)} to your ${currency} demo wallet? No real payment will be collected.`)) return
    try { setSuccess(deposit({ currency, amount, paymentMethod })) ; setAmount('') } catch (issue) { setError(issue.message) }
  }
  return <WalletShell><Link className="wallet-back-link" to="/wallet"><ArrowLeft size={15} /> Wallet overview</Link><WalletHeading eyebrow="Demo Wallet · simulated top-up" title="Demo Deposit" text="Add a prototype-only balance. This simulated payment does not affect marketplace funds." />
    <div className="wallet-action-layout"><form className="wallet-form-panel panel" onSubmit={submit}><h2>Deposit details</h2><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><CurrencyOptions /></select></label><label>Amount<input type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label>Simulated payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>UPI Demo</option><option>Bank Transfer Demo</option><option>Card Demo</option><option>Digital Wallet Demo</option></select></label><p className="wallet-available-hint">Current available balance <b>{number(currency, balances[currency]?.available || 0)}</b></p>{error && <p className="wallet-form-error" role="alert">{error}</p>}<button className="button primary" type="submit"><ArrowDownLeft size={16} /> Confirm demo deposit</button>{success && <div className="wallet-success" role="status"><Check size={18} /><span><b>Deposit successful</b><small>Transaction ID · {success.transactionId}</small></span></div>}</form><WalletSideNote title="Demo payment only" text="This flow does not connect to a bank, card processor, UPI provider, or other payment service. Choose a demo method only." /></div>
  </WalletShell>
}

export function WalletWithdrawPage() {
  const { withdraw, balances } = useWallet()
  const [currency, setCurrency] = useState('INR')
  const [amount, setAmount] = useState('')
  const [destinationType, setDestinationType] = useState('Bank Account Demo')
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')
  const fee = Math.round((Number(amount) || 0) * 0.005 * 100) / 100
  const received = Math.max(0, (Number(amount) || 0) - fee)
  const submit = (event) => {
    event.preventDefault(); setError(''); setSuccess(null)
    if (!window.confirm(`Submit a simulated withdrawal of ${number(currency, amount)}? No money will be transferred.`)) return
    try { setSuccess(withdraw({ currency, amount, destinationType })); setAmount('') } catch (issue) { setError(issue.message) }
  }
  return <WalletShell><Link className="wallet-back-link" to="/wallet"><ArrowLeft size={15} /> Wallet overview</Link><WalletHeading eyebrow="Demo Wallet · simulated payout request" title="Demo Withdraw" text="Submit a prototype withdrawal request. Processing does not transfer funds or affect marketplace balances." />
    <div className="wallet-action-layout"><form className="wallet-form-panel panel" onSubmit={submit}><h2>Withdrawal details</h2><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><CurrencyOptions /></select></label><label>Amount<input type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label>Simulated destination<select value={destinationType} onChange={(event) => setDestinationType(event.target.value)}><option>Bank Account Demo</option><option>UPI Demo</option><option>Digital Wallet Demo</option></select></label><div className="wallet-withdraw-breakdown"><div><span>Available balance</span><b>{number(currency, balances[currency]?.available || 0)}</b></div><div><span>Prototype fee · 0.5%</span><b>{number(currency, fee)}</b></div><div><span>Amount received if completed</span><b>{number(currency, received)}</b></div><div className="wallet-processing-note"><Clock3 size={16} /> Status will be PROCESSING</div></div>{error && <p className="wallet-form-error" role="alert">{error}</p>}<button className="button primary" type="submit"><ArrowUpRight size={16} /> Submit demo withdrawal</button>{success && <div className="wallet-success" role="status"><Clock3 size={18} /><span><b>Withdrawal submitted · PROCESSING</b><small>Transaction ID · {success.transactionId}. No money was transferred.</small></span></div>}</form><WalletSideNote title="No destination details stored" text="A demo destination type is recorded for the ledger. This prototype never requests or stores account numbers, UPI IDs, passwords, or payment credentials." /></div>
  </WalletShell>
}

function ConversionPanel() {
  const { convert, balances } = useWallet()
  const params = new URLSearchParams(window.location.search)
  const [fromCurrency, setFromCurrency] = useState(SUPPORTED_CURRENCIES.some((item) => item.code === params.get('from')) ? params.get('from') : 'INR')
  const [toCurrency, setToCurrency] = useState(fromCurrency === 'USD' ? 'INR' : 'USD')
  const [amount, setAmount] = useState('')
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')
  const rate = rates.rates[fromCurrency] / rates.rates[toCurrency]
  const gross = Math.round((Number(amount) || 0) * rate * 100) / 100
  const fee = Math.round(gross * 0.005 * 100) / 100
  const result = Math.max(0, gross - fee)
  const switchCurrencies = () => { setFromCurrency(toCurrency); setToCurrency(fromCurrency); setSuccess(null); setError('') }
  const submit = (event) => {
    event.preventDefault(); setError(''); setSuccess(null)
    if (fromCurrency === toCurrency) { setError('Choose two different currencies to convert.'); return }
    if (Number(amount) <= 0) { setError('Enter an amount greater than zero.'); return }
    if ((balances[fromCurrency]?.available || 0) < Number(amount)) { setError('Insufficient wallet balance.'); return }
    if (!window.confirm(`Convert ${number(fromCurrency, amount)} to approximately ${number(toCurrency, result)} using demo rates?`)) return
    try { setSuccess(convert({ fromCurrency, toCurrency, amount })); setAmount('') } catch (issue) { setError(issue.message) }
  }
  return <form className="wallet-convert-panel panel" onSubmit={submit}><div className="wallet-convert-heading"><div><p className="eyebrow">Wallet exchange</p><h2>Convert currency</h2></div><span className="wallet-rate-label">DEMO RATES</span></div><div className="wallet-convert-fields"><label>From<select value={fromCurrency} onChange={(event) => setFromCurrency(event.target.value)}><CurrencyOptions /></select><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" aria-label="Amount to convert" /><small>Available · {number(fromCurrency, balances[fromCurrency]?.available || 0)}</small></label><button className="wallet-swap" type="button" onClick={switchCurrencies} aria-label="Switch currencies"><ArrowLeftRight size={18} /></button><label>To<select value={toCurrency} onChange={(event) => setToCurrency(event.target.value)}><CurrencyOptions /></select><output>{number(toCurrency, result)}</output><small>Estimated amount after 0.5% fee</small></label></div><div className="wallet-rate-details"><span>Demo exchange rate<b>1 {fromCurrency} = {number(toCurrency, rate)}</b></span><span>Prototype fee<b>{number(toCurrency, fee)} · 0.5%</b></span></div>{error && <p className="wallet-form-error" role="alert">{error}</p>}{success && <div className="wallet-success" role="status"><Check size={18} /><span><b>Conversion successful</b><small>Transaction ID · {success.transactionId}</small></span></div>}<button className="button primary" type="submit"><ArrowLeftRight size={16} /> Review conversion</button><p className="wallet-demo-rate-caption">Rates are fixed DEMO/PROTOTYPE values, not live market rates.</p></form>
}

export function WalletConvertPage() {
  return <WalletShell><Link className="wallet-back-link" to="/wallet"><ArrowLeft size={15} /> Wallet overview</Link><WalletHeading eyebrow="Demo Wallet · multi-currency simulation" title="Demo Convert" text="Convert prototype-only balances using fixed demo rates. Marketplace wallet balances are not changed." /><div className="wallet-convert-layout"><ConversionPanel /><WalletSideNote title="Transparent demo pricing" text="The prototype conversion fee is 0.5% of the estimated destination amount. The displayed rate is fixed in the wallet service and is not live." /></div></WalletShell>
}

function WalletSideNote({ title, text }) {
  return <aside className="wallet-side-note"><span><ShieldCheck size={20} /></span><h2>{title}</h2><p>{text}</p><div><Landmark size={15} /> Prototype wallet service only</div></aside>
}

export function WalletTransactionsPage() {
  const { transactions } = useWallet()
  const [typeFilter, setTypeFilter] = useState('All')
  const [currencyFilter, setCurrencyFilter] = useState('All currencies')
  const [query, setQuery] = useState('')
  const filters = ['All', 'Deposits', 'Withdrawals', 'Conversions', 'Trading', 'Escrow', 'Refunds']
  const visible = useMemo(() => transactions.filter((item) => {
    const typeMatches = typeFilter === 'All' || typeFilter === 'Deposits' && item.type === 'DEPOSIT' || typeFilter === 'Withdrawals' && item.type === 'WITHDRAWAL' || typeFilter === 'Conversions' && item.type === 'CONVERSION' || typeFilter === 'Trading' && ['TRADE_CREDIT', 'TRADE_DEBIT'].includes(item.type) || typeFilter === 'Escrow' && ['ESCROW_HOLD', 'ESCROW_RELEASE'].includes(item.type) || typeFilter === 'Refunds' && item.type === 'REFUND'
    const currencyMatches = currencyFilter === 'All currencies' || item.currency === currencyFilter || item.toCurrency === currencyFilter
    const searchMatches = `${item.transactionId} ${item.type} ${item.description} ${item.relatedId || ''}`.toLowerCase().includes(query.toLowerCase())
    return typeMatches && currencyMatches && searchMatches
  }), [transactions, typeFilter, currencyFilter, query])
  return <WalletShell><WalletHeading eyebrow="Demo Wallet · local history" title="Demo transaction history" text="A searchable history of local prototype wallet activity. Marketplace sale credits appear separately under Marketplace Earnings." /><div className="wallet-history-tools"><div className="wallet-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, type, or description" aria-label="Search transactions" /></div><label>Currency<select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}><option>All currencies</option><CurrencyOptions /></select></label></div><div className="wallet-filter-tabs" role="tablist" aria-label="Filter transaction type">{filters.map((filter) => <button key={filter} role="tab" aria-selected={typeFilter === filter} className={typeFilter === filter ? 'active' : ''} onClick={() => setTypeFilter(filter)}>{filter}</button>)}</div>{visible.length ? <div className="wallet-table-wrap"><table className="wallet-table"><thead><tr><th>Transaction</th><th>Type</th><th>Amount</th><th>Date</th><th>Status</th><th /></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><Link to={`/wallet/transactions/${item.id}`}>{item.transactionId}</Link><small>{item.description}</small></td><td>{labels[item.type] || item.type.replaceAll('_', ' ')}</td><td>{number(item.currency, item.amount)}{item.toCurrency && <small>→ {number(item.toCurrency, item.convertedAmount)}</small>}</td><td>{dateTime(item.createdAt)}</td><td><span className={`wallet-status status-${item.status.toLowerCase()}`}>{item.status}</span></td><td><Link className="wallet-table-view" to={`/wallet/transactions/${item.id}`} aria-label={`View ${item.transactionId}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div> : <WalletEmpty title="No matching transactions" text="Try another filter, or create a simulated wallet transaction." />}</WalletShell>
}

export function WalletTransactionDetailPage() {
  const { transactionId } = useParams()
  const { wallet } = useWallet()
  const transaction = wallet ? getTransaction(wallet.userId, transactionId) : null
  if (!transaction) return <WalletShell><Link className="wallet-back-link" to="/wallet/transactions"><ArrowLeft size={15} /> Transaction history</Link><WalletHeading eyebrow="Wallet ledger" title="Transaction not found" text="This transaction does not exist in your wallet ledger." /></WalletShell>
  const rows = [
    ['Transaction ID', transaction.transactionId], ['Type', labels[transaction.type] || transaction.type.replaceAll('_', ' ')],
    ['Amount', number(transaction.currency, transaction.amount)], ['Currency', transaction.currency],
    ['Status', transaction.status], ['Timestamp', dateTime(transaction.createdAt)],
    ['Description', transaction.description], ['Fee', number(transaction.feeCurrency || transaction.currency, transaction.fee)],
  ]
  if (transaction.exchangeRate) rows.push(['Demo exchange rate', `1 ${transaction.currency} = ${number(transaction.toCurrency, transaction.exchangeRate)}`])
  if (transaction.convertedAmount) rows.push(['Converted amount', number(transaction.toCurrency, transaction.convertedAmount)])
  if (transaction.receivedAmount !== undefined) rows.push(['Estimated amount received', number(transaction.currency, transaction.receivedAmount)])
  if (transaction.relatedId) rows.push(['Related order / trade / escrow reference', transaction.relatedId])
  if (transaction.paymentMethod || transaction.destinationType) rows.push(['Simulated method', transaction.paymentMethod || transaction.destinationType])
  return <WalletShell><Link className="wallet-back-link" to="/wallet/transactions"><ArrowLeft size={15} /> Transaction history</Link><WalletHeading eyebrow="Safe wallet details" title={transaction.transactionId} text="Only transaction metadata is displayed. No payment or identity credentials are stored." /><article className="wallet-detail-card panel"><div className="wallet-detail-status"><span><Banknote size={21} /></span><div><small>Wallet transaction</small><b>{labels[transaction.type] || transaction.type.replaceAll('_', ' ')}</b></div><span className={`wallet-status status-${transaction.status.toLowerCase()}`}>{transaction.status}</span></div><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="wallet-detail-prototype"><Info size={16} /> Prototype ledger record only. No real payment, transfer, or currency conversion occurred.</p></article></WalletShell>
}
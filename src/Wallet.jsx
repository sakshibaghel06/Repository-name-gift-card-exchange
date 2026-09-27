import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpRight,
  Banknote, Check, Clock3, Info, Landmark, Search, ShieldCheck,
  Wallet as WalletIcon, X,
} from 'lucide-react'
import { useWallet } from './contexts'
import {
  getExchangeRates, getTransaction, getWalletSummary, SUPPORTED_CURRENCIES,
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
  return <div className="wallet-prototype-notice"><Info size={17} /><span>Giftly Exchange Wallet is currently a prototype. No real funds are stored, transferred, or converted.</span></div>
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
    <Link to="/wallet/deposit"><ArrowDownLeft size={15} /> Deposit</Link>
    <Link to="/wallet/withdraw"><ArrowUpRight size={15} /> Withdraw</Link>
    <Link to="/wallet/convert"><ArrowLeftRight size={15} /> Convert</Link>
    <Link to="/wallet/transactions"><Clock3 size={15} /> History</Link>
  </nav>
}

function WalletShell({ children }) {
  return <main className="page wallet-page"><WalletToast /><PrototypeNotice /><WalletNav />{children}</main>
}

export function WalletPage() {
  const { wallet, balances, selectedCurrency, setSelectedCurrency, loading, transactions } = useWallet()
  const summary = wallet ? getWalletSummary(wallet.userId, selectedCurrency) : null
  return <WalletShell>
    <WalletHeading eyebrow="Your money, at a glance" title="Wallet" text="A multi-currency ledger for Giftly prototype activity." action={<Link className="button primary" to="/wallet/deposit"><ArrowDownLeft size={16} /> Add demo funds</Link>} />
    <section className="wallet-overview">
      <div className="wallet-total"><div className="wallet-total-top"><span className="wallet-mark"><WalletIcon size={20} /></span><label>Default currency<select aria-label="Preferred wallet currency" value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value)}><CurrencyOptions /></select></label></div><p>Available wallet value</p><strong>{loading ? 'Loading…' : number(selectedCurrency, summary?.totalValue || 0)}</strong><small>Equivalent total using demo exchange rates</small><div className="wallet-total-links"><Link to="/wallet/deposit">Deposit <ArrowDownLeft size={15} /></Link><Link to="/wallet/withdraw">Withdraw <ArrowUpRight size={15} /></Link><Link to="/wallet/convert">Convert <ArrowLeftRight size={15} /></Link></div></div>
      <div className="wallet-overview-side"><div><span>Wallet ID</span><b>{wallet?.walletId || 'Loading wallet…'}</b></div><div><span>Supported currencies</span><b>{SUPPORTED_CURRENCIES.length} currencies</b></div><div><span>Rate source</span><b className="wallet-rate-label">DEMO / PROTOTYPE</b></div><p>Rate card uses fixed demonstration values. It is not connected to live market pricing.</p></div>
    </section>
    <div className="wallet-section-title"><div><p className="eyebrow">Balance management</p><h2>Your currencies</h2></div><span>Available and pending balances</span></div>
    <section className="wallet-currency-grid">{SUPPORTED_CURRENCIES.map((currency, index) => {
      const balance = balances[currency.code] || { available: 0, pending: 0 }
      return <article className={`wallet-currency-card currency-tone-${index % 4}`} key={currency.code}><div className="currency-card-heading"><span>{currency.code}</span><small>{currency.name}</small></div><strong>{number(currency.code, balance.available)}</strong><div className="currency-card-pending"><span>Available</span><b>{number(currency.code, balance.available)}</b></div><div className="currency-card-pending"><span>Pending</span><b>{number(currency.code, balance.pending)}</b></div><Link to={`/wallet/convert?from=${currency.code}`}>Convert currency <ArrowRight size={14} /></Link></article>
    })}</section>
    <div className="wallet-lower-grid"><section className="wallet-recent panel"><div className="wallet-section-title"><div><p className="eyebrow">Latest activity</p><h2>Recent transactions</h2></div><Link to="/wallet/transactions">View history <ArrowRight size={15} /></Link></div>{transactions.length ? <div className="wallet-recent-list">{transactions.slice(0, 5).map((item) => <TransactionRow key={item.id} transaction={item} />)}</div> : <WalletEmpty title="No activity yet" text="Demo deposits, conversions, and other wallet records will show up here." />}</section>
      <aside className="wallet-quick-actions"><p className="eyebrow">Get started</p><h2>Quick actions</h2><Link to="/wallet/deposit"><span><ArrowDownLeft size={18} /></span><b>Deposit</b><small>Simulate a wallet top-up</small><ArrowRight size={15} /></Link><Link to="/wallet/withdraw"><span><ArrowUpRight size={18} /></span><b>Withdraw</b><small>Submit a simulated request</small><ArrowRight size={15} /></Link><Link to="/wallet/convert"><span><ArrowLeftRight size={18} /></span><b>Convert</b><small>Move value between currencies</small><ArrowRight size={15} /></Link><Link to="/wallet/transactions"><span><Clock3 size={18} /></span><b>Transaction history</b><small>Search your wallet ledger</small><ArrowRight size={15} /></Link></aside>
    </div>
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
  return <WalletShell><Link className="wallet-back-link" to="/wallet"><ArrowLeft size={15} /> Wallet overview</Link><WalletHeading eyebrow="Simulated top-up" title="Deposit" text="Add a demo balance using a simulated payment method." />
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
  return <WalletShell><Link className="wallet-back-link" to="/wallet"><ArrowLeft size={15} /> Wallet overview</Link><WalletHeading eyebrow="Simulated payout request" title="Withdraw" text="Submit a prototype withdrawal request. Processing does not transfer funds." />
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
  return <WalletShell><Link className="wallet-back-link" to="/wallet"><ArrowLeft size={15} /> Wallet overview</Link><WalletHeading eyebrow="Multi-currency wallet" title="Convert currencies" text="Preview your conversion using fixed prototype rates." /><div className="wallet-convert-layout"><ConversionPanel /><WalletSideNote title="Transparent demo pricing" text="The prototype conversion fee is 0.5% of the estimated destination amount. The displayed rate is fixed in the wallet service and is not live." /></div></WalletShell>
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
  return <WalletShell><WalletHeading eyebrow="Your wallet ledger" title="Transaction history" text="A searchable history of simulated wallet activity." /><div className="wallet-history-tools"><div className="wallet-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, type, or description" aria-label="Search transactions" /></div><label>Currency<select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}><option>All currencies</option><CurrencyOptions /></select></label></div><div className="wallet-filter-tabs" role="tablist" aria-label="Filter transaction type">{filters.map((filter) => <button key={filter} role="tab" aria-selected={typeFilter === filter} className={typeFilter === filter ? 'active' : ''} onClick={() => setTypeFilter(filter)}>{filter}</button>)}</div>{visible.length ? <div className="wallet-table-wrap"><table className="wallet-table"><thead><tr><th>Transaction</th><th>Type</th><th>Amount</th><th>Date</th><th>Status</th><th /></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><Link to={`/wallet/transactions/${item.id}`}>{item.transactionId}</Link><small>{item.description}</small></td><td>{labels[item.type] || item.type.replaceAll('_', ' ')}</td><td>{number(item.currency, item.amount)}{item.toCurrency && <small>→ {number(item.toCurrency, item.convertedAmount)}</small>}</td><td>{dateTime(item.createdAt)}</td><td><span className={`wallet-status status-${item.status.toLowerCase()}`}>{item.status}</span></td><td><Link className="wallet-table-view" to={`/wallet/transactions/${item.id}`} aria-label={`View ${item.transactionId}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div> : <WalletEmpty title="No matching transactions" text="Try another filter, or create a simulated wallet transaction." />}</WalletShell>
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
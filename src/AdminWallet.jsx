import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Info, Search, Wallet } from 'lucide-react'
import { getAdminWalletOverview, SUPPORTED_CURRENCIES, WALLET_CHANGE_EVENT, DEMO_EXCHANGE_RATES } from './services/walletService'
import { adminUpdateRecord, getAdminTradingData } from './services/tradingService'
import './AdminWallet.css'

const amount = (currency, value) => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value) || 0) }
  catch { return `${currency} ${(Number(value) || 0).toFixed(2)}` }
}

export function AdminWalletPage() {
  const [overview, setOverview] = useState(getAdminWalletOverview)
  const [cashouts, setCashouts] = useState([])
  const [actionMessage, setActionMessage] = useState('')
  const [typeFilter, setTypeFilter] = useState('All types')
  const [currencyFilter, setCurrencyFilter] = useState('All currencies')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const refresh = () => setOverview(getAdminWalletOverview())
    const refreshTrading = async () => {
      const data = await getAdminTradingData()
      setCashouts(data.transactions.filter((item) => item.method === 'instant' && item.status === 'PROCESSING'))
    }
    window.addEventListener(WALLET_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('giftly-trading-change', refreshTrading)
    refreshTrading()
    return () => {
      window.removeEventListener(WALLET_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('giftly-trading-change', refreshTrading)
    }
  }, [])

  const totalValueINR = SUPPORTED_CURRENCIES.reduce((sum, { code }) => sum + (overview.balances[code]?.available || 0) * DEMO_EXCHANGE_RATES[code], 0)
  const deposits = overview.transactions.filter((item) => item.type === 'DEPOSIT')
  const withdrawals = overview.transactions.filter((item) => item.type === 'WITHDRAWAL')
  const conversions = overview.transactions.filter((item) => item.type === 'CONVERSION')
  const pendingWithdrawals = withdrawals.filter((item) => item.status === 'PROCESSING' || item.status === 'PENDING')
  const typeOptions = ['All types', 'DEPOSIT', 'WITHDRAWAL', 'CONVERSION', 'TRADE_CREDIT', 'TRADE_DEBIT', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'REFUND']
  const rows = useMemo(() => overview.transactions.filter((item) => {
    const matchesType = typeFilter === 'All types' || item.type === typeFilter
    const matchesCurrency = currencyFilter === 'All currencies' || item.currency === currencyFilter || item.toCurrency === currencyFilter
    const matchesQuery = `${item.transactionId} ${item.type} ${item.walletId} ${item.description}`.toLowerCase().includes(query.toLowerCase())
    return matchesType && matchesCurrency && matchesQuery
  }), [overview.transactions, typeFilter, currencyFilter, query])
  const completeCashout = async (transaction) => {
    if (!window.confirm('Mark this prototype cash-out as complete and credit the Giftly demo wallet? No real funds will be transferred.')) return
    await adminUpdateRecord('transaction', transaction.id, { status: 'COMPLETED' })
    setActionMessage(`Prototype settlement completed for ${transaction.transactionId}; demo wallet credited.`)
    setOverview(getAdminWalletOverview())
    const data = await getAdminTradingData()
    setCashouts(data.transactions.filter((item) => item.method === 'instant' && item.status === 'PROCESSING'))
  }

  return <div className="admin-page admin-wallet-page"><div className="admin-heading"><div><p className="eyebrow">Wallet operations</p><h1>Digital Wallet</h1><p className="admin-verification-intro">Aggregate view of simulated customer wallet activity.</p></div><span className="admin-wallet-label"><Wallet size={15} /> Prototype ledger</span></div>
    <div className="admin-wallet-notice"><Info size={16} /><span>Prototype wallet ledger — no real funds are held or transferred.</span></div>
    <div className="admin-wallet-stats"><div><span><Wallet size={17} /></span><b>{overview.userCount}</b><small>Total wallet users</small></div><div><span><Wallet size={17} /></span><b>{amount('INR', totalValueINR)}</b><small>Total simulated value · INR equivalent</small></div><div><span><ArrowDownLeft size={17} /></span><b>{deposits.length}</b><small>Simulated deposits</small></div><div><span><ArrowUpRight size={17} /></span><b>{withdrawals.length}</b><small>Simulated withdrawals</small></div><div><span><ArrowLeftRight size={17} /></span><b>{conversions.length}</b><small>Currency conversions</small></div><div><span><ArrowUpRight size={17} /></span><b>{pendingWithdrawals.length}</b><small>Pending withdrawals</small></div><div><span><Wallet size={17} /></span><b>{overview.transactions.length}</b><small>Wallet transaction count</small></div></div>
    <section className="admin-wallet-ledger"><div className="admin-wallet-section-heading"><div><p className="eyebrow">Trading integration</p><h2>Pending instant cash-outs</h2></div><span>Complete only as a prototype simulation</span></div>{actionMessage && <p className="admin-wallet-action-message" role="status">{actionMessage}</p>}{cashouts.length ? <div className="admin-wallet-table-wrap"><table className="admin-wallet-table"><thead><tr><th>Reference</th><th>Currency</th><th>Estimated wallet credit</th><th>Status</th><th>Action</th></tr></thead><tbody>{cashouts.map((item) => <tr key={item.id}><td>{item.transactionId}</td><td>{item.currency}</td><td>{amount(item.currency, item.estimatedPayout)}</td><td><span className="admin-wallet-status status-processing">PROCESSING</span></td><td><button className="admin-wallet-complete" onClick={() => completeCashout(item)}>Complete demo settlement</button></td></tr>)}</tbody></table></div> : <div className="admin-wallet-empty">No pending instant cash-outs.</div>}</section>
    <section className="admin-wallet-distribution"><div className="admin-wallet-section-heading"><div><p className="eyebrow">Balances by currency</p><h2>Currency distribution</h2></div><span>Available balance · all wallets</span></div><div className="admin-wallet-currency-grid">{SUPPORTED_CURRENCIES.map(({ code, name }) => <article key={code}><span>{code}</span><small>{name}</small><b>{amount(code, overview.balances[code]?.available || 0)}</b><small>Pending · {amount(code, overview.balances[code]?.pending || 0)}</small></article>)}</div></section>
    <section className="admin-wallet-ledger"><div className="admin-wallet-section-heading"><div><p className="eyebrow">Recent activity</p><h2>Wallet transactions</h2></div></div><div className="admin-wallet-filters"><label className="admin-wallet-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transaction or wallet ID" /></label><label>Type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>{typeOptions.map((type) => <option key={type}>{type}</option>)}</select></label><label>Currency<select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}><option>All currencies</option>{SUPPORTED_CURRENCIES.map(({ code }) => <option key={code}>{code}</option>)}</select></label></div>
      {rows.length ? <div className="admin-wallet-table-wrap"><table className="admin-wallet-table"><thead><tr><th>Transaction ID</th><th>Wallet</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Description</th></tr></thead><tbody>{rows.map((item) => <tr key={`${item.walletId}-${item.id}`}><td>{item.transactionId}</td><td>{item.walletId}</td><td>{item.type.replaceAll('_', ' ')}</td><td>{amount(item.currency, item.amount)}{item.toCurrency && <small>→ {amount(item.toCurrency, item.convertedAmount)}</small>}</td><td><span className={`admin-wallet-status status-${item.status.toLowerCase()}`}>{item.status}</span></td><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.description}</td></tr>)}</tbody></table></div> : <div className="admin-wallet-empty">No wallet records match the selected filters.</div>}
    </section>
  </div>
}
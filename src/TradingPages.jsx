import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './contexts'
import { createNotification } from './services/notificationService'
import {
  adminUpdateRecord, cancelAuction, cancelListing, getActiveAuctions,
  getAdminTradingData, getBidsByAuction, getMarketplaceListings, getMyBids,
  getMyListings, getTransactionById, getTransactions, placeBid,
} from './services/tradingService'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Banknote, CalendarClock, CheckCircle2,
  ChevronRight, Gavel, Gift, Info, PackageCheck, Plus,
  RefreshCw, ShieldCheck, ShoppingBag, Tag, X,
} from 'lucide-react'
import './Trading.css'

const money = (currency, amount) => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount) || 0) } catch { return `${currency} ${Number(amount) || 0}` }
}
const dateText = (date) => date ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const hoursLeft = (date) => Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 3600000))

function useTradingSnapshot() {
  const [data, setData] = useState({ listings: [], auctions: [], transactions: [] })
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      await Promise.all([getMarketplaceListings(), getActiveAuctions()])
      const all = await getAdminTradingData()
      if (active) {
        for (const endedAuction of all.auctions.filter((item) => item.status === 'ENDED' && item.highestBidderId)) {
          createNotification({ userId: endedAuction.highestBidderId, type: 'AUCTION', title: 'Auction ended with your leading bid', message: `${endedAuction.brand} auction ${endedAuction.id} ended. Settlement remains a prototype workflow.`, relatedId: endedAuction.id, relatedType: 'AUCTION', href: `/auctions/${endedAuction.id}`, dedupeKey: `auction-won:${endedAuction.id}:${endedAuction.highestBidderId}` })
          createNotification({ userId: endedAuction.sellerId, type: 'AUCTION', title: 'Your auction ended', message: `${endedAuction.brand} auction ${endedAuction.id} ended. Any settlement is simulated.`, relatedId: endedAuction.id, relatedType: 'AUCTION', href: `/my-listings`, dedupeKey: `auction-ended:${endedAuction.id}` })
        }
        setData({ listings: all.listings, auctions: all.auctions, transactions: all.transactions })
        setReady(true)
      }
    }
    refresh()
    window.addEventListener('giftly-trading-change', refresh)
    return () => { active = false; window.removeEventListener('giftly-trading-change', refresh) }
  }, [])
  return { ...data, ready }
}

function Status({ value }) {
  const normalized = String(value || 'PENDING').toUpperCase().replaceAll('_', '-')
  return <span className={`trading-status status-${normalized.toLowerCase()}`}>{normalized.replaceAll('-', ' ')}</span>
}

function Header({ eyebrow, title, text, action }) {
  return <header className="trading-page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>{action}</header>
}

function Notice({ children = 'Prototype transaction — no real money, payment, escrow, or settlement is involved.' }) {
  return <div className="trading-prototype-notice"><Info size={16} /><span>{children}</span></div>
}

function TrustBadges() {
  return <span className="trading-trust-badges"><span><BadgeCheck size={13} /> Verified Seller</span><span><CheckCircle2 size={13} /> Gift Card Verified</span><span><ShieldCheck size={13} /> Balance Verified</span></span>
}

function CardSummary({ record }) {
  return <div className="trading-card-summary"><div className="trading-brand-mark"><Gift size={22} /></div><div className="trading-card-details"><b>{record.brand}</b><small>{record.country} · {record.currency}</small><span>{record.maskedCardNumber}</span></div><div className="trading-card-balance"><Status value="Verified" /><b>{money(record.currency, record.mockBalance ?? record.faceValue)}</b><small>Verified balance</small></div></div>
}

export function AuctionMarketplacePage() {
  const { auctions } = useTradingSnapshot()
  const activeAuctions = auctions.filter((auction) => ['LIVE', 'ENDED'].includes(auction.status)).sort((a, b) => new Date(a.endsAt) - new Date(b.endsAt))
  return <main className="page trading-page"><Header eyebrow="Giftly auctions" title="Live gift card auctions" text="Place a mock bid on a gift card from a verified Giftly seller." action={<Link className="button outline" to="/sell-method">Sell a Gift Card</Link>} /><Notice>Prototype bidding only. No funds are reserved, collected, or settled.</Notice><div className="auction-card-grid">{activeAuctions.map((auction) => <article className="auction-card" key={auction.id}><div className="auction-card-art"><Gavel size={24} /><Status value={auction.status} /></div><div className="auction-card-content"><p className="eyebrow">{auction.country} · {auction.currency}</p><h2>{auction.brand}</h2><p>Face value · {money(auction.currency, auction.faceValue)}</p><div className="auction-card-metrics"><span>Current highest bid<b>{money(auction.currency, auction.currentBid)}</b></span><span>Bids<b>{auction.bidCount}</b></span><span>Time remaining<b>{auction.status === 'LIVE' ? `${hoursLeft(auction.endsAt)}h` : 'Ended'}</b></span></div><div className="auction-card-bottom"><span className="seller-verified"><BadgeCheck size={13} /> Verified Seller</span><Link className="button primary" to={`/auctions/${auction.id}`}>View Auction <ChevronRight size={14} /></Link></div></div></article>)}{activeAuctions.length === 0 && <div className="trading-empty-state compact"><span><Gavel size={22} /></span><h2>No active auctions</h2><p>New auctions from verified sellers will appear here.</p><Link to="/sell-method">Start an auction</Link></div>}</div></main>
}

export function AuctionDetailPage() {
  const { auctionId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { auctions, ready } = useTradingSnapshot()
  const auction = auctions.find((item) => item.id === auctionId)
  const [bids, setBids] = useState([])
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { if (auction) getBidsByAuction(auction.id).then(setBids) }, [auction, auctions])
  if (!auction && !ready) return <main className="page trading-page"><Header eyebrow="Auction" title="Loading auction" text="Checking current auction status." /></main>
  if (!auction) return <main className="page trading-page"><Header eyebrow="Auction" title="Auction unavailable" text="This auction may have ended or is no longer available." /><Link className="button outline" to="/auctions">Browse auctions</Link></main>
  const ended = auction.status !== 'LIVE'
  const nextBid = Math.max(Number(auction.minimumBid), Number(auction.currentBid) + 1)
  const submitBid = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    if (!user) { navigate('/login'); return }
    try {
      const bid = await placeBid({ auctionId: auction.id, bidder: user, amount })
      createNotification({ userId: user.email, type: 'AUCTION', title: 'Prototype bid placed', message: `Your bid on ${auction.brand} was recorded in the local auction demo.`, relatedId: auction.id, relatedType: 'AUCTION', href: `/auctions/${auction.id}`, dedupeKey: `bidder:${bid.id}` })
      createNotification({ userId: auction.sellerId, type: 'AUCTION', title: 'New prototype bid received', message: `A bid was placed on your ${auction.brand} auction.`, relatedId: auction.id, relatedType: 'AUCTION', href: `/auctions/${auction.id}`, dedupeKey: `seller-bid:${bid.id}` })
      setAmount(''); setMessage('Your prototype bid was placed.'); setBids(await getBidsByAuction(auction.id))
    } catch (issue) { setError(issue.message) }
  }
  return <main className="page trading-page"><Link className="back-link" to="/auctions"><ArrowLeft size={15} /> Auctions</Link><Header eyebrow={`${auction.status} auction · ${auction.id}`} title={auction.brand} text={`${auction.country} · ${auction.currency}`} /><div className="auction-detail-layout"><section className="trading-panel"><CardSummary record={{ ...auction, mockBalance: auction.faceValue }} /><TrustBadges /><div className="auction-current-bid"><small>Current highest bid</small><b>{money(auction.currency, auction.currentBid)}</b><span>{auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}</span></div><div className="trading-detail-price"><span>Face value<b>{money(auction.currency, auction.faceValue)}</b></span><span>Starting bid<b>{money(auction.currency, auction.startingBid)}</b></span><span>Minimum next bid<b>{money(auction.currency, nextBid)}</b></span></div><p className="trading-description">{auction.description || 'Verified gift card available for bidding.'}</p><p className="trading-expiry"><CalendarClock size={15} /> {ended ? `Ended ${dateText(auction.endedAt || auction.endsAt)}` : `Ends ${dateText(auction.endsAt)} · ${hoursLeft(auction.endsAt)} hours remaining`}</p>{ended ? <div className="auction-ended-banner"><CheckCircle2 size={18} /><span><b>Auction Ended</b><small>Winning bid: {money(auction.currency, auction.currentBid)} · Winner: {auction.highestBidderId ? `Bidder #${auction.highestBidderId.replace(/[^a-z\d]/gi, '').slice(-4).toUpperCase()}` : 'No bids'} · Seller: Verified Giftly Seller</small><small>Any resulting transaction is Awaiting Settlement. No actual settlement occurred.</small></span></div> : <form className="auction-bid-form" onSubmit={submitBid}><label className="trading-input">Your Bid · minimum {money(auction.currency, nextBid)}<input required type="number" min={nextBid} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={String(nextBid)} /></label>{error && <p className="trading-error" role="alert">{error}</p>}{message && <p className="trading-success" role="status"><CheckCircle2 size={15} /> {message}</p>}<Notice>Mock bid only. No payment method is charged and no funds are reserved.</Notice><button className="button primary" type="submit"><Gavel size={15} /> Place Bid</button></form>}</section><aside className="trading-panel bid-history"><h2>Bid history</h2>{bids.length ? bids.map((bid) => <div className="bid-history-row" key={bid.id}><span className="bidder-avatar"><span>{bid.bidderLabel.slice(-1)}</span></span><span><b>{bid.bidderLabel}</b><small>{new Date(bid.createdAt).toLocaleString()}</small></span><strong>{money(auction.currency, bid.amount)}</strong></div>) : <p>No bids yet. Place the opening bid when you’re ready.</p>}</aside></div></main>
}

const listingStatus = (record) => record.status
export function MyListingsPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [tab, setTab] = useState('All')
  const [error, setError] = useState('')
  useEffect(() => {
    const refresh = () => getMyListings(user.email).then(setRecords)
    refresh(); window.addEventListener('giftly-trading-change', refresh)
    return () => window.removeEventListener('giftly-trading-change', refresh)
  }, [user.email])
  const tabs = ['All', 'Active', 'Pending', 'Completed', 'Expired', 'Cancelled']
  const filtered = records.filter((record) => tab === 'All' || listingStatus(record).toLowerCase() === tab.toLowerCase() || tab === 'Pending' && ['PROCESSING', 'AWAITING_SETTLEMENT', 'IN_ESCROW', 'BUYER_REVIEW', 'DISPUTED', 'ADMIN_REVIEW'].includes(listingStatus(record)))
  const cancel = async (record) => {
    setError('')
    try { if (record.kind === 'P2P Listing') await cancelListing(record.id, user.email); else if (record.kind === 'Auction') await cancelAuction(record.id, user.email); else throw new Error('This cash-out request cannot be cancelled in the prototype.') } catch (issue) { setError(issue.message) }
  }
  return <main className="page trading-page"><Header eyebrow="Your trading activity" title="My Listings" text="Track cash-out requests, marketplace listings, and auctions." action={<Link className="button primary" to="/sell-method"><Plus size={15} /> Start selling</Link>} /><div className="trading-tabs" role="tablist" aria-label="Listing status filters">{tabs.map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}<small>{item === 'All' ? records.length : records.filter((record) => listingStatus(record).toLowerCase() === item.toLowerCase()).length}</small></button>)}</div>{error && <p className="trading-error" role="alert">{error}</p>}{filtered.length ? <div className="trading-table-wrap"><table className="trading-table"><thead><tr><th>Reference ID</th><th>Type</th><th>Brand</th><th>Amount</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td>{record.transactionId || record.id}</td><td>{record.kind}</td><td>{record.brand}</td><td>{money(record.currency, record.amount)}</td><td><Status value={listingStatus(record)} /></td><td>{dateText(record.createdAt)}</td><td><Link to={record.kind === 'Auction' ? `/auctions/${record.id}` : record.kind === 'P2P Listing' ? `/marketplace/${record.id}` : `/transactions/${record.id}`}>View</Link>{['ACTIVE', 'LIVE'].includes(listingStatus(record)) && (record.kind !== 'Auction' || record.bidCount === 0) && <button onClick={() => cancel(record)}>Cancel</button>}</td></tr>)}</tbody></table></div> : <div className="trading-empty-state compact"><span><PackageCheck size={23} /></span><h2>No {tab === 'All' ? 'trading activity' : `${tab.toLowerCase()} items`}</h2><p>Your selling activity will appear here.</p><Link to="/sell-method">Choose a selling method</Link></div>}</main>
}

export function MyBidsPage() {
  const { user } = useAuth()
  const [bids, setBids] = useState([])
  useEffect(() => {
    const refresh = () => getMyBids(user.email).then(setBids)
    refresh(); window.addEventListener('giftly-trading-change', refresh)
    return () => window.removeEventListener('giftly-trading-change', refresh)
  }, [user.email])
  return <main className="page trading-page"><Header eyebrow="Your auction activity" title="My Bids" text="Follow your bids and see where you stand." />{bids.length ? <div className="trading-table-wrap"><table className="trading-table"><thead><tr><th>Auction</th><th>Brand</th><th>My highest bid</th><th>Current highest bid</th><th>Bid status</th><th>Auction</th><th /></tr></thead><tbody>{bids.map((bid) => <tr key={bid.id}><td>{bid.auction.id}</td><td>{bid.auction.brand}</td><td>{money(bid.auction.currency, bid.amount)}</td><td>{money(bid.auction.currency, bid.auction.currentBid)}</td><td><Status value={bid.status} /></td><td><Status value={bid.auction.status} /></td><td><Link to={`/auctions/${bid.auction.id}`}>View</Link></td></tr>)}</tbody></table></div> : <div className="trading-empty-state compact"><span><Gavel size={23} /></span><h2>No bids yet</h2><p>Your bids on live auctions will appear here.</p><Link to="/auctions">Browse auctions</Link></div>}</main>
}

export function TransactionsPage() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  useEffect(() => {
    const refresh = () => getTransactions(user.email).then(setTransactions)
    refresh(); window.addEventListener('giftly-trading-change', refresh)
    return () => window.removeEventListener('giftly-trading-change', refresh)
  }, [user.email])
  return <main className="page trading-page"><Header eyebrow="Your account" title="Transactions" text="A history of simulated trading activity. No real financial activity is shown." />{transactions.length ? <div className="trading-table-wrap"><table className="trading-table"><thead><tr><th>Transaction ID</th><th>Type</th><th>Brand</th><th>Amount</th><th>Currency</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td>{transaction.transactionId}</td><td>{transaction.type}</td><td>{transaction.brand}</td><td>{money(transaction.currency, transaction.amount ?? transaction.estimatedPayout)}</td><td>{transaction.currency}</td><td><Status value={transaction.status} /></td><td>{dateText(transaction.createdAt)}</td><td><Link to={`/transactions/${transaction.id}`}>View</Link></td></tr>)}</tbody></table></div> : <div className="trading-empty-state compact"><span><Banknote size={23} /></span><h2>No transactions yet</h2><p>Prototype payout and purchase records will appear here.</p><Link to="/sell-method">Start selling</Link></div>}</main>
}

export function TransactionDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [transaction, setTransaction] = useState(null)
  useEffect(() => { getTransactionById(id, user.email).then(setTransaction) }, [id, user.email])
  if (!transaction) return <main className="page trading-page"><Header eyebrow="Transaction" title="Transaction not found" text="This transaction may not belong to your account." /><Link to="/transactions">Back to transactions</Link></main>
  const rows = [['Transaction ID', transaction.transactionId], ['Type', transaction.type], ['Brand', transaction.brand], ['Currency', transaction.currency], ['Amount', money(transaction.currency, transaction.amount ?? transaction.estimatedPayout)], ['Card balance', money(transaction.currency, transaction.faceValue)], ['Prototype fee', money(transaction.currency, transaction.fee)], ['Payout method', transaction.payoutMethod || '—'], ['Status', transaction.status], ['Created', new Date(transaction.createdAt).toLocaleString()], ['Gift card reference', transaction.giftCardVerificationId]]
  return <main className="page trading-page"><Link className="back-link" to="/transactions"><ArrowLeft size={15} /> Transactions</Link><Header eyebrow="Safe transaction details" title={transaction.transactionId} text="Only prototype metadata is shown. No card credential or PIN is stored." /><div className="trading-panel transaction-detail-card"><div className="transaction-status-row"><span><Banknote size={21} /></span><b>{transaction.type}</b><Status value={transaction.status} /></div><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><Notice>Prototype transaction. No real payment, bank payout, escrow, or settlement occurred.</Notice></div></main>
}

export function AdminTradingPage() {
  const { listings, auctions, transactions } = useTradingSnapshot()
  const [tab, setTab] = useState('P2P Listings')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(null)
    const totals = [
      ['Total Listings', listings.length], ['Active Listings', listings.filter((item) => item.status === 'ACTIVE').length],
      ['Active Auctions', auctions.filter((item) => item.status === 'LIVE').length], ['Pending Transactions', transactions.filter((item) => ['PENDING', 'PROCESSING', 'AWAITING_SETTLEMENT'].includes(item.status)).length],
      ['Completed Transactions', transactions.filter((item) => item.status === 'COMPLETED').length], ['Cancelled Listings', listings.filter((item) => item.status === 'CANCELLED').length],
  ]
  const rows = tab === 'P2P Listings' ? listings : tab === 'Auctions' ? auctions : transactions
  const update = async (type, id, changes, message) => { await adminUpdateRecord(type, id, changes); setNotice(message) }
  return <div className="admin-page trading-admin-page"><div className="admin-heading"><div><p className="eyebrow">Trading operations</p><h1>Trading Dashboard</h1><p className="admin-verification-intro">Prototype marketplace monitoring and review.</p></div><span className="trading-admin-label"><Info size={14} /> Mock trading data</span></div><div className="trading-admin-stats">{totals.map(([label, value]) => <div key={label}><span><ShoppingBag size={17} /></span><b>{value}</b><small>{label}</small></div>)}</div><div className="trading-admin-tabs">{['P2P Listings', 'Auctions', 'Transactions'].map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div><div className="trading-table-wrap"><table className="trading-table"><thead><tr>{(tab === 'Transactions' ? ['Reference', 'Type', 'User', 'Amount', 'Status', 'Brand', 'Action'] : ['Reference', 'Seller', 'Brand', 'Country', 'Amount', 'Status', 'Action']).map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((record) => <tr key={record.id}><td>{record.transactionId || record.id}</td><td>{tab === 'Transactions' ? record.type : record.sellerName}</td><td>{tab === 'Transactions' ? record.userName : record.brand}</td><td>{tab === 'Transactions' ? money(record.currency, record.amount ?? record.estimatedPayout) : record.country}</td><td>{tab === 'Transactions' ? <Status value={record.status} /> : money(record.currency, record.askingPrice ?? record.currentBid)}</td><td>{tab === 'Transactions' ? record.brand : <Status value={record.status} />}</td><td><span className="admin-trading-actions"><button onClick={() => setSelected(record)}>View</button>{tab === 'Transactions' ? <button onClick={() => update('transaction', record.id, { status: 'PROCESSING' }, 'Transaction flagged for review.')}>Review transaction</button> : <><button onClick={() => update(tab === 'Auctions' ? 'auction' : 'listing', record.id, { status: 'SUSPENDED' }, 'Record suspended.')}>Suspend</button><button onClick={() => update(tab === 'Auctions' ? 'auction' : 'listing', record.id, { status: 'CANCELLED' }, 'Record cancelled.')}>Cancel</button></>}</span></td></tr>)}</tbody></table>{rows.length === 0 && <p className="trading-table-empty">No {tab.toLowerCase()} in the prototype dataset yet.</p>}</div>{notice && <p className="trading-admin-notice" role="status">{notice}</p>}{selected && <div className="trading-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="trading-modal" role="dialog" aria-modal="true" aria-labelledby="trading-admin-review-title"><button className="trading-modal-close" onClick={() => setSelected(null)} aria-label="Close review"><X size={18} /></button><p className="eyebrow">Admin review</p><h2 id="trading-admin-review-title">{selected.brand} · {selected.transactionId || selected.id}</h2><p>Seller: {selected.sellerName || selected.userName || selected.sellerId || selected.userId}</p><p>Masked card reference: {selected.maskedCardNumber || 'Not applicable'}</p><p>Amount: {money(selected.currency, selected.askingPrice ?? selected.currentBid ?? selected.amount ?? selected.estimatedPayout)}</p><Status value={selected.status} /><Notice>Admin actions update local prototype records only.</Notice></section></div>}</div>
}

export function TradingActivity() {
  const { user } = useAuth()
  const userId = user?.email || ''
  const [listings, setListings] = useState([])
  const [bids, setBids] = useState([])
  const [transactions, setTransactions] = useState([])
  useEffect(() => {
    const refresh = async () => {
      const [nextListings, nextBids, nextTransactions] = await Promise.all([getMyListings(userId), getMyBids(userId), getTransactions(userId)])
      setListings(nextListings); setBids(nextBids); setTransactions(nextTransactions)
    }
    refresh(); window.addEventListener('giftly-trading-change', refresh)
    return () => window.removeEventListener('giftly-trading-change', refresh)
  }, [userId])
  const activeListings = listings.filter((item) => item.kind === 'P2P Listing' && item.status === 'ACTIVE').length
  const activeAuctions = listings.filter((item) => item.kind === 'Auction' && item.status === 'LIVE').length
  const pendingTransactions = transactions.filter((item) => ['PENDING', 'PROCESSING', 'AWAITING_SETTLEMENT'].includes(item.status)).length
  return <section className="trading-dashboard-section"><div className="trading-dashboard-heading"><div><p className="eyebrow">Trading center</p><h2>Trading Activity</h2></div><Link to="/my-listings">View all activity <ArrowRight size={14} /></Link></div><div className="trading-activity-stats"><Link to="/my-listings"><b>{activeListings}</b><small>Active Listings</small></Link><Link to="/auctions"><b>{activeAuctions}</b><small>Active Auctions</small></Link><Link to="/transactions"><b>{pendingTransactions}</b><small>Pending Transactions</small></Link><Link to="/my-bids"><b>{bids.length}</b><small>My Bids</small></Link></div><div className="trading-dashboard-actions"><Link to="/sell-method"><RefreshCw size={15} /> Sell Gift Card</Link><Link to="/sell/p2p"><Tag size={15} /> Create P2P Listing</Link><Link to="/sell/auction"><Gavel size={15} /> Start Auction</Link><Link to="/transactions"><Banknote size={15} /> View Transactions</Link></div></section>
}
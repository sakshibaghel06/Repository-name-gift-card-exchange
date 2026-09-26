import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from './contexts'
import {
  calculateFee, createAuction, createInstantCashout, createP2PListing,
  getActiveAuctions, getAdminTradingData, getMarketplaceListings, purchaseListing,
} from './services/tradingService'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Banknote, CalendarClock, Gavel,
  CheckCircle2, ChevronRight, Gift, Info, ListFilter, LockKeyhole,
  Search, ShieldCheck, ShoppingBag, Tag, X,
} from 'lucide-react'
import './Trading.css'

const money = (currency, amount) => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount) || 0) } catch { return `${currency} ${Number(amount) || 0}` }
}
const dateText = (date) => date ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function useTradingData() {
  const [data, setData] = useState({ listings: [], auctions: [], transactions: [] })
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      const [, , adminData] = await Promise.all([getMarketplaceListings(), getActiveAuctions(), getAdminTradingData()])
      if (active) { setData({ listings: adminData.listings, auctions: adminData.auctions, transactions: adminData.transactions }); setReady(true) }
    }
    refresh()
    window.addEventListener('giftly-trading-change', refresh)
    return () => { active = false; window.removeEventListener('giftly-trading-change', refresh) }
  }, [])
  return { ...data, ready }
}

function TradingHeader({ eyebrow, title, text, action }) {
  return <header className="trading-page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>{action}</header>
}

function ProtoNotice({ children = 'Prototype transaction — no real money, payment, escrow, or settlement is involved.' }) {
  return <div className="trading-prototype-notice"><Info size={16} /><span>{children}</span></div>
}

function Status({ value }) {
  const normalized = String(value || 'PENDING').toUpperCase().replaceAll('_', '-')
  return <span className={`trading-status status-${normalized.toLowerCase()}`}>{normalized.replaceAll('-', ' ')}</span>
}

function VerifiedBadges() {
  return <span className="trading-trust-badges"><span><BadgeCheck size={13} /> Verified Seller</span><span><CheckCircle2 size={13} /> Gift Card Verified</span><span><ShieldCheck size={13} /> Balance Verified</span></span>
}

function VerifiedCardPicker({ records, selectedId, onChange }) {
  if (!records.length) return null
  return <label className="trading-input">Verified gift card<select value={selectedId} onChange={(event) => onChange(event.target.value)}>{records.map((record) => <option key={record.id} value={record.id}>{record.brand} · {record.maskedCardNumber} · {money(record.currency, record.mockBalance)}</option>)}</select></label>
}

function VerifiedRequired() {
  return <div className="trading-empty-state"><span><ShieldCheck size={25} /></span><h2>Gift Card Verification Required</h2><p>Only successfully verified cards with a verified balance can enter the trading flow.</p><Link className="button primary" to="/gift-card-verification">Verify Gift Card <ArrowRight size={16} /></Link></div>
}

function GiftCardSummary({ record }) {
  return <div className="trading-card-summary"><div className="trading-brand-mark"><Gift size={22} /></div><div className="trading-card-details"><b>{record.brand}</b><small>{record.country} · {record.currency}</small><span>{record.maskedCardNumber}</span></div><div className="trading-card-balance"><Status value="Verified" /><b>{money(record.currency, record.mockBalance)}</b><small>Verified balance</small></div></div>
}

export function SellMethodPage() {
  const { giftCardVerifications } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const verified = giftCardVerifications.filter((record) => record.verificationStatus === 'SUCCESSFUL' && record.balanceStatus === 'VERIFIED')
  const selectedId = verified.some((record) => record.id === searchParams.get('verification')) ? searchParams.get('verification') : verified[0]?.id || ''
  const record = verified.find((item) => item.id === selectedId)
  const setSelected = (id) => setSearchParams({ verification: id })
  if (!record) return <main className="page trading-page"><TradingHeader eyebrow="Trading center" title="Choose How You Want to Sell" text="Choose the selling method that works best for you." /><VerifiedRequired /></main>
  const suffix = `?verification=${encodeURIComponent(record.id)}`
  const { fee, estimatedPayout } = calculateFee(record.mockBalance)
  return <main className="page trading-page"><TradingHeader eyebrow="Trading center" title="Choose How You Want to Sell" text="Choose the selling method that works best for you." /><VerifiedCardPicker records={verified} selectedId={record.id} onChange={setSelected} /><GiftCardSummary record={record} /><ProtoNotice>All trading actions are prototype simulations. No real payments, payouts, escrow, or settlement are connected.</ProtoNotice><div className="sell-method-grid"><article className="sell-method-card cashout"><span className="sell-method-icon"><Banknote size={23} /></span><p className="eyebrow">Quick option</p><h2>Instant Cash-Out</h2><p>Get a quick estimated payout for your verified gift card.</p><div className="method-stats"><span>Estimated payout<b>{money(record.currency, estimatedPayout)}</b></span><span>Processing status<b><Status value="PROCESSING" /></b></span><span>Estimated completion<b>1–2 business days</b></span><span>Prototype fee<b>{money(record.currency, fee)} · 5%</b></span></div><Link className="button primary full" to={`/sell/instant${suffix}`}>Sell Instantly <ArrowRight size={15} /></Link></article><article className="sell-method-card listing"><span className="sell-method-icon"><Tag size={23} /></span><p className="eyebrow">Set your price</p><h2>Fixed-Price Marketplace</h2><p>Set your own selling price and let buyers purchase your gift card.</p><div className="method-stats"><span>Your asking price<b>{money(record.currency, Math.round(record.mockBalance * .9))}</b></span><span>Suggested price<b>{money(record.currency, Math.round(record.mockBalance * .9))}</b></span><span>Potential payout<b>{money(record.currency, Math.round(record.mockBalance * .9))}</b></span><span>Suggested discount<b>10%</b></span></div><Link className="button outline full" to={`/sell/p2p${suffix}`}>Create Listing <ArrowRight size={15} /></Link></article><article className="sell-method-card auction"><span className="sell-method-icon"><Gavel size={23} /></span><p className="eyebrow">Let buyers compete</p><h2>Bidding / Auction</h2><p>Let buyers compete by placing offers on your gift card.</p><div className="method-stats"><span>Starting price<b>{money(record.currency, Math.round(record.mockBalance * .8))}</b></span><span>Auction duration<b>24 hours</b></span><span>Current highest bid<b>{money(record.currency, Math.round(record.mockBalance * .8))}</b></span><span>Number of bids<b>0 bids</b></span></div><Link className="button outline full" to={`/sell/auction${suffix}`}>Start Auction <ArrowRight size={15} /></Link></article></div><p className="trading-fee-note"><Info size={14} /> Prototype fee calculation. The example 5% fee is not a final platform fee.</p></main>
}

export function InstantCashoutPage() {
  const { user, giftCardVerifications } = useAuth()
  const [params] = useSearchParams()
  const [method, setMethod] = useState('UPI')
  const [transaction, setTransaction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const verified = giftCardVerifications.filter((record) => record.verificationStatus === 'SUCCESSFUL' && record.balanceStatus === 'VERIFIED')
  const selectedId = verified.some((record) => record.id === params.get('verification')) ? params.get('verification') : verified[0]?.id
  const record = verified.find((item) => item.id === selectedId)
  if (!record) return <main className="page trading-page"><TradingHeader eyebrow="Instant cash-out" title="Sell Instantly" text="Create a simulated payout request for a verified card." /><VerifiedRequired /></main>
  const { fee, estimatedPayout } = calculateFee(record.mockBalance)
  const submit = async () => {
    setBusy(true); setError('')
    try { setTransaction(await createInstantCashout({ verification: record, user, payoutMethod: method })) } catch (issue) { setError(issue.message) }
    setBusy(false)
  }
  return <main className="page trading-page"><Link className="back-link" to={`/sell-method?verification=${record.id}`}><ArrowLeft size={15} /> Selling methods</Link><TradingHeader eyebrow="Method 1 · Instant Cash-Out" title={transaction ? 'Instant Cash-Out Request Created' : 'Confirm your estimated payout'} text="A prototype calculation only. No real money is transferred." />{transaction ? <div className="trading-confirmation"><span><CheckCircle2 size={28} /></span><p className="eyebrow">Request created</p><h2>Instant Cash-Out Request Created</h2><p>Reference ID · <b>{transaction.transactionId}</b></p><Status value={transaction.status} /><ProtoNotice>Prototype transaction — no real money has been transferred.</ProtoNotice><Link className="button primary" to="/my-listings">View my listings <ArrowRight size={15} /></Link></div> : <div className="trading-form-layout"><section className="trading-panel"><h2>Verified gift card</h2><GiftCardSummary record={record} /><div className="payout-breakdown"><div><span>Gift Card Balance</span><b>{money(record.currency, record.mockBalance)}</b></div><div><span>Platform / processing fee · 5%</span><b>−{money(record.currency, fee)}</b></div><div className="payout-total"><span>Estimated payout</span><b>{money(record.currency, estimatedPayout)}</b></div></div><label className="trading-input">Payout method<select value={method} onChange={(event) => setMethod(event.target.value)}><option>UPI</option><option>Bank Transfer</option><option>Wallet</option></select></label><ProtoNotice>Prototype fee calculation. No real UPI, bank transfer, wallet payout, or financial custody is available.</ProtoNotice>{error && <p className="trading-error" role="alert">{error}</p>}<button className="button primary" type="button" disabled={busy} onClick={submit}>{busy ? 'Creating request…' : 'Confirm Instant Cash-Out'} <ArrowRight size={15} /></button></section><aside className="trading-side-note"><LockKeyhole size={19} /><b>Prototype payout</b><p>The request will appear as Processing in your private trading activity. No real funds move.</p></aside></div>}</main>
}

function TradingCreateForm({ mode }) {
  const { user, giftCardVerifications } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const verified = giftCardVerifications.filter((record) => record.verificationStatus === 'SUCCESSFUL' && record.balanceStatus === 'VERIFIED')
  const [verificationId, setVerificationId] = useState(searchParams.get('verification') || verified[0]?.id || '')
  const [askingPrice, setAskingPrice] = useState('')
  const [minimumPrice, setMinimumPrice] = useState('')
  const [duration, setDuration] = useState(mode === 'auction' ? '24' : '7')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const record = verified.find((item) => item.id === verificationId)
  const amount = Number(askingPrice || record?.mockBalance * (mode === 'auction' ? .8 : .9) || 0)
  const discount = record?.mockBalance ? Math.max(0, (1 - amount / record.mockBalance) * 100) : 0
  if (!record) return <main className="page trading-page"><TradingHeader eyebrow="Trading center" title={mode === 'auction' ? 'Start an Auction' : 'Create a Listing'} text="Choose a verified gift card to begin." /><VerifiedRequired /></main>
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const result = mode === 'auction'
        ? await createAuction({ verification: record, user, startingBid: amount, minimumBid: minimumPrice, duration, description })
        : await createP2PListing({ verification: record, user, askingPrice: amount, minimumPrice, duration, description })
      navigate(mode === 'auction' ? `/auctions/${result.id}` : `/marketplace/${result.id}`)
    } catch (issue) { setError(issue.message) }
    setBusy(false)
  }
  return <main className="page trading-page"><Link className="back-link" to={`/sell-method?verification=${record.id}`}><ArrowLeft size={15} /> Selling methods</Link><TradingHeader eyebrow={mode === 'auction' ? 'Method 3 · Bidding / Auction' : 'Method 2 · Fixed-Price P2P'} title={mode === 'auction' ? 'Start an Auction' : 'Create a Listing'} text="Your verified balance and masked card details are used for this prototype listing." /><div className="trading-form-layout"><form className="trading-panel trading-form" onSubmit={submit}><VerifiedCardPicker records={verified} selectedId={verificationId} onChange={setVerificationId} /><GiftCardSummary record={record} /><div className="trading-fields"><label className="trading-input">Gift card balance<input readOnly value={money(record.currency, record.mockBalance)} /></label><label className="trading-input">{mode === 'auction' ? 'Starting bid' : 'Selling price'}<input required type="number" min="1" max={record.mockBalance} step="0.01" value={askingPrice} onChange={(event) => setAskingPrice(event.target.value)} placeholder={String(Math.round(record.mockBalance * (mode === 'auction' ? .8 : .9)))} /></label><label className="trading-input">Minimum acceptable {mode === 'auction' ? 'bid' : 'price'}<input type="number" min="1" max={record.mockBalance} step="0.01" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} placeholder="Optional" /></label><label className="trading-input">{mode === 'auction' ? 'Auction duration' : 'Listing duration'}<select value={duration} onChange={(event) => setDuration(event.target.value)}>{mode === 'auction' ? <><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option></> : <><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></>}</select></label></div><label className="trading-input">Description<textarea rows="3" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Share useful details about this card" /></label>{mode === 'p2p' && <p className="trading-discount-line">Discount <b>{discount.toFixed(1)}%</b> · Potential payout <b>{money(record.currency, amount)}</b></p>}{error && <p className="trading-error" role="alert">{error}</p>}<ProtoNotice>Prototype marketplace. No escrow, payment, or settlement is connected.</ProtoNotice><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : mode === 'auction' ? 'Start Auction' : 'Publish Listing'} <ArrowRight size={15} /></button></form><aside className="trading-preview-card"><p className="eyebrow">Live preview</p><h2>{mode === 'auction' ? 'Your Auction Preview' : 'Your Gift Card Listing'}</h2><GiftCardSummary record={record} /><div className="trading-preview-facts"><span>{mode === 'auction' ? 'Starting bid' : 'Selling price'}<b>{money(record.currency, amount)}</b></span>{mode === 'p2p' && <span>Discount<b>{discount.toFixed(1)}%</b></span>}{mode === 'auction' && <><span>Current bid<b>{money(record.currency, amount)}</b></span><span>Bid count<b>0 bids</b></span></>}<span>Seller status<b className="seller-verified"><BadgeCheck size={14} /> Verified Seller</b></span><span>Gift card<b><CheckCircle2 size={14} /> Verified · Balance verified</b></span></div></aside></div></main>
}

export function P2PCreatePage() { return <TradingCreateForm mode="p2p" /> }
export function AuctionCreatePage() { return <TradingCreateForm mode="auction" /> }

function MarketplaceFilters({ values, onChange, listings }) {
  const brands = [...new Set(listings.map((listing) => listing.brand))]
  const countries = [...new Set(listings.map((listing) => listing.country))]
  const currencies = [...new Set(listings.map((listing) => listing.currency))]
  return <aside className="market-filter-panel"><b><ListFilter size={15} /> Filter listings</b><label>Brand<select value={values.brand} onChange={(event) => onChange('brand', event.target.value)}><option value="">All brands</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></label><label>Country<select value={values.country} onChange={(event) => onChange('country', event.target.value)}><option value="">All countries</option>{countries.map((item) => <option key={item}>{item}</option>)}</select></label><label>Currency<select value={values.currency} onChange={(event) => onChange('currency', event.target.value)}><option value="">All currencies</option>{currencies.map((item) => <option key={item}>{item}</option>)}</select></label><label>Minimum price<input type="number" min="0" value={values.minPrice} onChange={(event) => onChange('minPrice', event.target.value)} placeholder="0" /></label><label>Maximum price<input type="number" min="0" value={values.maxPrice} onChange={(event) => onChange('maxPrice', event.target.value)} placeholder="No limit" /></label><label>Minimum discount<input type="number" min="0" max="100" value={values.minDiscount} onChange={(event) => onChange('minDiscount', event.target.value)} placeholder="0%" /></label><label className="trading-check"><input type="checkbox" checked={values.verifiedOnly} onChange={(event) => onChange('verifiedOnly', event.target.checked)} /> Verified sellers only</label></aside>
}

export function MarketplaceListingsPage() {
  const data = useTradingData()
  const [filters, setFilters] = useState({ brand: '', country: '', currency: '', minPrice: '', maxPrice: '', minDiscount: '', verifiedOnly: false, sort: 'newest' })
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const listings = useMemo(() => data.listings.filter((listing) => listing.status === 'ACTIVE' && (!filters.brand || listing.brand === filters.brand) && (!filters.country || listing.country === filters.country) && (!filters.currency || listing.currency === filters.currency) && (!filters.verifiedOnly || listing.sellerVerified) && (!Number(filters.minPrice) || listing.askingPrice >= Number(filters.minPrice)) && (!Number(filters.maxPrice) || listing.askingPrice <= Number(filters.maxPrice)) && (!Number(filters.minDiscount) || listing.discountPercent >= Number(filters.minDiscount))).sort((a, b) => filters.sort === 'price-low' ? a.askingPrice - b.askingPrice : filters.sort === 'price-high' ? b.askingPrice - a.askingPrice : filters.sort === 'discount' ? b.discountPercent - a.discountPercent : new Date(b.createdAt) - new Date(a.createdAt)), [data.listings, filters])
  return <main className="page trading-page"><TradingHeader eyebrow="Giftly P2P marketplace" title="Verified gift card listings" text="Explore cards listed by verified Giftly sellers." action={<Link className="button outline" to="/sell-method">Sell a Gift Card</Link>} /><ProtoNotice>Prototype marketplace only. Real escrow and payment protection have not been integrated.</ProtoNotice><div className="trading-market-toolbar"><span><b>{listings.length}</b> active listings</span><label>Sort by<select value={filters.sort} onChange={(event) => update('sort', event.target.value)}><option value="newest">Newest</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="discount">Highest Discount</option></select></label></div><div className="trading-market-layout"><MarketplaceFilters values={filters} onChange={update} listings={data.listings} /><div className="trading-listing-grid">{listings.map((listing) => <article className="trading-listing-card" key={listing.id}><div className="trading-listing-art"><span><Gift size={25} /></span><small>{listing.currency}</small></div><div className="trading-listing-body"><div className="trading-listing-title"><h2>{listing.brand}</h2><Status value={listing.status} /></div><p>{listing.country} · {listing.currency}</p><VerifiedBadges /><div className="listing-price-row"><span>Face value<b>{money(listing.currency, listing.faceValue)}</b></span><span>Selling price<b>{money(listing.currency, listing.askingPrice)}</b></span></div><div className="listing-card-foot"><span>{listing.discountPercent}% off</span><Link className="button primary" to={`/marketplace/${listing.id}`}>View Listing <ChevronRight size={14} /></Link></div></div></article>)}{listings.length === 0 && <div className="trading-empty-state compact"><span><Search size={22} /></span><h2>No active listings yet</h2><p>Verified seller listings will appear here.</p><Link to="/sell-method">Create the first listing</Link></div>}</div></div></main>
}

export function ListingDetailPage() {
  const { listingId } = useParams()
  const data = useTradingData()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const listing = data.listings.find((item) => item.id === listingId)
  const escrowTransaction = data.transactions.find((transaction) => transaction.listingId === listingId && transaction.escrowRecordId && (transaction.userId === user?.email || transaction.sellerId === user?.email))
  const message = escrowTransaction?.transactionId || ''
  const buy = async () => {
    setError('')
    try { const transaction = await purchaseListing({ listing, buyer: user }); setConfirm(false); navigate(`/escrow/${transaction.escrowRecordId}`) } catch (issue) { setError(issue.message) }
  }
  if (!listing && !data.ready) return <main className="page trading-page"><TradingHeader eyebrow="Giftly marketplace" title="Loading listing" text="Checking current listing availability." /></main>
  if (!listing) return <main className="page trading-page"><TradingHeader eyebrow="Giftly marketplace" title="Listing unavailable" text="This listing may have expired or been purchased." /><Link className="button outline" to="/marketplace">Browse listings</Link></main>
  return <main className="page trading-page"><Link className="back-link" to="/marketplace"><ArrowLeft size={15} /> Marketplace</Link><TradingHeader eyebrow={`Listing · ${listing.id}`} title={listing.brand} text={`${listing.country} · ${listing.currency}`} /><div className="trading-detail-layout"><section className="trading-panel"><GiftCardSummary record={{ ...listing, mockBalance: listing.faceValue }} /><VerifiedBadges /><div className="trading-detail-price"><span>Face value<b>{money(listing.currency, listing.faceValue)}</b></span><span>Selling price<b>{money(listing.currency, listing.askingPrice)}</b></span><span>Discount<b>{listing.discountPercent}%</b></span></div><p className="trading-description">{listing.description || 'Verified gift card available for exchange.'}</p><div className="trading-trust-note"><BadgeCheck size={17} /><span><b>Verified Giftly Seller</b><small>Seller identity and gift-card balance have prototype verification status.</small></span></div><p className="trading-expiry"><CalendarClock size={15} /> Listing expires {dateText(listing.expiresAt)}</p><ProtoNotice>Prototype purchase only. No payment or escrow protection is currently connected.</ProtoNotice>{error && <p className="trading-error" role="alert">{error}</p>}{message ? <div className="trading-confirm-inline"><CheckCircle2 size={18} /><span><b>Escrow Created · Funds Secured</b><small>Reference · {message} · Simulated payment · Gift card locked</small></span><Link to={`/escrow/${escrowTransaction.escrowRecordId}`}>View Escrow</Link></div> : <button className="button primary" onClick={() => user ? setConfirm(true) : navigate('/login')}><ShoppingBag size={16} /> Buy Gift Card · {money(listing.currency, listing.askingPrice)}</button>}</section><aside className="trading-side-note"><ShieldCheck size={19} /><b>Trust, with clear limits</b><p>Verification is simulated. Real payment processing and escrow protection will require future integrations.</p></aside></div>{confirm && <div className="trading-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirm(false) }}><section className="trading-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title"><button className="trading-modal-close" onClick={() => setConfirm(false)} aria-label="Close confirmation"><X size={18} /></button><span className="trading-modal-mark"><ShoppingBag size={22} /></span><p className="eyebrow">Purchase confirmation</p><h2 id="purchase-title">You are about to purchase this gift card.</h2><div className="trading-modal-facts"><span>Price<b>{money(listing.currency, listing.askingPrice)}</b></span><span>Seller verification<b>Verified Giftly Seller</b></span></div><ProtoNotice>Mock payment only. You will not be charged.</ProtoNotice><div className="trading-modal-actions"><button className="button outline" onClick={() => setConfirm(false)}>Go back</button><button className="button primary" onClick={buy}>Confirm Purchase</button></div></section></div>}</main>
}
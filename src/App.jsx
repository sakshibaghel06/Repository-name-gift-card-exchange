import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, ChevronRight,
  Bell, CircleCheck, CircleUserRound, Gift, Globe2, Heart, LayoutDashboard,
  LockKeyhole, LogOut, Menu, PackageCheck, Search, Settings2, ShieldAlert,
  ShieldCheck, ShoppingBag, Sparkles, Wallet as WalletIcon, X,
} from 'lucide-react'
import { formatINR, offers as prototypeOffers } from './data'
import { AuthProvider, CartProvider, WishlistProvider, WalletProvider, useAuth, useCart, useWallet, useWishlist } from './contexts'
import { VerificationPage, AdminVerificationsPage } from './Verification'
import { GiftCardVerificationPage, GiftCardVerificationHistoryPage, AdminGiftCardVerificationsPage } from './GiftCardVerification'
import { AuctionCreatePage, InstantCashoutPage, ListingDetailPage, MarketplaceListingsPage, P2PCreatePage, SellMethodPage } from './Trading'
import { AdminTradingPage, AuctionDetailPage, AuctionMarketplacePage, MyBidsPage, MyListingsPage, TradingActivity, TransactionDetailPage, TransactionsPage } from './TradingPages'
import { AdminDisputesPage, AdminEscrowDashboardPage, DisputeDetailPage, DisputesPage, EscrowActivity, EscrowDetailPage, MyEscrowsPage } from './Escrow'
import { MarketplaceCashoutPage, WalletConvertPage, WalletDepositPage, WalletPage, WalletTransactionDetailPage, WalletTransactionsPage, WalletWithdrawPage } from './Wallet'
import { AdminWalletPage } from './AdminWallet'
import { DeliveryPage } from './Delivery'
import { DeliveriesPage } from './Deliveries'
import { AdminDeliveriesPage } from './AdminDeliveries'
import { NotificationsPage, AdminNotificationsPage } from './Notifications'
import { OperationsPage } from './Operations'
import { AdminFraudPage, AdminManagementPage } from './AdminManagement'
import { LegalPage } from './LegalPages'
import { RegionCurrencyControls } from './GlobalPreferences'
import { getUnreadCount, NOTIFICATION_CHANGE_EVENT } from './services/notificationService'
import { getPublicCatalog } from './services/catalogService'
import heroImage from './assets/hero.png'

function Brand() {
  return <Link className="brand" to="/" aria-label="Giftly Exchange home"><span className="brand-mark"><Gift size={17} /></span><span>Giftly <span>Exchange</span></span></Link>
}

function NotificationBell() {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    const refresh = () => setUnread(user?.email ? getUnreadCount(user.email) : 0)
    refresh()
    window.addEventListener(NOTIFICATION_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(NOTIFICATION_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [user?.email])
  if (user?.role !== 'customer') return null
  return <Link className="nav-icon" to="/notifications" aria-label={unread ? `${unread} unread notifications` : 'Notifications'}><Bell size={18} />{unread > 0 && <small>{unread > 9 ? '9+' : unread}</small>}</Link>
}

function StorefrontLayout() {
  const { user, logout } = useAuth()
  const { cart } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0)
  return <>
    <header className="navbar"><div className="nav-inner">
      <Brand />
      <nav className={`nav-links ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
        <NavLink to="/gift-cards" onClick={closeMenu}>Gift Cards</NavLink>
        <NavLink to="/marketplace" onClick={closeMenu}>Marketplace</NavLink>
        <NavLink to="/offers" onClick={closeMenu}>Offers</NavLink>
        <Link to="/how-it-works" onClick={closeMenu}>How It Works</Link>
        <NavLink to="/auctions" onClick={closeMenu}>Auctions</NavLink>
        <NavLink to="/sell-method" onClick={closeMenu}>Sell a Card</NavLink>
        {user?.role === 'customer' && <NavLink to="/deliveries" onClick={closeMenu}>Deliveries</NavLink>}
        <RegionCurrencyControls />
      </nav>
      <div className="nav-actions">
        <NotificationBell />
        <Link className="nav-icon" to="/gift-cards" aria-label="Search gift cards"><Search size={18} /></Link>
        <Link className="nav-icon" to="/wishlist" aria-label="Wishlist"><Heart size={18} /></Link>
        <Link className="nav-icon" to="/cart" aria-label={`Cart with ${cartCount} items`}><ShoppingBag size={19} />{cartCount > 0 && <small>{cartCount}</small>}</Link>
        <Link className="nav-icon" to={user ? user.role === 'admin' ? '/admin' : '/dashboard' : '/login'} aria-label={user ? user.role === 'admin' ? 'Admin account' : 'Your account' : 'Sign in'}><CircleUserRound size={19} /></Link>
        {user ? <button className="login-link" onClick={logout}><LogOut size={15} /><span>Sign out</span></button> : <Link className="login-link" to="/login">Sign in</Link>}
        <button className="mobile-menu" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </div></header>
    <Outlet />
    <footer className="footer">
      <div className="footer-main"><div><Brand /><p className="footer-copy">Give More. Save More. Gift Smarter.<br />A gift-card exchange prototype.</p></div><div><b>Explore</b><Link to="/gift-cards">Gift cards</Link><Link to="/marketplace">Marketplace</Link><Link to="/auctions">Auctions</Link><Link to="/how-it-works">How it works</Link></div><div><b>Your account</b><Link to={user ? '/dashboard' : '/login'}>Dashboard</Link><Link to="/wallet">Wallet</Link><Link to="/verification">Verification</Link><Link to="/notifications">Notifications</Link></div><div><b>Trust & information</b><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/compliance">Compliance</Link><Link to="/security">Security</Link><p>Payments, verification, and transactions are simulated.</p></div></div>
      <div className="footer-bottom"><span>© Giftly Exchange · Product prototype</span><span>Give More. Save More. Gift Smarter.</span></div>
    </footer>
  </>
}

function ProductCard({ card }) {
  const { addToCart } = useCart()
  const { toggleWishlist, wishlist } = useWishlist()
  const [added, setAdded] = useState(false)
  const saved = wishlist.some((item) => item.id === card.id)
  return <article className="gift-card">
    <div className="gift-card-art-wrap">
      <Link to={`/gift-cards/${card.id}`} className="gift-visual" style={{ background: card.color, color: card.accent }}>
        <span className="gift-logo" style={{ background: card.accent }}>{card.logo}</span><span>{card.brand}</span><small className="gift-discount">Save {card.discount}%</small>
      </Link>
      <button className={`product-wishlist ${saved ? 'saved' : ''}`} onClick={() => toggleWishlist(card)} aria-label={saved ? `Remove ${card.name} from wishlist` : `Add ${card.name} to wishlist`}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="gift-info"><div className="product-meta"><span>{card.category}</span>{card.rating !== null && card.rating !== undefined && <span aria-label={`${card.rating} out of 5 stars`}>★ {card.rating}</span>}</div><Link to={`/gift-cards/${card.id}`}><h3>{card.name}</h3></Link><div className="product-price"><b>{formatINR(Math.round(card.value * (1 - card.discount / 100)))}</b><del>{formatINR(card.value)}</del></div><button className="button primary product-buy" onClick={() => { addToCart(card); setAdded(true) }}><ShoppingBag size={15} />{added ? 'Added to bag' : 'Add to bag'}</button></div>
  </article>
}

function ProductGrid({ cards }) {
  return <div className="card-grid">{cards.map((card) => <ProductCard key={card.id} card={card} />)}</div>
}

function usePrototypeCatalog() {
  const [catalog, setCatalog] = useState({ categories: [], giftCards: [], offers: prototypeOffers })
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')

  useEffect(() => {
    let mounted = true
    getPublicCatalog()
      .then((nextCatalog) => {
        if (mounted) setCatalog(nextCatalog)
      })
      .catch((error) => {
        console.error('Catalog loading error:', error)
        if (mounted) setCatalogError('The live gift-card catalog is unavailable. Check the Supabase connection and catalog migration.')
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false)
      })

    return () => { mounted = false }
  }, [])

  return { ...catalog, catalogLoading, catalogError }
}

function StoreHome() {
  const { categories, giftCards, offers, catalogError } = usePrototypeCatalog()
  return <main className="storefront-home">
    <section className="hero hero-premium">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="brand-mark"><Gift size={16} /></span><span><b>Giftly Exchange</b><small>Give More. Save More. Gift Smarter.</small></span></div>
        <p className="eyebrow">A global gift-card marketplace</p>
        <h1>More joy in every<br /><em>gift card.</em></h1>
        <p>Discover thoughtful gifts, browse verified-seller listings, or explore ways to exchange a card you are not using.</p>
        <form className="search-bar home-search" action="/gift-cards"><Search size={18} /><input name="q" placeholder="Search brands, categories, or gift cards" aria-label="Search gift cards" /><button aria-label="Search gift cards"><ArrowRight size={17} /></button></form>
        <div className="hero-actions"><Link className="button primary" to="/gift-cards">Explore Gift Cards <ArrowRight size={16} /></Link><Link className="button outline" to="/sell-method">Sell a Gift Card <ArrowUpRight size={16} /></Link></div>
      </div>
      <div className="hero-art"><div className="sun" /><img className="restored-hero-image" src={heroImage} alt="Gift cards arranged for gifting" /><div className="hero-card card-one"><span>Giftly</span><b>For someone<br />wonderful.</b><small>GIVE MORE · GIFT SMARTER</small></div><div className="hero-card card-two"><span>Giftly Exchange</span><b>₹2,000</b><small>SHOPPING · DIGITAL GIFT CARD</small></div><div className="hero-art-note"><Globe2 size={15} /><span>Thoughtful picks<br /><b>across categories</b></span></div></div>
    </section>
      {catalogError && <p className="catalog-load-message" role="status">{catalogError}</p>}
      <section className="trust-stats" aria-label="Giftly marketplace at a glance"><div><b>{giftCards.length}</b><span>gift cards</span></div><div><b>{categories.length}</b><span>categories to explore</span></div><div><b>{offers.length}</b><span>prototype offers</span></div><div><span className="trust-stat-label"><ShieldCheck size={16} /> Prototype marketplace</span><small>Transparent about what is simulated</small></div></section>
    <section className="section category-section"><div className="section-heading"><div><p className="eyebrow">Find your kind of happy</p><h2>Browse by category</h2></div><Link className="text-link" to="/gift-cards">All gift cards <ArrowRight size={15} /></Link></div><div className="category-grid">{categories.slice(0, 6).map((category) => <Link className="category-card" to={`/categories/${encodeURIComponent(category.name)}`} key={category.name} style={{ '--category-bg': category.color, '--category-accent': category.accent }}><span className="category-icon"><Gift size={19} /></span><span><b>{category.name}</b><small>{category.count} gift ideas</small></span><ChevronRight size={15} /></Link>)}</div></section>
    <section className="section tinted popular-section"><div className="section-heading"><div><p className="eyebrow">Popular gift cards</p><h2>Good picks, ready to explore</h2></div><Link className="text-link" to="/gift-cards">Browse the catalog <ArrowRight size={15} /></Link></div><ProductGrid cards={giftCards.slice(0, 4)} /></section>
    <section className="section offers-section"><div className="section-heading"><div><p className="eyebrow">Today's offers</p><h2>A little extra joy</h2></div><Link className="text-link" to="/offers">See all offers <ArrowRight size={15} /></Link></div><div className="offer-grid">{offers.map((offer) => <article className={`offer-card ${offer.color}`} key={offer.id}><span><Sparkles size={19} /></span><p className="eyebrow">Giftly offer</p><h3>{offer.title}</h3><p>{offer.detail}</p><b>{offer.code}</b></article>)}</div><p className="section-caption">Offers are sample product content and are not redeemable in checkout.</p></section>
    <section className="section how-section" id="how-it-works"><div className="section-heading"><div><p className="eyebrow">A simple place to start</p><h2>How Giftly works</h2></div><p>Explore the product flows. Purchases and fulfilment are not connected in this prototype.</p></div><div className="how-steps"><article><span>01</span><div className="how-step-icon"><Search size={20} /></div><h3>Find a card</h3><p>Browse the sample catalog or explore peer-to-peer marketplace listings.</p></article><article><span>02</span><div className="how-step-icon"><Heart size={20} /></div><h3>Choose what fits</h3><p>Compare face value, sample pricing, and listing details before deciding.</p></article><article><span>03</span><div className="how-step-icon"><ShieldCheck size={20} /></div><h3>Explore with clarity</h3><p>Use the local prototype workflows with clear labels about what is simulated.</p></article></div></section>
    <section className="section exchange-section"><div className="section-heading"><div><p className="eyebrow">One marketplace, more possibilities</p><h2>Buy, sell, or exchange</h2></div></div><div className="exchange-paths"><Link to="/gift-cards"><span><ShoppingBag size={20} /></span><b>Buy a gift card</b><small>Browse sample cards by brand and category.</small><span className="path-link">Explore catalog <ArrowRight size={14} /></span></Link><Link to="/sell-method"><span><ArrowUpRight size={20} /></span><b>Sell a gift card</b><small>Try the gift-card verification and selling prototype.</small><span className="path-link">See selling options <ArrowRight size={14} /></span></Link><Link to="/marketplace"><span><Globe2 size={20} /></span><b>Explore exchange listings</b><small>View peer-to-peer cards and auctions from the local demo.</small><span className="path-link">Visit marketplace <ArrowRight size={14} /></span></Link></div></section>
    <section className="section why-section"><div className="why-copy"><p className="eyebrow">Designed for thoughtful choices</p><h2>Clarity comes first.</h2><p>Giftly brings gift-card discovery and exchange tools into one considered experience, with prototype limits stated plainly.</p><Link className="text-link" to="/marketplace">Explore the marketplace <ArrowRight size={15} /></Link></div><div className="why-list"><article><span><BadgeCheck size={18} /></span><div><b>Clear prices</b><p>See face value and sample discount together.</p></div></article><article><span><LockKeyhole size={18} /></span><div><b>Privacy-aware prototype</b><p>Never enter payment details or real gift-card credentials in the storefront.</p></div></article><article><span><CircleCheck size={18} /></span><div><b>Honest about simulation</b><p>Wallet, verification, delivery, and escrow flows are not real services.</p></div></article></div></section>
    <section className="trust-panel"><div className="trust-panel-icon"><ShieldCheck size={22} /></div><div><p className="eyebrow">Trust & safety</p><h2>A prototype, with the limits in view.</h2><p>Giftly does not process real payments or provide real KYC, retailer verification, fraud detection, delivery, or escrow custody. Production use would need secure backend systems, verified providers, and legal review.</p></div><Link className="button outline" to="/verification">Explore verification <ArrowRight size={15} /></Link></section>
    <section className="final-cta"><div><p className="eyebrow">Find a gift with a little more meaning</p><h2>Give More. Save More.<br /><em>Gift Smarter.</em></h2><p>Start exploring Giftly's sample gift-card catalog.</p></div><Link className="button primary" to="/gift-cards">Explore Gift Cards <ArrowRight size={16} /></Link></section>
  </main>
}

function CatalogPage() {
  const { categories, giftCards, catalogLoading, catalogError } = usePrototypeCatalog()
  const { category } = useParams()
  const [searchParams] = useSearchParams()
  const normalized = decodeURIComponent(category || '').toLowerCase()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [brand, setBrand] = useState('')
  const [maximumValue, setMaximumValue] = useState('')
  const [minimumDiscount, setMinimumDiscount] = useState('')
  const cards = giftCards.filter((card) => {
    const textMatch = `${card.name} ${card.brand} ${card.category}`.toLowerCase().includes(query.trim().toLowerCase())
    return (!category || card.category.toLowerCase() === normalized) && textMatch && (!brand || card.brand === brand) && (!maximumValue || card.value <= Number(maximumValue)) && (!minimumDiscount || card.discount >= Number(minimumDiscount))
  })
  const title = category || (query ? `Results for “${query}”` : 'Gift Cards')
  const clearFilters = () => { setQuery(''); setBrand(''); setMaximumValue(''); setMinimumDiscount('') }
  return <main className="page catalog-page"><header className="page-header catalog-heading"><div><p className="eyebrow">Giftly Exchange · Catalog</p><h1>{title}</h1><p>Browse published gift cards. Checkout and fulfillment are not connected.</p></div><span className="catalog-assurance"><ShieldCheck size={16} /> Catalog pricing</span></header>
        {catalogLoading && <p className="catalog-load-message" role="status">Loading the gift-card catalog...</p>}{catalogError && <p className="catalog-load-message" role="alert">{catalogError}</p>}
    <div className="catalog-search search-bar"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search brands, categories, or gift cards" aria-label="Search gift cards" />{query && <button type="button" className="catalog-clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}</div>
    <div className="catalog-categories" aria-label="Filter by category"><Link className={!category ? 'active' : ''} to="/gift-cards">All categories</Link>{categories.map((item) => <Link className={category === item.name ? 'active' : ''} to={`/categories/${encodeURIComponent(item.name)}`} key={item.name}>{item.name}</Link>)}</div>
    <div className="catalog-filter-row"><label>Brand<select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{[...new Set(giftCards.map((card) => card.brand))].sort().map((item) => <option key={item}>{item}</option>)}</select></label><label>Maximum face value<select value={maximumValue} onChange={(event) => setMaximumValue(event.target.value)}><option value="">Any value</option><option value="1000">Up to {formatINR(1000)}</option><option value="2500">Up to {formatINR(2500)}</option><option value="5000">Up to {formatINR(5000)}</option></select></label><label>Discount<select value={minimumDiscount} onChange={(event) => setMinimumDiscount(event.target.value)}><option value="">Any discount</option><option value="5">5% or more</option><option value="10">10% or more</option><option value="15">15% or more</option></select></label><span className="catalog-result-count"><b>{cards.length}</b> cards</span>{(brand || maximumValue || minimumDiscount || query) && <button className="catalog-reset" onClick={clearFilters}>Clear filters</button>}</div>
    {cards.length ? <ProductGrid cards={cards} /> : !catalogLoading && <div className="empty-state catalog-empty"><Search size={23} /><h2>{catalogError ? 'Catalog is unavailable' : giftCards.length ? 'No matching gift cards' : 'No gift cards published yet'}</h2><p>{catalogError ? 'Try again after the Supabase catalog is reachable.' : 'Try changing your search or filters.'}</p>{giftCards.length > 0 && <button className="button outline" onClick={clearFilters}>Clear filters</button>}</div>}
  </main>
}

function OffersPage() {
  const { offers } = usePrototypeCatalog()
  return <main className="page"><header className="page-header"><p className="eyebrow">Giftly offers</p><h1>Small surprises, extra value</h1><p>Sample offers for the Giftly Exchange prototype.</p></header><div className="offer-grid">{offers.map((offer) => <article className={`offer-card ${offer.color}`} key={offer.id}><span><Sparkles size={19} /></span><p className="eyebrow">Giftly offer</p><h3>{offer.title}</h3><p>{offer.detail}</p><b>{offer.code}</b></article>)}</div><p className="mock-note"><ShieldCheck size={15} /> Offer codes are illustrative and are not connected to checkout.</p></main>
}

function GiftCardDetailPage() {
  const { giftCards, catalogLoading, catalogError } = usePrototypeCatalog()
  const { id } = useParams()
  const navigate = useNavigate()
  const card = giftCards.find((item) => item.id === id)
  const { addToCart } = useCart()
  const { toggleWishlist, wishlist } = useWishlist()
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState('')
    if (!card) return <main className="page"><h1>{catalogLoading ? 'Loading gift card...' : catalogError ? 'Catalog unavailable' : 'Gift card not found'}</h1>{catalogError && <p className="catalog-load-message" role="alert">{catalogError}</p>}<Link to="/gift-cards">Browse gift cards</Link></main>
  /*
    return <main className="page product-page"><Link className="back-link" to="/gift-cards">← Back to gift cards</Link><div className="product-detail"><div className="product-preview product-preview-premium" style={{ background: card.color, color: card.accent }}><div className="product-preview-top"><span className="gift-logo" style={{ background: card.accent }}>{card.logo}</span><span>GIFTLY EXCHANGE</span></div><div><small>DIGITAL GIFT CARD</small><b>{card.brand}</b><strong>{formatINR(card.value)}</strong></div><span className="product-preview-circles" /></div><section className="product-copy"><p className="eyebrow">{card.category} · Giftly catalog</p><h1>{card.name}</h1><div className="product-brand-rating"><b>{card.brand}</b>{card.rating == null ? <span>New to catalog</span> : <span>★ {card.rating} <small>rating</small></span>}</div><p>{card.description || 'Give someone the freedom to choose. Catalog information is provided by Giftly.'} Purchases, seller inventory, and fulfillment are not connected in this phase.</p><div className="product-value-box"><div><span>Sample selling price</span><b>{formatINR(price)}</b></div><div><span>Face value</span><del>{formatINR(card.value)}</del></div><span className="product-discount">Save {card.discount}%</span></div><div className="product-availability"><CircleCheck size={16} /><span><b>Listed in the catalog</b><small>Catalog presence does not imply available seller inventory.</small></span></div><div className="product-buy-row"><label className="quantity-control">Quantity<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((count) => <option key={count}>{count}</option>)}</select></label><button className="button outline product-save" onClick={() => toggleWishlist(card)} aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}><Heart size={17} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Wishlist'}</button></div><div className="product-actions"><button className="button outline" onClick={addSelected}><ShoppingBag size={16} /> Add to bag</button><button className="button primary" [truncated]
  */
  const saved = wishlist.some((item) => item.id === card.id)
  const price = Math.round(card.value * (1 - card.discount / 100))
  const addSelected = () => { addToCart(card, quantity); setNotice(`${quantity} ${card.name} added to your bag.`) }
  return <main className="page product-page"><Link className="back-link" to="/gift-cards">← Back to gift cards</Link><div className="product-detail"><div className="product-preview product-preview-premium" style={{ background: card.color, color: card.accent }}><div className="product-preview-top"><span className="gift-logo" style={{ background: card.accent }}>{card.logo}</span><span>GIFTLY EXCHANGE</span></div><div><small>DIGITAL GIFT CARD</small><b>{card.brand}</b><strong>{formatINR(card.value)}</strong></div><span className="product-preview-circles" /></div><section className="product-copy"><p className="eyebrow">{card.category} · Sample catalog</p><h1>{card.name}</h1><div className="product-brand-rating"><b>{card.brand}</b><span>★ {card.rating} <small>sample rating</small></span></div><p>Give someone the freedom to choose. This listing uses sample catalog data for the Giftly Exchange prototype.</p><div className="product-value-box"><div><span>Selling price</span><b>{formatINR(price)}</b></div><div><span>Face value</span><del>{formatINR(card.value)}</del></div><span className="product-discount">Save {card.discount}%</span></div><div className="product-availability"><CircleCheck size={16} /><span><b>Available in sample catalog</b><small>Real inventory and fulfillment are not connected.</small></span></div><div className="product-buy-row"><label className="quantity-control">Quantity<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((count) => <option key={count}>{count}</option>)}</select></label><button className="button outline product-save" onClick={() => toggleWishlist(card)} aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}><Heart size={17} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Wishlist'}</button></div><div className="product-actions"><button className="button outline" onClick={addSelected}><ShoppingBag size={16} /> Add to bag</button><button className="button primary" onClick={() => { addSelected(); navigate('/cart') }}>Buy now <ArrowRight size={16} /></button></div>{notice && <p className="product-added-note" role="status">{notice}</p>}<div className="product-assurance"><div><PackageCheck size={17} /><span><b>Delivery details</b><small>Digital delivery is not active in this prototype.</small></span></div><div><LockKeyhole size={17} /><span><b>Safe to explore</b><small>Do not enter payment or card credentials here.</small></span></div></div><p className="mock-note"><ShieldCheck size={15} /> No real checkout, payment, or gift-card fulfillment is connected.</p></section></div><section className="related-products"><div className="section-heading"><div><p className="eyebrow">Keep exploring</p><h2>Related gift cards</h2></div><Link className="text-link" to={`/categories/${encodeURIComponent(card.category)}`}>More in {card.category} <ArrowRight size={14} /></Link></div><ProductGrid cards={giftCards.filter((item) => item.id !== card.id && item.category === card.category).slice(0, 3)} /></section></main>
}

function getSavedOrders() {
  try {
    return JSON.parse(localStorage.getItem('giftly-orders') || '[]')
  } catch {
    return []
  }
}

function buildDemoOrder({ cart, subtotal, fees, total, user, form }) {
  const createdAt = new Date()
  const stamp = Date.now()
  return {
    id: `GEX-${String(stamp).slice(-6)}`,
    date: createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: 'Processing',
    total,
    subtotal,
    fees,
    items: cart.map((item) => ({ ...item, price: item.price, quantity: item.quantity })),
    customer: user?.name || form.name || 'Giftly member',
    email: user?.email || form.email,
    shipping: { address: form.address || 'Demo address', city: form.city || 'Bengaluru', state: form.state || 'Karnataka' },
    paymentMethod: form.paymentMethod,
    createdAt: createdAt.toISOString(),
    href: '/orders',
  }
}

function CartPage() {
  const { user } = useAuth()
  const { cart, updateQuantity, removeFromCart } = useCart()
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  return <main className="page"><header className="page-header"><p className="eyebrow">Your selections</p><h1>Shopping bag</h1><p>Sample catalog items stay in this browser for the prototype.</p></header>{cart.length ? <div className="checkout-layout"><section className="cart-list">{cart.map((item) => <article className="cart-item" key={item.id}><div className="mini-visual" style={{ background: item.accent }}>{item.logo}</div><div className="cart-item-copy"><b>{item.name}</b><span>{item.brand}</span><strong>{formatINR(item.price)}</strong></div><label>Quantity <select value={item.quantity} onChange={(event) => updateQuantity(item.id, Number(event.target.value))}>{[1, 2, 3, 4, 5].map((count) => <option key={count}>{count}</option>)}</select></label><button className="icon-button" onClick={() => removeFromCart(item.id)} aria-label={`Remove ${item.name}`}>Remove</button></article>)}</section><aside className="summary"><h3>Order summary</h3><div><span>Subtotal</span><b>{formatINR(subtotal)}</b></div><p className="mock-note"><ShieldCheck size={15} /> Checkout and payment are not connected in this prototype.</p><Link className="button primary full" to={user ? '/checkout' : '/login'} state={user ? undefined : { from: { pathname: '/checkout' } }}>Proceed to checkout</Link><Link className="button outline full" to="/marketplace" style={{ marginTop: '10px' }}>Continue exploring</Link></aside></div> : <div className="empty-state"><ShoppingBag size={25} /><h2>Your bag is empty</h2><p>Find something thoughtful in the gift card catalog.</p><Link className="button primary" to="/gift-cards">Browse gift cards</Link></div>}</main>
}

function CheckoutPage() {
  const { user } = useAuth()
  const { cart, clearCart } = useCart()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: user?.email || '', name: user?.name || '', address: '', city: '', state: '', paymentMethod: 'demo-wallet' })
  const [submitting, setSubmitting] = useState(false)
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const fees = Math.round(subtotal * 0.02)
  const total = subtotal + fees

  if (!cart.length) {
    return <main className="page"><header className="page-header"><p className="eyebrow">Checkout</p><h1>Your bag is empty</h1><p>Add a gift card to continue.</p></header><Link className="button primary" to="/gift-cards">Browse gift cards</Link></main>
  }

  const handleChange = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const handlePlaceOrder = (event) => {
    event.preventDefault()
    setSubmitting(true)
    const nextOrder = buildDemoOrder({ cart, subtotal, fees, total, user, form })
    const currentOrders = getSavedOrders()
    localStorage.setItem('giftly-orders', JSON.stringify([nextOrder, ...currentOrders]))
    clearCart()
    navigate(`/order-success?order=${encodeURIComponent(nextOrder.id)}`)
  }

  return <main className="page"><header className="page-header"><p className="eyebrow">Checkout</p><h1>Secure your order</h1><p>Prototype checkout only. No real payment or provider is connected.</p></header><form className="checkout-layout" onSubmit={handlePlaceOrder}><section className="panel form-panel"><h2>Delivery details</h2><label>Name<input required value={form.name} onChange={(event) => handleChange('name', event.target.value)} placeholder="Your full name" /></label><label>Email<input required type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder="you@example.com" /></label><label>Address<input required value={form.address} onChange={(event) => handleChange('address', event.target.value)} placeholder="Street address" /></label><div className="form-grid"><label>City<input required value={form.city} onChange={(event) => handleChange('city', event.target.value)} placeholder="Bengaluru" /></label><label>State<input value={form.state} onChange={(event) => handleChange('state', event.target.value)} placeholder="Karnataka" /></label></div><h2>Payment</h2><div className="payment-options">{['demo-wallet', 'upi', 'card', 'bank'].map((method) => <button type="button" key={method} className={form.paymentMethod === method ? 'selected' : ''} onClick={() => handleChange('paymentMethod', method)}>{method === 'demo-wallet' ? 'Demo wallet' : method.toUpperCase()}</button>)}</div><p className="mock-note"><ShieldCheck size={15} /> Secure delivery, payment, and fulfilment remain prototype-only in this flow.</p></section><aside className="summary"><h3>Order summary</h3>{cart.map((item) => <div key={item.id}><span>{item.name}</span><b>{formatINR(item.price * item.quantity)}</b></div>)}<div><span>Subtotal</span><b>{formatINR(subtotal)}</b></div><div><span>Service fee</span><b>{formatINR(fees)}</b></div><hr /><div className="summary-total"><span>Total</span><b>{formatINR(total)}</b></div><button className="button primary full" type="submit" disabled={submitting}>{submitting ? 'Placing order...' : 'Place order'}</button><Link className="button outline full" to="/cart" style={{ marginTop: '10px' }}>Edit bag</Link></aside></form></main>
}

function OrderSuccessPage() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order')
  return <main className="page"><section className="success-page"><p className="eyebrow">Order confirmed</p><h1>Thank you for shopping with Giftly.</h1><p>Your prototype order {orderId ? `#${orderId}` : 'has been received'} is being prepared.</p><div className="button-row"><Link className="button primary" to="/orders">View orders</Link><Link className="button outline" to="/gift-cards">Keep shopping</Link></div></section></main>
}

function OrdersPage() {
  const [orders, setOrders] = useState(() => getSavedOrders())
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const refresh = () => setOrders(getSavedOrders())
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])
  const latestId = searchParams.get('order')
  return <main className="page"><header className="page-header"><p className="eyebrow">Your orders</p><h1>Order history</h1><p>Prototype order records stay in local storage for this demo.</p></header>{orders.length ? <div className="orders-panel">{orders.map((order) => <div className="order-row" key={order.id}><span className="order-thumb" style={{ background: order.status === 'Processing' ? '#5d45d6' : '#3d9565' }}>{order.id.slice(-2)}</span><div className="order-copy"><b>{order.id}</b><small>{order.date} · {order.status}</small></div><div className="order-meta"><strong>{formatINR(order.total)}</strong><Link className="button tiny" to={`/orders/${order.id}`}>View order</Link></div></div>)}{latestId && <p className="mock-note"><ShieldCheck size={15} /> Your latest order {latestId} is now in the prototype order history.</p>}</div> : <div className="empty-state"><ShoppingBag size={25} /><h2>No orders yet</h2><p>Your completed gifts will show up here.</p><Link className="button primary" to="/gift-cards">Browse gifts</Link></div>}</main>
}

function OrderDetailPage() {
  const { orderId } = useParams()
  const order = getSavedOrders().find((item) => item.id === orderId)
  if (!order) return <main className="page"><header className="page-header"><p className="eyebrow">Order not found</p><h1>We could not find that order.</h1><Link className="button primary" to="/orders">Back to orders</Link></header></main>
  return <main className="page"><header className="page-header"><p className="eyebrow">Order detail</p><h1>{order.id}</h1><p>Status: {order.status}</p></header><section className="panel"><div className="summary" style={{ position: 'static' }}><div><span>Placed</span><b>{order.date}</b></div><div><span>Delivery</span><b>{order.shipping?.city || 'Demo city'}</b></div><div><span>Payment</span><b>{order.paymentMethod || 'Demo wallet'}</b></div><hr /><div className="summary-total"><span>Grand total</span><b>{formatINR(order.total)}</b></div></div></section><section className="cart-list" style={{ marginTop: '20px' }}>{order.items.map((item) => <article className="cart-item" key={`${order.id}-${item.id}`}><div className="mini-visual" style={{ background: item.accent }}>{item.logo}</div><div className="cart-item-copy"><b>{item.name}</b><span>{item.brand} × {item.quantity}</span><strong>{formatINR(item.price * item.quantity)}</strong></div></article>)}</section><Link className="button outline" to="/orders" style={{ marginTop: '20px' }}>Back to all orders</Link></main>
}

function WishlistPage() {
  const { wishlist } = useWishlist()
  return <main className="page"><header className="page-header"><p className="eyebrow">Saved for later</p><h1>Your wishlist</h1></header>{wishlist.length ? <ProductGrid cards={wishlist} /> : <div className="empty-state"><Heart size={25} /><h2>No saved gift cards yet</h2><p>Save an item from its detail page and it will appear here.</p><Link className="button outline" to="/gift-cards">Browse gift cards</Link></div>}</main>
}
function LoginPage({ mode = 'login' }) {
  const { user, login, register, authReady } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isRegister = mode === 'register'

  if (!authReady) {
    return <main className="auth-page"><section className="auth-art"><Brand /><div><p className="eyebrow">Welcome to Giftly</p><h1>Give More.<br /><em>Save More.</em></h1><p>Explore the marketplace and prototype exchange tools.</p></div><small>Loading your secure session…</small></section><section className="auth-form"><p className="eyebrow">Secure access</p><h2>Loading…</h2><p className="muted">Checking your authenticated session.</p></section></main>
  }

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />

  const submit = async (event) => {
    event.preventDefault()

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setMessage('')

      if (isRegister) {
        await register(email, name)
        setMessage('Check your email for the secure sign-in link to complete registration.')
      } else {
        await login(email)
        setMessage('Check your email for the secure sign-in link.')
      }
    } catch (caughtError) {
      console.error('Authentication error:', caughtError)
      setError(caughtError?.message || 'Unable to continue with authentication right now.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-page"><section className="auth-art"><Brand /><div><p className="eyebrow">Welcome to Giftly</p><h1>Give More.<br /><em>Save More.</em></h1><p>Explore the marketplace and prototype exchange tools.</p></div><small>Secure email sign-in · no password required</small></section><section className="auth-form"><p className="eyebrow">{isRegister ? 'Create your account' : 'Welcome back'}</p><h2>{isRegister ? 'Register' : 'Sign in'}</h2><p className="muted">Use a valid email to receive a secure magic link. Your account role is determined by your Supabase profile metadata.</p><div className="auth-mode-toggle" style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}><button type="button" className={`button ${!isRegister ? 'primary' : 'outline'}`} onClick={() => navigate('/login')} style={{ flex: 1 }}>Login</button><button type="button" className={`button ${isRegister ? 'primary' : 'outline'}`} onClick={() => navigate('/register')} style={{ flex: 1 }}>Register</button></div><form onSubmit={submit}>{isRegister && <label>Full name<input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" /></label>}<label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>{error && <p className="error-message" style={{ color: '#d92d20', marginTop: '10px' }}>{error}</p>}{message && <p className="success-message" style={{ color: '#07683d', marginTop: '10px' }}>{message}</p>}<button className="button primary" type="submit" disabled={loading}>{loading ? 'Sending…' : isRegister ? 'Create account' : 'Continue'} <ArrowRight size={16} /></button></form><p className="mock-note"><ShieldCheck size={15} /> This is secure email OTP sign-in with Supabase. No password is stored locally.</p></section></main>
}

function DashboardPage() {
  const { user } = useAuth()
  const {
    selectedCurrency, transactions, marketplaceBalances, marketplaceWallets,
    marketplaceWalletLoading, marketplaceWalletError, refreshMarketplaceWallet,
  } = useWallet()
  const selectedMarketplaceWallet = marketplaceWallets.find((item) => item.currency === selectedCurrency)
  const verificationStatus = user?.verification?.identityStatus || 'Not Started'
  useEffect(() => {
    refreshMarketplaceWallet()
  }, [refreshMarketplaceWallet])
  const formatAmount = (currency, value) => {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value) || 0) }
    catch { return `${currency} ${Number(value) || 0}` }
  }
  return <main className="page dashboard-page">
    <header className="dashboard-welcome"><div><p className="eyebrow">Your Giftly account</p><h1>Welcome back, {user?.name || 'Giftly member'}</h1><p>Your overview of wallet and prototype exchange activity.</p></div><Link className="button primary" to="/marketplace">Explore marketplace <ArrowRight size={15} /></Link></header>
    <div className="dashboard-metrics"><Link to="/wallet" className="dashboard-metric wallet-metric"><span className="dashboard-metric-icon"><WalletIcon size={18} /></span><small>Marketplace wallet · {selectedCurrency}</small><b>{marketplaceWalletLoading ? 'Loading…' : marketplaceWalletError ? 'Unavailable' : selectedMarketplaceWallet ? formatAmount(selectedCurrency, marketplaceBalances[selectedCurrency]) : 'No wallet'}</b><span className="dashboard-metric-foot">{marketplaceWalletError ? 'Unable to load marketplace balance' : selectedMarketplaceWallet ? 'Supabase · read-only balance' : marketplaceWalletLoading ? 'Loading Supabase balance' : `No ${selectedCurrency} wallet`} <ArrowRight size={14} /></span></Link><Link to="/verification" className="dashboard-metric"><span className="dashboard-metric-icon gold"><BadgeCheck size={18} /></span><small>Identity verification</small><b className="dashboard-status-text">{verificationStatus}</b><span className="dashboard-metric-foot">Prototype status <ArrowRight size={14} /></span></Link><Link to="/orders" className="dashboard-metric"><span className="dashboard-metric-icon pink"><ShoppingBag size={18} /></span><small>Orders</small><b className="dashboard-status-text">{getSavedOrders().length}</b><span className="dashboard-metric-foot">View your recent prototype orders <ArrowRight size={14} /></span></Link></div>
    <section className="dashboard-quick-section"><div className="dashboard-section-heading"><div><p className="eyebrow">Shortcuts</p><h2>Quick actions</h2></div></div><div className="dashboard-grid"><Link className="dashboard-card" to="/gift-cards"><span className="dashboard-card-icon"><Gift size={18} /></span><b>Browse gift cards</b><span>Explore the sample catalog</span><ChevronRight size={16} /></Link><Link className="dashboard-card" to="/sell-method"><span className="dashboard-card-icon"><ArrowUpRight size={18} /></span><b>Sell a gift card</b><span>Start with card verification</span><ChevronRight size={16} /></Link><Link className="dashboard-card" to="/wallet/deposit"><span className="dashboard-card-icon"><WalletIcon size={18} /></span><b>Add demo funds</b><span>Simulated wallet activity</span><ChevronRight size={16} /></Link><Link className="dashboard-card" to="/gift-card-verification"><span className="dashboard-card-icon"><ShieldCheck size={18} /></span><b>Verify a gift card</b><span>Mock OCR and balance check</span><ChevronRight size={16} /></Link></div></section>
    <section className="dashboard-transactions"><div className="dashboard-section-heading"><div><p className="eyebrow">Demo Wallet · local history</p><h2>Demo transactions</h2></div><Link className="text-link" to="/wallet/transactions">View demo history <ArrowRight size={14} /></Link></div>{transactions.length ? <div className="dashboard-transaction-list">{transactions.slice(0, 4).map((item) => <Link to={`/wallet/transactions/${item.id}`} key={item.id}><span className="dashboard-transaction-icon"><WalletIcon size={16} /></span><span className="dashboard-transaction-copy"><b>{item.description || item.type.replaceAll('_', ' ')}</b><small>{new Date(item.createdAt).toLocaleDateString()} · {item.status}</small></span><strong>{formatAmount(item.currency, item.amount)}</strong><ChevronRight size={15} /></Link>)}</div> : <div className="dashboard-empty"><span>No demo wallet activity yet</span><Link to="/wallet">Open your Demo Wallet <ArrowRight size={14} /></Link></div>}</section>
    <TradingActivity />
    <EscrowActivity />
  </main>
}

function ProfilePage() {
  const { user } = useAuth()
  return <main className="page"><header className="page-header"><p className="eyebrow">Account settings</p><h1>Your profile</h1><p>Local prototype account details.</p></header><section className="panel profile-panel"><div><span>Name</span><b>{user?.name}</b></div><div><span>Email</span><b>{user?.email}</b></div><div><span>Role</span><b>{user?.role === 'admin' ? 'Admin demo' : 'Customer'}</b></div><p className="mock-note"><ShieldCheck size={15} /> Authentication and account data are stored locally for this prototype.</p><Link className="button outline" to="/verification">Manage verification</Link></section></main>
}

function SupportPage() {
  return <main className="page"><header className="page-header"><p className="eyebrow">Giftly Exchange</p><h1>Support</h1><p>Support messaging is not connected in this prototype. For now, review the relevant workflow notice or return to your dashboard.</p></header><Link className="button outline" to="/dashboard">Back to dashboard</Link></main>
}

function LegacySellRoute() {
  const location = useLocation()
  return <Navigate to={`/sell-method${location.search}`} replace />
}

function RequireCustomer() {
  const { user, authReady } = useAuth()
  const location = useLocation()
  if (!authReady) return <main className="page"><p>Loading your session…</p></main>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function AdminLayout() {
  const { user, logout } = useAuth()
  const adminLinks = [
    ['/admin', LayoutDashboard, 'Overview'], ['/admin/verifications', BadgeCheck, 'KYC reviews'],
    ['/admin/gift-card-verifications', Gift, 'Gift card checks'], ['/admin/trading', BriefcaseBusiness, 'Trading'],
    ['/admin/escrow', ShieldCheck, 'Escrow'], ['/admin/deliveries', PackageCheck, 'Deliveries'], ['/admin/disputes', ShieldCheck, 'Disputes'],
    ['/admin/wallet', WalletIcon, 'Wallet'],
    ['/admin/operations', Activity, 'Operations'], ['/admin/notifications', Bell, 'Notifications'],
    ['/admin/gift-cards', Gift, 'Gift cards'], ['/admin/categories', LayoutDashboard, 'Categories'],
    ['/admin/orders', ShoppingBag, 'Orders'], ['/admin/users', CircleUserRound, 'Users'],
    ['/admin/exchanges', ArrowUpRight, 'Exchanges'], ['/admin/offers', Sparkles, 'Offers'],
    ['/admin/settings', Settings2, 'Settings'], ['/admin/fraud', ShieldAlert, 'Fraud'],
  ]
  return <div className="admin-layout"><aside className="admin-sidebar"><Brand /><span className="admin-label">Operations</span>{adminLinks.map(([href, Icon, label]) => <NavLink end={href === '/admin'} to={href} key={href}><Icon size={16} />{label}</NavLink>)}<Link className="back-store" to="/"><ArrowRight size={15} /> Back to storefront</Link></aside><div className="admin-content"><header className="admin-top"><span>Giftly Exchange · Prototype operations</span><span className="admin-user"><span className="avatar">{user?.name?.slice(0, 1) || 'A'}</span>{user?.name}<button className="admin-signout" onClick={logout}>Sign out</button></span></header><Outlet /></div></div>
}

function AdminHome() {
  return <OperationsPage master />
}

function NotFoundPage() {
  return <main className="page"><p className="eyebrow">Page not found</p><h1>That Giftly page is not available.</h1><p className="muted">This route may not be part of the current prototype.</p><Link className="button primary" to="/">Return home</Link></main>
}

function ApplicationRoutes() {
  return <Routes>
    <Route element={<StorefrontLayout />}>
      <Route index element={<StoreHome />} />
      <Route path="gift-cards" element={<CatalogPage />} />
      <Route path="categories/:category" element={<CatalogPage />} />
      <Route path="gift-cards/:id" element={<GiftCardDetailPage />} />
      <Route path="offers" element={<OffersPage />} />
      <Route path="marketplace" element={<MarketplaceListingsPage />} />
      <Route path="marketplace/:listingId" element={<ListingDetailPage />} />
      <Route path="auctions" element={<AuctionMarketplacePage />} />
      <Route path="auctions/:auctionId" element={<AuctionDetailPage />} />
      <Route path="login" element={<LoginPage mode="login" />} />
      <Route path="register" element={<LoginPage mode="register" />} />
      <Route path="support" element={<SupportPage />} />
      <Route path="terms" element={<LegalPage page="terms" />} />
      <Route path="privacy" element={<LegalPage page="privacy" />} />
      <Route path="compliance" element={<LegalPage page="compliance" />} />
      <Route path="security" element={<LegalPage page="security" />} />
      <Route path="how-it-works" element={<LegalPage page="how-it-works" />} />
      <Route path="cart" element={<CartPage />} />
      <Route path="sell-gift-card" element={<LegacySellRoute />} />
      <Route element={<RequireCustomer />}>
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderDetailPage />} />
        <Route path="order-success" element={<OrderSuccessPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="wishlist" element={<WishlistPage />} />
        <Route path="verification" element={<VerificationPage />} />
        <Route path="gift-card-verification" element={<GiftCardVerificationPage />} />
        <Route path="gift-card-verifications" element={<GiftCardVerificationHistoryPage />} />
        <Route path="sell-method" element={<SellMethodPage />} />
        <Route path="sell/instant" element={<InstantCashoutPage />} />
        <Route path="sell/p2p" element={<P2PCreatePage />} />
        <Route path="sell/auction" element={<AuctionCreatePage />} />
        <Route path="my-listings" element={<MyListingsPage />} />
        <Route path="my-bids" element={<MyBidsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="transactions/:id" element={<TransactionDetailPage />} />
        <Route path="my-escrows" element={<MyEscrowsPage />} />
        <Route path="escrow/:escrowId" element={<EscrowDetailPage />} />
        <Route path="deliveries" element={<DeliveriesPage />} />
        <Route path="delivery/:deliveryId" element={<DeliveryPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="disputes" element={<DisputesPage />} />
        <Route path="disputes/:id" element={<DisputeDetailPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="wallet/cashout" element={<MarketplaceCashoutPage />} />
        <Route path="wallet/deposit" element={<WalletDepositPage />} />
        <Route path="wallet/withdraw" element={<WalletWithdrawPage />} />
        <Route path="wallet/convert" element={<WalletConvertPage />} />
        <Route path="wallet/transactions" element={<WalletTransactionsPage />} />
        <Route path="wallet/transactions/:transactionId" element={<WalletTransactionDetailPage />} />
      </Route>
    </Route>
    <Route element={<RequireAdmin />}>
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="gift-cards" element={<AdminManagementPage key="gift-cards" section="gift-cards" />} />
        <Route path="categories" element={<AdminManagementPage key="categories" section="categories" />} />
        <Route path="orders" element={<AdminManagementPage key="orders" section="orders" />} />
        <Route path="users" element={<AdminManagementPage key="users" section="users" />} />
        <Route path="exchanges" element={<AdminManagementPage key="exchanges" section="exchanges" />} />
        <Route path="offers" element={<AdminManagementPage key="offers" section="offers" />} />
        <Route path="settings" element={<AdminManagementPage key="settings" section="settings" />} />
        <Route path="fraud" element={<AdminFraudPage />} />
        <Route path="verifications" element={<AdminVerificationsPage />} />
        <Route path="gift-card-verifications" element={<AdminGiftCardVerificationsPage />} />
        <Route path="trading" element={<AdminTradingPage />} />
        <Route path="escrow" element={<AdminEscrowDashboardPage />} />
        <Route path="escrow/:escrowId" element={<EscrowDetailPage />} />
        <Route path="deliveries" element={<AdminDeliveriesPage />} />
        <Route path="disputes" element={<AdminDisputesPage />} />
        <Route path="wallet" element={<AdminWalletPage />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
}

function App() {
  return <AuthProvider><CartProvider><WishlistProvider><WalletProvider><BrowserRouter><ApplicationRoutes /></BrowserRouter></WalletProvider></WishlistProvider></CartProvider></AuthProvider>
}

export default App
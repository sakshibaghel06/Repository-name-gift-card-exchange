import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowRight, BadgeCheck, Bell, Clock3, Gift, Gavel, Landmark, PackageCheck, RefreshCw, ShieldCheck, ShoppingBag, Wallet } from 'lucide-react'
import { useAuth } from './contexts'
import { getAdminOperationsSnapshot } from './services/adminPrototypeService'
import './Operations.css'

const metricIcons = { users: BadgeCheck, kyc: ShieldCheck, 'gift-card-checks': Gift, escrows: LockIcon, disputes: AlertTriangle, fraud: AlertTriangle, cashouts: Wallet, deliveries: PackageCheck, p2p: ShoppingBag, auctions: Gavel, wallet: Landmark, orders: ShoppingBag, 'gift-cards': Gift }

function LockIcon(props) { return <ShieldCheck {...props} /> }

export function OperationsPage({ master = false }) {
  const { user } = useAuth()
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('ALL')
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const next = await getAdminOperationsSnapshot(user)
        if (active) { setSnapshot(next); setError('') }
      } catch (issue) { if (active) setError(issue.message || 'Operations data is unavailable.') }
      finally { if (active) setLoading(false) }
    }
    refresh()
    const refreshOnChange = () => refresh()
    const events = ['giftly-admin-data-change', 'giftly-wallet-change', 'giftly-trading-change', 'giftly-escrow-change', 'giftly-delivery-change', 'giftly-notification-change']
    events.forEach((eventName) => window.addEventListener(eventName, refreshOnChange))
    return () => { active = false; events.forEach((eventName) => window.removeEventListener(eventName, refreshOnChange)) }
  }, [user])

  const visibleActivity = snapshot?.recentActivity.filter((item) => filter === 'ALL' || item.type === filter) || []
  return <main className="admin-page operations-page">
    <header className="admin-heading"><div><p className="eyebrow">Giftly Exchange · Prototype operations</p><h1>{master ? 'Admin Dashboard' : 'Operations Center'}</h1><p className="admin-verification-intro">Live counts from existing local prototype records. This is not a production operations system.</p></div><span className="operations-refresh"><RefreshCw size={14} /> Local data</span></header>
    {error && <p className="operations-feedback" role="alert">{error}</p>}
    {loading ? <div className="operations-loading"><span className="delivery-spinner" /><b>Reading prototype operations data</b></div> : <>
      <section className="operations-metrics" aria-label="Operational metrics">{snapshot?.metrics.map((metric) => { const Icon = metricIcons[metric.id] || Activity; return <Link className={`operations-metric tone-${metric.tone}`} to={metric.href} key={metric.id}><span><Icon size={17} /></span><small>{metric.label}</small><b>{metric.value}</b><ArrowRight className="operations-metric-arrow" size={14} /></Link> })}</section>
      <div className="operations-content-grid"><section className="operations-activity-panel"><header><div><p className="eyebrow">Local prototype records</p><h2>Recent activity</h2></div><label>Type<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All activity</option>{['ESCROW', 'DELIVERY', 'TRADE', 'AUCTION', 'WALLET', 'VERIFICATION', 'GIFT_CARD', 'DISPUTE', 'SYSTEM', 'SECURITY'].map((type) => <option key={type}>{type}</option>)}</select></label></header>{visibleActivity.length ? <div className="operations-activity-list">{visibleActivity.map((item) => <Link to={item.href} key={`${item.type}-${item.id}`}><span className="operations-activity-icon"><Clock3 size={15} /></span><span><b>{item.label}</b><small>{item.type} · {new Date(item.at).toLocaleString()}</small></span><ArrowRight size={14} /></Link>)}</div> : <div className="operations-empty"><Activity size={20} /><p>No matching activity records yet.</p></div>}</section>
        <aside className="operations-shortcuts"><p className="eyebrow">Review queues</p><h2>Quick actions</h2><Link to="/admin/verifications"><BadgeCheck size={16} /><span><b>Identity reviews</b><small>Open KYC prototype queue</small></span><ArrowRight size={14} /></Link><Link to="/admin/gift-card-verifications"><Gift size={16} /><span><b>Gift-card checks</b><small>Review simulated results</small></span><ArrowRight size={14} /></Link><Link to="/admin/disputes"><AlertTriangle size={16} /><span><b>Disputes</b><small>Open transaction issues</small></span><ArrowRight size={14} /></Link><Link to="/admin/deliveries"><PackageCheck size={16} /><span><b>Deliveries</b><small>Inspect masked handoffs</small></span><ArrowRight size={14} /></Link><Link to="/admin/notifications"><Bell size={16} /><span><b>Notifications</b><small>Inspect local event records</small></span><ArrowRight size={14} /></Link></aside></div>
      <p className="operations-disclaimer"><ShieldCheck size={14} /> Payments, KYC, retailer checks, risk indicators, wallet conversion, escrow, email, and SMS are prototype simulations.</p>
    </>}
  </main>
}

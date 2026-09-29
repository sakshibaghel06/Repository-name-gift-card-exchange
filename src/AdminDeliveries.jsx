import { useEffect, useMemo, useState } from 'react'
import { Ban, BellRing, CalendarClock, Mail, PackageCheck, Search, ShieldCheck, Smartphone } from 'lucide-react'
import { useAuth } from './contexts'
import { cancelDelivery, DELIVERY_CHANGE_EVENT, getAdminDeliveries } from './services/deliveryService'
import './AdminDeliveries.css'

const statuses = ['All statuses', 'PENDING', 'DELIVERED', 'VIEWED', 'FAILED', 'CANCELLED']
const channels = { IN_APP: { label: 'In-App', Icon: BellRing }, EMAIL: { label: 'Email', Icon: Mail }, SMS: { label: 'SMS', Icon: Smartphone } }
const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

function maskParty(email, role) {
  const suffix = String(email || '').replace(/[^a-z\d]/gi, '').slice(-4).toUpperCase() || 'USER'
  return `${role} #${suffix}`
}

function Status({ value }) {
  const status = value || 'PENDING'
  return <span className={`admin-delivery-status status-${status.toLowerCase()}`}>{status}</span>
}

export function AdminDeliveriesPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('All statuses')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => {
      try {
        const current = getAdminDeliveries(user)
        if (active) { setRecords(current); setError('') }
      } catch (issue) {
        if (active) setError(issue.message || 'Delivery records could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }
    refresh()
    window.addEventListener(DELIVERY_CHANGE_EVENT, refresh)
    return () => { active = false; window.removeEventListener(DELIVERY_CHANGE_EVENT, refresh) }
  }, [user])

  const visibleRecords = useMemo(() => records.filter((record) => {
    const statusMatches = filter === 'All statuses' || record.status === filter
    const searchMatches = `${record.deliveryId} ${record.escrowId} ${record.transactionId} ${record.brand} ${record.buyerId} ${record.sellerId}`.toLowerCase().includes(query.trim().toLowerCase())
    return statusMatches && searchMatches
  }), [records, filter, query])

  const stopDelivery = (record) => {
    if (!window.confirm(`Cancel delivery ${record.deliveryId}? This updates prototype delivery state only.`)) return
    try {
      const updated = cancelDelivery(record.id, user)
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice(`${record.deliveryId} cancelled in the prototype.`)
      setError('')
    } catch (issue) { setError(issue.message || 'This delivery could not be cancelled.') }
  }

  return <main className="admin-page admin-deliveries-page">
    <header className="admin-heading"><div><p className="eyebrow">Customer operations</p><h1>Gift Card Deliveries</h1><p className="admin-verification-intro">Review masked delivery metadata and simulated channel activity.</p></div><span className="admin-delivery-label"><ShieldCheck size={15} /> Prototype workflow</span></header>
    <div className="admin-delivery-notice"><PackageCheck size={16} /><span>Email and SMS statuses are simulated. No real delivery provider or secure backend is connected.</span></div>
    <div className="admin-delivery-toolbar"><label className="admin-delivery-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search delivery, escrow, transaction, or party" aria-label="Search deliveries" /></label><label className="admin-delivery-filter">Status<select value={filter} onChange={(event) => setFilter(event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div>
    {error && <p className="admin-delivery-feedback error" role="alert">{error}</p>}{notice && <p className="admin-delivery-feedback" role="status">{notice}</p>}
    {loading ? <div className="admin-delivery-empty"><span className="delivery-spinner" /><b>Loading delivery records</b></div> : visibleRecords.length ? <section className="admin-delivery-grid" aria-label="Delivery records">{visibleRecords.map((record) => <article className="admin-delivery-card" key={record.id}>
      <div className="admin-delivery-card-top"><div><p className="eyebrow">{record.deliveryId}</p><h2>{record.brand}</h2></div><Status value={record.status} /></div>
      <div className="admin-delivery-parties"><span><small>Buyer</small><b>{maskParty(record.buyerId, 'Buyer')}</b></span><span><small>Seller</small><b>{maskParty(record.sellerId, 'Seller')}</b></span></div>
      <dl className="admin-delivery-facts"><div><dt>Escrow</dt><dd>{record.escrowId}</dd></div><div><dt>Transaction</dt><dd>{record.transactionId}</dd></div><div><dt>Created</dt><dd>{dateTime(record.createdAt)}</dd></div><div><dt>Delivered</dt><dd>{dateTime(record.deliveredAt)}</dd></div><div><dt>Viewed</dt><dd>{dateTime(record.viewedAt)}</dd></div><div><dt>Card</dt><dd>{record.maskedCardNumber || '••••'}</dd></div></dl>
      <div className="admin-delivery-channels"><b>Channel statuses</b><div>{Object.entries(channels).map(([key, { label, Icon }]) => { const channel = record.channels?.find((item) => item.channel === key); return <span key={key} title={`${label}: ${channel?.status || 'PENDING'}`}><Icon size={14} /><small>{label}</small><strong className={`channel-${(channel?.status || 'PENDING').toLowerCase()}`}>{channel?.status || 'PENDING'}</strong></span> })}</div></div>
      <div className="admin-delivery-actions"><span><CalendarClock size={14} /> Updated {dateTime(record.viewedAt || record.deliveredAt || record.createdAt)}</span>{record.status !== 'CANCELLED' && <button type="button" onClick={() => stopDelivery(record)}><Ban size={14} /> Cancel delivery</button>}</div>
    </article>)}</section> : <div className="admin-delivery-empty"><span><PackageCheck size={22} /></span><h2>{records.length ? 'No matching deliveries' : 'No delivery records yet'}</h2><p>{records.length ? 'Change the status filter or search terms.' : 'Delivery records appear after a seller marks a gift card delivered.'}</p></div>}
    {!loading && <p className="admin-delivery-count">Showing {visibleRecords.length} of {records.length} delivery records</p>}
  </main>
}
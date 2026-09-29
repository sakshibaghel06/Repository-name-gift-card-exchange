import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuth } from './contexts'
import { DELIVERY_CHANGE_EVENT, DELIVERY_NOTICE, getUserDeliveries } from './services/deliveryService'
import './Deliveries.css'

const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

function Status({ value }) {
  const status = value || 'PENDING'
  return <span className={`deliveries-status status-${status.toLowerCase()}`}>{status}</span>
}

export function DeliveriesPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const refresh = () => {
      try {
        const current = getUserDeliveries(user.email)
        if (active) { setRecords(current); setError('') }
      } catch (issue) {
        if (active) setError(issue.message || 'Deliveries could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }
    refresh()
    window.addEventListener(DELIVERY_CHANGE_EVENT, refresh)
    return () => { active = false; window.removeEventListener(DELIVERY_CHANGE_EVENT, refresh) }
  }, [user.email])

  return <main className="page deliveries-page">
    <header className="deliveries-heading"><div><p className="eyebrow">Your account · Secure delivery</p><h1>My Deliveries</h1><p>View the status and simulated channel activity for your gift-card handoffs.</p></div><Link className="button outline" to="/my-escrows"><ShieldCheck size={15} /> My escrows</Link></header>
    <div className="deliveries-prototype-note"><ShieldCheck size={16} /><span>{DELIVERY_NOTICE}</span></div>
    {error && <div className="deliveries-feedback error" role="alert">{error}</div>}
    {loading ? <div className="deliveries-state"><span className="delivery-spinner" /><b>Loading deliveries</b><small>Reading your prototype delivery records…</small></div> : records.length ? <section className="delivery-record-grid" aria-label="Your delivery records">{records.map((record) => <article className="delivery-record-card" key={record.id}>
      <div className="delivery-record-top"><span className="delivery-record-icon"><PackageCheck size={18} /></span><Status value={record.status} /></div>
      <p className="eyebrow">{record.deliveryId}</p><h2>{record.brand}</h2>
      <dl><div><dt>Transaction</dt><dd>{record.transactionId}</dd></div><div><dt>Created</dt><dd>{dateTime(record.createdAt)}</dd></div></dl>
      <div className="delivery-record-footer"><span>{record.currency} · {record.maskedCardNumber || '••••'}</span><Link to={`/delivery/${record.id}`}>Open delivery <ArrowRight size={14} /></Link></div>
    </article>)}</section> : <section className="deliveries-state empty"><span><PackageCheck size={24} /></span><h2>No deliveries yet</h2><p>Deliveries connected to your buyer or seller transactions will appear here.</p><Link className="button primary" to="/marketplace">Explore marketplace <ArrowRight size={15} /></Link></section>}
    {!loading && records.length > 0 && <p className="deliveries-footnote"><RefreshCw size={13} /> Delivery status updates as prototype escrow activity changes.</p>}
  </main>
}
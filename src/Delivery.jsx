import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BellRing, Check, CheckCircle2, Clock3, Info, Mail, PackageCheck, ShieldCheck, Smartphone } from 'lucide-react'
import { useAuth } from './contexts'
import { DELIVERY_CHANGE_EVENT, DELIVERY_NOTICE, getDelivery, markViewed } from './services/deliveryService'
import { createNotification } from './services/notificationService'
import './Delivery.css'

const channelDetails = {
  IN_APP: { label: 'In-App', Icon: BellRing },
  EMAIL: { label: 'Email', Icon: Mail },
  SMS: { label: 'SMS', Icon: Smartphone },
}

const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet'
const money = (currency, amount) => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount) || 0) }
  catch { return `${currency} ${Number(amount) || 0}` }
}

function DeliveryStatus({ status }) {
  const value = status || 'PENDING'
  return <span className={`delivery-status status-${value.toLowerCase()}`}>{value.replaceAll('_', ' ')}</span>
}

function DeliveryNotice() {
  return <div className="delivery-prototype-notice"><Info size={16} /><span>{DELIVERY_NOTICE}</span></div>
}

export function DeliveryPage() {
  const { deliveryId } = useParams()
  const { user } = useAuth()
  const [delivery, setDelivery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [opened, setOpened] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = () => {
      try {
        const record = getDelivery(deliveryId, user)
        if (active) {
          setDelivery(record)
          setOpened(user?.email === record.buyerId && record.status === 'VIEWED')
          setError('')
        }
      } catch (issue) {
        if (active) { setDelivery(null); setError(issue.message || 'This delivery is unavailable.') }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    window.addEventListener(DELIVERY_CHANGE_EVENT, load)
    return () => { active = false; window.removeEventListener(DELIVERY_CHANGE_EVENT, load) }
  }, [deliveryId, user])

  const openDelivery = () => {
    try {
      const firstView = delivery.status !== 'VIEWED'
      const updated = markViewed(delivery.id, user)
      setDelivery(updated)
      setOpened(true)
      setError('')
      if (firstView && delivery.sellerId) createNotification({ userId: delivery.sellerId, type: 'DELIVERY', title: 'Buyer viewed the delivery', message: `The buyer opened the ${delivery.brand} prototype delivery.`, relatedId: delivery.id, relatedType: 'DELIVERY', href: `/delivery/${delivery.id}`, dedupeKey: `delivery-viewed:${delivery.id}` })
    } catch (issue) { setError(issue.message || 'This delivery could not be opened.') }
  }

  if (loading) return <main className="page delivery-page"><div className="delivery-loading"><span className="delivery-spinner" /><b>Loading delivery</b><small>Checking delivery access…</small></div></main>
  if (error || !delivery) return <main className="page delivery-page"><Link className="back-link" to="/deliveries"><ArrowLeft size={15} /> My deliveries</Link><section className="delivery-state-card"><span><Info size={22} /></span><h1>{error.includes('not available') ? 'Delivery unavailable' : 'Delivery not found'}</h1><p>{error || 'This delivery ID is invalid or no longer exists.'}</p><Link className="button outline" to="/deliveries">Back to deliveries</Link></section></main>

  const isBuyer = user?.email === delivery.buyerId
  const canOpen = isBuyer && ['DELIVERED', 'VIEWED'].includes(delivery.status)
  const timeline = [
    ['Created', delivery.createdAt],
    ['Delivered', delivery.deliveredAt],
    ['Viewed by buyer', delivery.viewedAt],
  ]

  return <main className="page delivery-page">
    <Link className="back-link" to="/deliveries"><ArrowLeft size={15} /> My deliveries</Link>
    <header className="delivery-page-heading"><div><p className="eyebrow">Secure delivery · {delivery.deliveryId}</p><h1>{delivery.brand} gift card</h1><p>Transaction {delivery.transactionId} · Escrow {delivery.escrowId}</p></div><DeliveryStatus status={delivery.status} /></header>
    <DeliveryNotice />
    {delivery.status === 'CANCELLED' && <div className="delivery-alert cancelled"><Info size={17} /><span>This delivery was cancelled. Secure delivery details are unavailable.</span></div>}
    {error && <div className="delivery-alert error" role="alert"><Info size={17} /><span>{error}</span></div>}
    <div className="delivery-detail-layout">
      <div className="delivery-main-column">
        <section className="delivery-panel delivery-summary-panel"><div className="delivery-panel-heading"><span className="delivery-heading-icon"><PackageCheck size={19} /></span><div><p className="eyebrow">Delivery reference</p><h2>{delivery.deliveryId}</h2></div><DeliveryStatus status={delivery.status} /></div>
          <dl className="delivery-facts"><div><dt>Brand</dt><dd>{delivery.brand}</dd></div><div><dt>Face value</dt><dd>{money(delivery.currency, delivery.faceValue)}</dd></div><div><dt>Currency</dt><dd>{delivery.currency}</dd></div><div><dt>Transaction reference</dt><dd>{delivery.transactionId}</dd></div><div><dt>Escrow reference</dt><dd>{delivery.escrowId}</dd></div><div><dt>Created</dt><dd>{dateTime(delivery.createdAt)}</dd></div></dl>
        </section>
        <section className="delivery-panel"><div className="delivery-section-heading"><div><p className="eyebrow">Delivery channels</p><h2>Notifications for this handoff</h2></div></div><div className="delivery-channel-list">{Object.entries(channelDetails).map(([channel, { label, Icon }]) => {
          const channelRecord = delivery.channels?.find((item) => item.channel === channel)
          const simulated = channel !== 'IN_APP'
          return <article className="delivery-channel" key={channel}><span className="delivery-channel-icon"><Icon size={18} /></span><div><b>{label}</b><small>{simulated ? 'Simulated only · no provider is connected' : 'Available in the in-app prototype'}</small></div><span className={`channel-state ${channelRecord?.status?.toLowerCase() || 'pending'}`}>{channelRecord?.status || 'PENDING'}</span></article>
        })}</div></section>
        <section className="delivery-panel"><div className="delivery-section-heading"><div><p className="eyebrow">Activity</p><h2>Delivery timeline</h2></div></div><ol className="delivery-timeline">{timeline.map(([label, date], index) => <li className={date ? 'complete' : ''} key={label}><span>{date ? <Check size={14} /> : index + 1}</span><div><b>{label}</b><small>{dateTime(date)}</small></div></li>)}</ol></section>
      </div>
      <aside className="delivery-side-column"><section className="delivery-panel delivery-secure-card"><span className="delivery-secure-icon"><ShieldCheck size={21} /></span><p className="eyebrow">Masked card details</p><h2>{opened ? 'Delivery opened' : 'Secure delivery'}</h2>{opened ? <dl className="delivery-masked-facts"><div><dt>Card number</dt><dd>{delivery.maskedCardNumber || '•••• •••• ••••'}</dd></div><div><dt>PIN</dt><dd>••••</dd></div><div><dt>Face value</dt><dd>{money(delivery.currency, delivery.faceValue)}</dd></div></dl> : <p>Only masked gift-card information is available in this prototype. Full card numbers and PINs are never stored or displayed.</p>}
          {canOpen && !opened && <button className="button primary full" onClick={openDelivery}><ShieldCheck size={16} /> Open secure delivery</button>}
          {!isBuyer && <p className="delivery-role-note">Only the authorized buyer can open this delivery.</p>}
          {delivery.status === 'PENDING' && <p className="delivery-role-note">This delivery is not ready to be opened yet.</p>}
        </section><section className="delivery-panel delivery-date-panel"><p className="eyebrow">Timestamps</p><div><Clock3 size={15} /><span><small>Delivered</small><b>{dateTime(delivery.deliveredAt)}</b></span></div><div><CheckCircle2 size={15} /><span><small>Viewed</small><b>{dateTime(delivery.viewedAt)}</b></span></div></section>
      </aside>
    </div>
  </main>
}
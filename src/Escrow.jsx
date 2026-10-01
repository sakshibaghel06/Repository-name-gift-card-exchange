import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './contexts'
import {
  addEvidence, adminOpenDispute, adminReviewEscrow, confirmGiftCard, deliverGiftCard,
  getAdminEscrows, getCurrentSessionEvidence, getDispute, getDisputes,
  getEscrow, getUserEscrows, openDispute, resolveDisputeRecord,
  setDisputeUnderReview,
} from './services/escrowService'
import { createDelivery, getDeliveryByEscrow } from './services/deliveryService'
import { createNotification } from './services/notificationService'
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2,
  ChevronRight, Clock3, FileText, Gift, Info, LockKeyhole, MessageSquareWarning,
  PackageCheck, ShieldCheck, ShoppingBag, Upload, UserRound, X,
} from 'lucide-react'
import './Escrow.css'

const money = (currency, amount) => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount) || 0) } catch { return `${currency} ${Number(amount) || 0}` }
}
const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const dateOnly = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function maskedParty(email, label) {
  const suffix = String(email || '').replace(/[^a-z\d]/gi, '').slice(-4).toUpperCase() || 'GIFT'
  return `${label} #${suffix}`
}

function EscrowStatus({ value }) {
  const normalized = String(value || 'CREATED').toLowerCase().replaceAll('_', '-')
  return <span className={`escrow-status escrow-${normalized}`}>{String(value || 'CREATED').replaceAll('_', ' ')}</span>
}

function PageHeader({ eyebrow, title, text, action }) {
  return <header className="escrow-page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>{action}</header>
}

function PrototypeNotice({ children = 'Prototype escrow workflow — no real funds are held or transferred by this prototype.' }) {
  return <div className="escrow-notice"><Info size={16} /><span>{children}</span></div>
}

function EscrowTimeline({ escrow }) {
  const stage = escrow.status === 'RELEASED' || escrow.status === 'RESOLVED' || escrow.status === 'EXPIRED' || escrow.status === 'CANCELLED' ? 5
    : escrow.status === 'DISPUTED' ? 5
      : escrow.deliveryStatus === 'DELIVERED' ? 3
        : escrow.cardStatus === 'LOCKED' ? 2
          : escrow.paymentStatus === 'SIMULATED_PAID' ? 1 : 0
  const entries = [
    ['Purchase Created', Boolean(escrow.createdAt)],
    ['Payment Secured', escrow.paymentStatus === 'SIMULATED_PAID'],
    ['Gift Card Locked', escrow.cardStatus !== 'AVAILABLE'],
    ['Gift Card Delivered', escrow.deliveryStatus === 'DELIVERED' || escrow.deliveryStatus === 'CONFIRMED'],
    ['Buyer Verification', ['BUYER_REVIEW', 'DISPUTED', 'RELEASED', 'RESOLVED', 'EXPIRED'].includes(escrow.status)],
    [escrow.status === 'DISPUTED' ? 'Dispute Review' : 'Release / Dispute', ['RELEASED', 'RESOLVED', 'DISPUTED', 'EXPIRED', 'CANCELLED'].includes(escrow.status)],
  ]
  return <ol className="escrow-timeline">{entries.map(([label, complete], index) => <li className={`${complete ? 'complete' : ''} ${index === stage && !['RELEASED', 'RESOLVED', 'EXPIRED', 'CANCELLED'].includes(escrow.status) ? 'current' : ''}`} key={label}><span>{complete ? <Check size={14} /> : index + 1}</span><b>{label}</b></li>)}</ol>
}

function ProtectionPanel() {
  return <aside className="escrow-protection-panel"><div><ShieldCheck size={20} /><b>How Giftly Protection Works</b></div><ol><li>Buyer starts a purchase</li><li>Prototype payment is recorded</li><li>Seller's verified gift card is locked</li><li>Seller marks the card delivered</li><li>Buyer verifies the simulated details</li><li>Transaction is completed or disputed</li></ol><PrototypeNotice>No real funds are held or transferred by this prototype. This is not a real escrow service.</PrototypeNotice></aside>
}

function DetailGrid({ escrow }) {
  const rows = [
    ['Brand', escrow.brand], ['Amount', money(escrow.currency, escrow.amount)], ['Currency', escrow.currency],
    ['Buyer', maskedParty(escrow.buyerId, 'Buyer')], ['Seller', maskedParty(escrow.sellerId, 'Verified Seller')],
    [escrow.databaseBacked ? 'Order ID' : 'Transaction ID', escrow.databaseBacked ? escrow.orderId : escrow.transactionId], ['Escrow ID', escrow.escrowId], ['Created date', dateTime(escrow.createdAt)],
  ]
  return <dl className="escrow-detail-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

function EvidencePicker({ files, setFiles }) {
  const previews = useMemo(() => files.map((file) => ({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' })), [files])
  useEffect(() => () => previews.forEach(({ url }) => { if (url) URL.revokeObjectURL(url) }), [previews])
  return <div className="escrow-evidence-picker"><label><Upload size={16} /> Add receipt, screenshot, or purchase proof<input type="file" accept="image/*,.pdf" multiple onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files || [])])} /></label>{previews.map(({ file, url }, index) => <div className="escrow-evidence-file" key={`${file.name}-${index}`}>{url ? <img src={url} alt={`Evidence preview ${index + 1}`} /> : <FileText size={19} />}<span>{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}><X size={14} /></button></div>)}<small>Evidence files remain in this browser session and are not saved to localStorage.</small></div>
}

function ConfirmationDialog({ onClose, onConfirm, busy }) {
  const [checked, setChecked] = useState(false)
  return <div className="escrow-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="escrow-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-release-title"><button className="escrow-modal-close" onClick={onClose} aria-label="Close confirmation"><X size={18} /></button><span className="escrow-modal-mark"><CheckCircle2 size={22} /></span><p className="eyebrow">Buyer confirmation</p><h2 id="confirm-release-title">Confirm that the gift card details and balance are valid.</h2><label className="escrow-consent"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span>I confirm that the gift card is valid and the displayed balance is correct.</span></label><PrototypeNotice>Prototype settlement completed. No real funds will be transferred.</PrototypeNotice><div className="escrow-modal-actions"><button className="button outline" onClick={onClose}>Go back</button><button className="button primary" disabled={!checked || busy} onClick={onConfirm}>{busy ? 'Confirming…' : 'Confirm & Release'}</button></div></section></div>
}

function AdminActionDialog({ action, onClose, onConfirm, busy }) {
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState(false)
  return <div className="escrow-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="escrow-modal" role="dialog" aria-modal="true" aria-labelledby="admin-action-title"><button className="escrow-modal-close" onClick={onClose} aria-label="Close confirmation"><X size={18} /></button><span className="escrow-modal-mark"><ShieldCheck size={22} /></span><p className="eyebrow">Prototype admin action</p><h2 id="admin-action-title">{action.label}</h2><p className="escrow-modal-copy">This action changes mock transaction records only. No real funds are moved.</p>{action.note && <label className="escrow-field">Review note<textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional context for the review" /></label>}<label className="escrow-consent"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span>I understand this is a prototype action, not a real financial operation.</span></label><div className="escrow-modal-actions"><button className="button outline" onClick={onClose}>Cancel</button><button className="button primary" disabled={!checked || busy} onClick={() => onConfirm(note)}>{busy ? 'Saving…' : 'Confirm action'}</button></div></section></div>
}

export function EscrowDetailPage() {
  const { escrowId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [escrow, setEscrow] = useState(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [problem, setProblem] = useState('')
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState([])
  const [safeCardOpen, setSafeCardOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [adminAction, setAdminAction] = useState(null)
  const isAdmin = user?.role === 'admin'
  const isBuyer = user?.email === escrow?.buyerId
  const isSeller = user?.email === escrow?.sellerId
  const showSafeCard = isBuyer && ['DELIVERED', 'CONFIRMED'].includes(escrow?.deliveryStatus)
  const deliveryRecord = escrow ? getDeliveryByEscrow(escrow.id) : null

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const nextEscrow = await getEscrow(escrowId, user)
        if (active) {
          setEscrow(nextEscrow)
          setError('')
          if (nextEscrow?.deliveryStatus === 'DELIVERED' && nextEscrow.status === 'BUYER_REVIEW' && user.email === nextEscrow.sellerId && !getDeliveryByEscrow(nextEscrow.id)) {
            const delivery = createDelivery(nextEscrow, user)
            createNotification({ userId: nextEscrow.buyerId, type: 'DELIVERY', title: 'Gift-card delivery is ready', message: `${nextEscrow.brand} delivery is available in the prototype.`, relatedId: delivery.id, relatedType: 'DELIVERY', href: `/delivery/${delivery.id}`, dedupeKey: `delivery-ready:${delivery.id}` })
          }
        }
      } catch (issue) { if (active) setError(issue.message) }
      if (active) setReady(true)
    }
    refresh()
    window.addEventListener('giftly-escrow-change', refresh)
    return () => { active = false; window.removeEventListener('giftly-escrow-change', refresh) }
  }, [escrowId, user])

  const runAction = async (action, fn) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const updated = await fn()
      if (updated?.id === escrow?.id || updated?.escrowId === escrow?.escrowId) setEscrow(updated)
      else setEscrow(await getEscrow(escrowId, user))
      setNotice(action)
      if (action === 'Dispute Submitted' && updated?.sellerId) createNotification({ userId: updated.sellerId, type: 'DISPUTE', title: 'A prototype dispute was opened', message: `A buyer opened a dispute for ${updated.brand || escrow?.brand || 'a transaction'}.`, relatedId: updated.id, relatedType: 'DISPUTE', href: '/admin/disputes', dedupeKey: `dispute-opened:${updated.id}` })
      if (['RELEASED', 'RESOLVED'].includes(updated?.status)) {
        const record = escrow
        for (const userId of [record?.buyerId, record?.sellerId].filter(Boolean)) createNotification({ userId, type: 'ESCROW', title: 'Prototype escrow status updated', message: `The ${record.brand} escrow is now ${updated.status}. No real funds were transferred.`, relatedId: updated.id, relatedType: 'ESCROW', href: `/escrow/${updated.id}`, dedupeKey: `escrow-final:${updated.id}:${updated.status}:${userId}` })
      }
      setDisputeOpen(false)
      setConfirmOpen(false)
      setAdminAction(null)
      if (action === 'Dispute Submitted') navigate(`/disputes/${updated.id}`)
    } catch (issue) { setError(issue.message) }
    setBusy(false)
  }

  const submitDispute = async (event) => {
    event.preventDefault()
    await runAction('Dispute Submitted', async () => {
      const dispute = await openDispute({ escrowId, buyer: user, reason: problem, description, evidence })
      createNotification({ userId: user.email, type: 'DISPUTE', title: 'Prototype dispute opened', message: `Your ${dispute.brand} dispute is recorded for review.`, relatedId: dispute.id, relatedType: 'DISPUTE', href: `/disputes/${dispute.id}`, dedupeKey: `dispute-buyer:${dispute.id}` })
      return dispute
    })
  }

  const completeAdminAction = async (note) => {
    if (!adminAction || !escrow) return
    const handler = adminAction.outcome
      ? () => resolveDisputeRecord(escrow.disputeId, user, adminAction.outcome)
      : adminAction.status === 'OPEN_DISPUTE'
        ? () => adminOpenDispute(escrow.id, user, note)
        : () => adminReviewEscrow(escrow.id, user, adminAction.status, note)
    await runAction(`${adminAction.label} confirmed.`, handler)
  }

  if (!ready) return <main className="page escrow-page"><PageHeader eyebrow="Prototype escrow" title="Loading transaction" text="Checking the escrow record." /></main>
  if (error && !escrow) return <main className="page escrow-page"><PageHeader eyebrow="Escrow access" title="Unable to open escrow" text={error} /><Link className="button outline" to="/my-escrows">My Escrows</Link></main>
  if (!escrow) return <main className="page escrow-page"><PageHeader eyebrow="Escrow" title="Transaction not found" text="This escrow may not exist or may not be available to your account." /><Link to="/my-escrows">My Escrows</Link></main>

  const statusTitle = escrow.databaseBacked ? 'Purchase Pending' : escrow.status === 'RELEASED' ? 'Transaction Completed' : escrow.status === 'DISPUTED' ? 'Dispute Under Review' : escrow.status === 'EXPIRED' ? 'Escrow expired — admin review required' : isSeller ? 'Your Gift Card Is Protected' : 'Gift Card Purchase Protection'
  const statusText = escrow.databaseBacked
    ? 'An order and pending escrow record exist. Payment has not been processed and the gift card has not been locked.'
    : 'Prototype escrow workflow. No real funds are held or transferred by this prototype.'
  return <main className="page escrow-page"><Link className="back-link" to={isAdmin ? '/admin/escrow' : '/my-escrows'}><ArrowLeft size={15} /> {isAdmin ? 'Escrow dashboard' : 'My Escrows'}</Link><PageHeader eyebrow={`${escrow.databaseBacked ? 'Purchase' : 'Escrow'} · ${escrow.escrowId}`} title={statusTitle} text={statusText} action={<EscrowStatus value={escrow.status} />} />
    <div className="escrow-main-layout"><div className="escrow-main-column"><section className="escrow-panel"><div className="escrow-panel-heading"><span><LockKeyhole size={18} /></span><div><b>{escrow.databaseBacked ? 'Purchase request' : 'Escrow overview'}</b><small>{escrow.databaseBacked ? 'Payment has not started' : escrow.status === 'FUNDS_SECURED' ? 'Funds Secured · simulated payment' : `Current stage · ${escrow.status.replaceAll('_', ' ')}`}</small></div><EscrowStatus value={escrow.status} /></div><EscrowTimeline escrow={escrow} /><PrototypeNotice>{escrow.databaseBacked ? 'This record does not represent payment, card custody, or escrow funding.' : 'No real funds are held or transferred by this prototype. The simulated payment status does not represent money custody.'}</PrototypeNotice></section>
      <section className="escrow-panel"><h2>Transaction information</h2><DetailGrid escrow={escrow} /><div className="escrow-status-grid"><div><span>Payment status</span><b>{escrow.paymentStatus.replaceAll('_', ' ')}</b></div><div><span>Card status</span><b>{escrow.cardStatus}</b></div><div><span>Delivery status</span><b>{escrow.deliveryStatus}</b></div><div><span>Buyer confirmation</span><b>{escrow.buyerConfirmation}</b></div><div><span>Dispute status</span><b>{escrow.disputeStatus.replaceAll('_', ' ')}</b></div><div><span>Expires</span><b>{dateTime(escrow.expiresAt)}</b></div></div></section>
      {escrow.cardStatus === 'LOCKED' && isSeller && <section className="escrow-locked-panel"><span><LockKeyhole size={22} /></span><div><h2>Your gift card is locked while this transaction is in escrow.</h2><p>The gift card code remains hidden. Mark delivery only after completing your prototype handoff.</p>{escrow.deliveryStatus === 'PENDING' && <button className="button primary" disabled={busy} onClick={() => runAction('Gift Card Delivered', async () => { const updated = await deliverGiftCard(escrow.id, user); const delivery = createDelivery(updated, user); createNotification({ userId: updated.buyerId, type: 'DELIVERY', title: 'Gift-card delivery is ready', message: `${updated.brand} delivery is available in the prototype.`, relatedId: delivery.id, relatedType: 'DELIVERY', href: `/delivery/${delivery.id}`, dedupeKey: `delivery-ready:${delivery.id}` }); return updated })}><PackageCheck size={16} /> Deliver Gift Card</button>}</div></section>}
      {isSeller && escrow.cardStatus === 'LOCKED' && escrow.deliveryStatus === 'PENDING' && <div className="escrow-seller-protection"><ShieldCheck size={17} /><span><b>Your Gift Card Is Protected</b><small>{escrow.brand} · {money(escrow.currency, escrow.faceValue)} balance · Selling price {money(escrow.currency, escrow.amount)}</small><small>Escrow status: Funds Secured · Card status: Locked · Payment status: Simulated Paid</small></span></div>}
      {isSeller && escrow.deliveryStatus === 'DELIVERED' && <div className="escrow-seller-protection"><CheckCircle2 size={17} /><span><b>Gift Card Delivered</b><small>Waiting for the buyer's prototype verification.</small></span></div>}
        {deliveryRecord && (isBuyer || isSeller) && <div className="escrow-seller-protection"><PackageCheck size={17} /><span><b>Delivery record ready</b><small>{deliveryRecord.deliveryId} · simulated in-app, email, and SMS status</small><Link to={`/delivery/${deliveryRecord.id}`}>View delivery record</Link></span></div>}
      {showSafeCard && <div className="escrow-delivery-actions"><p>Gift Card Ready for Verification</p><button className="button outline" onClick={() => setSafeCardOpen((current) => !current)}>{safeCardOpen ? 'Hide Gift Card' : 'View Gift Card'}</button></div>}
      {showSafeCard && safeCardOpen && <section className="escrow-safe-card"><div><span><Gift size={20} /></span><div><p className="eyebrow">Prototype Secure Delivery</p><h2>Gift Card Ready for Verification</h2></div></div><dl><div><dt>Card number</dt><dd>{escrow.maskedCardNumber}</dd></div><div><dt>PIN</dt><dd>••••</dd></div><div><dt>Balance</dt><dd>{money(escrow.currency, escrow.faceValue)}</dd></div><div><dt>Card status</dt><dd>{escrow.cardStatus}</dd></div></dl><PrototypeNotice>This is a simulated display. No actual card code or PIN is available in the prototype.</PrototypeNotice></section>}
      {isBuyer && escrow.deliveryStatus === 'DELIVERED' && escrow.status === 'BUYER_REVIEW' && <div className="escrow-buyer-actions"><button className="button primary" onClick={() => setConfirmOpen(true)}><CheckCircle2 size={16} /> Confirm Gift Card</button><button className="button outline" onClick={() => setDisputeOpen(true)}><MessageSquareWarning size={16} /> Report a Problem</button></div>}
      {escrow.status === 'RELEASED' && <div className="escrow-complete-panel"><CheckCircle2 size={22} /><div><b>Transaction Completed</b><small>Prototype settlement completed. No real funds were transferred.</small></div></div>}
      {escrow.status === 'EXPIRED' && <div className="escrow-expired-panel"><Clock3 size={20} /><span><b>Escrow expired — admin review required.</b><small>No funds were automatically released. The card remains locked pending admin review.</small></span></div>}
      {escrow.status === 'DISPUTED' && <div className="escrow-dispute-panel"><AlertTriangle size={19} /><span><b>Dispute Submitted</b><small>Funds remain in the prototype workflow for review. This prototype does not hold real money.</small></span>{escrow.disputeId && <Link to={`/disputes/${escrow.disputeId}`}>View dispute</Link>}</div>}
      {error && <p className="escrow-error" role="alert">{error}</p>}{notice && <p className="escrow-success" role="status">{notice}</p>}
      {isAdmin && !escrow.databaseBacked && <section className="escrow-admin-action-panel"><h2>Admin review actions</h2><p>All actions update mock records only.</p><div>{[
        { label: 'Release Transaction', status: 'RELEASED' }, { label: 'Refund Buyer', status: 'REFUNDED' },
        { label: 'Request More Information', status: 'UNDER_REVIEW', note: true }, { label: 'Mark Under Review', status: 'UNDER_REVIEW', note: true },
        ...(!escrow.disputeId && ['FUNDS_SECURED', 'CARD_LOCKED', 'BUYER_REVIEW'].includes(escrow.status) ? [{ label: 'Open Dispute', status: 'OPEN_DISPUTE', note: true }] : []),
        ...(escrow.disputeId ? [{ label: 'Resolve Dispute for Buyer', outcome: 'buyer' }, { label: 'Resolve Dispute for Seller', outcome: 'seller' }] : []),
        ...(escrow.status === 'EXPIRED' ? [{ label: 'Review Expired Escrow', status: 'UNDER_REVIEW', note: true }] : []),
        ...(escrow.deliveredAt ? [] : [{ label: 'Cancel Escrow', status: 'CANCELLED' }]),
      ].map((action) => <button className="button outline" key={action.label} onClick={() => setAdminAction(action)}>{action.label}</button>)}</div></section>}
    </div><div className="escrow-side-column"><section className="escrow-panel escrow-parties"><h2>Transaction parties</h2><div><span className="escrow-party-avatar"><UserRound size={17} /></span><span><small>Buyer</small><b>{maskedParty(escrow.buyerId, 'Buyer')}</b></span></div><div><span className="escrow-party-avatar seller"><BadgeCheck size={17} /></span><span><small>Seller</small><b>{maskedParty(escrow.sellerId, 'Verified Seller')}</b></span></div><div><span className="escrow-party-avatar"><ShoppingBag size={17} /></span><span><small>{escrow.transactionId ? 'Transaction' : 'Order'}</small><b>{escrow.transactionId || escrow.orderId}</b></span></div></section>{escrow.databaseBacked ? <section className="escrow-panel"><h2>Payment and delivery</h2><p>Payment has not been processed. Delivery, release, refund, and dispute actions are not available for this pending record.</p></section> : <><ProtectionPanel /><section className="escrow-panel escrow-side-status"><h2>Gift card verification</h2><b>{escrow.giftCardVerificationStatus}</b><small>Balance check · {escrow.balanceVerificationStatus}</small></section><section className="escrow-panel escrow-side-status"><h2>Prototype risk flags</h2><b>{escrow.riskStatus || 'LOW RISK'}</b><small>{escrow.riskFlags?.length ? escrow.riskFlags.join(', ') : 'No mock risk flags provided.'}</small></section></>}</div></div>
    {confirmOpen && <ConfirmationDialog onClose={() => setConfirmOpen(false)} busy={busy} onConfirm={() => runAction('Transaction Completed', () => confirmGiftCard(escrow.id, user, true))} />}
    {disputeOpen && <div className="escrow-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDisputeOpen(false) }}><form className="escrow-modal dispute-modal" onSubmit={submitDispute} role="dialog" aria-modal="true" aria-labelledby="dispute-modal-title"><button type="button" className="escrow-modal-close" onClick={() => setDisputeOpen(false)} aria-label="Close dispute"><X size={18} /></button><span className="escrow-modal-mark warning"><MessageSquareWarning size={21} /></span><p className="eyebrow">Prototype dispute</p><h2 id="dispute-modal-title">Report a Problem</h2><label className="escrow-field">Problem type<select required value={problem} onChange={(event) => setProblem(event.target.value)}><option value="">Choose a problem</option>{['Invalid Gift Card', 'Incorrect Balance', 'Gift Card Already Used', 'Wrong Gift Card', 'Card Code Not Working', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="escrow-field">Description<textarea required rows="4" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what happened" /></label><EvidencePicker files={evidence} setFiles={setEvidence} /><PrototypeNotice>Prototype escrow protection only. No real funds are held.</PrototypeNotice><div className="escrow-modal-actions"><button type="button" className="button outline" onClick={() => setDisputeOpen(false)}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit Dispute'}</button></div></form></div>}
    {adminAction && <AdminActionDialog action={adminAction} onClose={() => setAdminAction(null)} busy={busy} onConfirm={completeAdminAction} />}
  </main>
}

export function MyEscrowsPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [tab, setTab] = useState('All')
  useEffect(() => {
    let active = true
    const refresh = () => getUserEscrows(user).then((items) => { if (active) setRecords(items) })
    refresh(); window.addEventListener('giftly-escrow-change', refresh)
    return () => { active = false; window.removeEventListener('giftly-escrow-change', refresh) }
  }, [user])
  const tabs = ['All', 'As Buyer', 'As Seller', 'Needs Action', 'Completed', 'Disputed']
  const filtered = records.filter((record) => tab === 'All' || tab === 'As Buyer' && record.buyerId === user.email || tab === 'As Seller' && record.sellerId === user.email || tab === 'Needs Action' && (record.buyerId === user.email && record.status === 'BUYER_REVIEW' || record.sellerId === user.email && record.deliveryStatus === 'PENDING') || tab === 'Completed' && ['RELEASED', 'RESOLVED'].includes(record.status) || tab === 'Disputed' && record.status === 'DISPUTED')
  return <main className="page escrow-page"><PageHeader eyebrow="Protected transactions" title="My Escrows" text="Review your prototype escrow activity as a buyer or seller." action={<Link className="button outline" to="/marketplace">Browse marketplace</Link>} /><PrototypeNotice /><div className="escrow-tabs" role="tablist" aria-label="Filter escrow records">{tabs.map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>{filtered.length ? <div className="escrow-table-wrap"><table className="escrow-table"><thead><tr><th>Escrow ID</th><th>Brand</th><th>Amount</th><th>Role</th><th>Status</th><th>Last updated</th><th>Action</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td>{record.escrowId}</td><td>{record.brand}</td><td>{money(record.currency, record.amount)}</td><td>{record.buyerId === user.email ? 'Buyer' : 'Seller'}</td><td><EscrowStatus value={record.status} /></td><td>{dateTime(record.updatedAt || record.createdAt)}</td><td><Link to={`/escrow/${record.id}`}>View Escrow <ChevronRight size={13} /></Link></td></tr>)}</tbody></table></div> : <div className="escrow-empty"><span><LockKeyhole size={23} /></span><h2>No escrow transactions yet</h2><p>P2P purchases create a prototype escrow record for buyer and seller review.</p><Link className="button primary" to="/marketplace">Browse marketplace</Link></div>}</main>
}

export function DisputesPage() {
  const { user } = useAuth()
  const [disputes, setDisputes] = useState([])
  useEffect(() => {
    let active = true
    const refresh = () => getDisputes(user).then((items) => { if (active) setDisputes(items) })
    refresh(); window.addEventListener('giftly-escrow-change', refresh)
    return () => { active = false; window.removeEventListener('giftly-escrow-change', refresh) }
  }, [user])
  return <main className="page escrow-page"><PageHeader eyebrow="Escrow support" title="Disputes" text="Track prototype transaction issues and review updates." />{disputes.length ? <div className="escrow-table-wrap"><table className="escrow-table"><thead><tr><th>Dispute ID</th><th>Escrow ID</th><th>Transaction</th><th>Brand</th><th>Amount</th><th>Reason</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>{disputes.map((dispute) => <tr key={dispute.id}><td>{dispute.disputeId}</td><td>{dispute.escrowId}</td><td>{dispute.transactionId}</td><td>{dispute.brand}</td><td>{money(dispute.currency, dispute.amount)}</td><td>{dispute.reason}</td><td><EscrowStatus value={dispute.status} /></td><td>{dateOnly(dispute.createdAt)}</td><td><Link to={`/disputes/${dispute.id}`}>View <ChevronRight size={13} /></Link></td></tr>)}</tbody></table></div> : <div className="escrow-empty"><span><MessageSquareWarning size={23} /></span><h2>No disputes</h2><p>Any dispute you submit or are involved in will appear here.</p><Link to="/my-escrows">View my escrows</Link></div>}</main>
}

export function DisputeDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [dispute, setDispute] = useState(null)
  const [error, setError] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [evidenceMessage, setEvidenceMessage] = useState('')
  useEffect(() => {
    let active = true
    const refresh = async () => { try { const item = await getDispute(id, user); if (active) { setDispute(item); setError('') } } catch (issue) { if (active) setError(issue.message) } }
    refresh(); window.addEventListener('giftly-escrow-change', refresh)
    return () => { active = false; window.removeEventListener('giftly-escrow-change', refresh) }
  }, [id, user])
  if (error) return <main className="page escrow-page"><PageHeader eyebrow="Dispute" title="Unable to open dispute" text={error} /><Link to="/disputes">Back to disputes</Link></main>
  if (!dispute) return <main className="page escrow-page"><PageHeader eyebrow="Dispute" title="Loading dispute" text="Checking dispute access." /></main>
  const sessionEvidence = getCurrentSessionEvidence(dispute.id)
  const addMoreEvidence = async (event) => {
    event.preventDefault()
    if (!evidenceFiles.length) return
    setError('')
    try { await addEvidence(dispute.id, user, evidenceFiles); setEvidenceFiles([]); setEvidenceMessage('Evidence added for this browser session.') } catch (issue) { setError(issue.message) }
  }
  return <main className="page escrow-page"><Link className="back-link" to="/disputes"><ArrowLeft size={15} /> Disputes</Link><PageHeader eyebrow={dispute.disputeId} title={dispute.reason} text={`Escrow ${dispute.escrowId} · ${dispute.brand} · ${money(dispute.currency, dispute.amount)}`} action={<EscrowStatus value={dispute.status} />} /><PrototypeNotice>Prototype resolution — no real funds were transferred.</PrototypeNotice><div className="escrow-main-layout"><section className="escrow-panel"><h2>Issue details</h2><DetailGrid escrow={{ ...dispute, createdAt: dispute.createdAt }} /><div className="dispute-description"><b>Buyer description</b><p>{dispute.description}</p></div><div className="escrow-evidence-list"><b>Evidence · {dispute.evidenceCount || 0} items</b>{sessionEvidence.length ? sessionEvidence.map((file, index) => file.type.startsWith('image/') ? <EvidencePreview file={file} key={`${file.name}-${index}`} /> : <span key={`${file.name}-${index}`}><FileText size={15} /> {file.name}</span>) : <small>Uploaded evidence previews are available only in the current browser session and are never persisted.</small>}</div>{user.email === dispute.buyerId && ['OPEN', 'UNDER_REVIEW'].includes(dispute.status) && <form className="escrow-add-evidence" onSubmit={addMoreEvidence}><EvidencePicker files={evidenceFiles} setFiles={setEvidenceFiles} /><button className="button outline" disabled={!evidenceFiles.length}>Add Evidence</button></form>}{evidenceMessage && <p className="escrow-success" role="status">{evidenceMessage}</p>}{error && <p className="escrow-error" role="alert">{error}</p>}<h2 className="escrow-subheading">Dispute timeline</h2><ol className="dispute-timeline">{(dispute.timeline || []).map((event, index) => <li key={`${event.event}-${index}`}><span><CheckCircle2 size={14} /></span><div><b>{event.event}</b><small>{dateTime(event.at)}</small></div></li>)}</ol><div className="escrow-admin-action-panel"><Link className="button outline" to={`/escrow/${dispute.escrowRecordId}`}>View Escrow</Link></div></section><ProtectionPanel /></div></main>
}

export function AdminEscrowDashboardPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [tab, setTab] = useState('All')
  useEffect(() => {
    let active = true
    const refresh = () => getAdminEscrows(user, 'All').then((items) => { if (active) setRecords(items) })
    refresh(); window.addEventListener('giftly-escrow-change', refresh)
    return () => { active = false; window.removeEventListener('giftly-escrow-change', refresh) }
  }, [user])
  const all = records
  const counts = [
    ['Total Escrows', all.length], ['Active Escrows', all.filter((item) => ['FUNDS_SECURED', 'CARD_LOCKED', 'DELIVERED', 'BUYER_REVIEW'].includes(item.status)).length],
    ['Buyer Review', all.filter((item) => item.status === 'BUYER_REVIEW').length], ['Open Disputes', all.filter((item) => item.status === 'DISPUTED').length],
    ['Released', all.filter((item) => ['RELEASED', 'RESOLVED'].includes(item.status)).length], ['Expired', all.filter((item) => item.status === 'EXPIRED').length],
  ]
  const tabs = ['All', 'Active', 'Disputed', 'Released', 'Expired']
  const filtered = records.filter((record) => tab === 'All' || tab === 'Active' && ['FUNDS_SECURED', 'CARD_LOCKED', 'DELIVERED', 'BUYER_REVIEW'].includes(record.status) || tab === 'Disputed' && record.status === 'DISPUTED' || tab === 'Released' && ['RELEASED', 'RESOLVED'].includes(record.status) || tab === 'Expired' && record.status === 'EXPIRED')
  return <div className="admin-page escrow-admin-page"><div className="admin-heading"><div><p className="eyebrow">Protected transaction operations</p><h1>Escrow Dashboard</h1><p className="admin-verification-intro">Prototype escrow records only. No real payment custody is connected.</p></div><span className="escrow-admin-label"><Info size={14} /> Prototype workflow</span></div><div className="escrow-admin-stats">{counts.map(([label, count]) => <div key={label}><span><LockKeyhole size={17} /></span><b>{count}</b><small>{label}</small></div>)}</div><div className="escrow-tabs">{tabs.map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><div className="escrow-table-wrap"><table className="escrow-table"><thead><tr><th>Escrow ID</th><th>Transaction</th><th>Buyer</th><th>Seller</th><th>Brand</th><th>Amount</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td>{record.escrowId}</td><td>{record.transactionId}</td><td>{maskedParty(record.buyerId, 'Buyer')}</td><td>{maskedParty(record.sellerId, 'Seller')}</td><td>{record.brand}</td><td>{money(record.currency, record.amount)}</td><td><EscrowStatus value={record.status} /></td><td>{dateOnly(record.createdAt)}</td><td><Link to={`/admin/escrow/${record.id}`}>View / Review</Link></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="escrow-empty"><span><LockKeyhole size={22} /></span><h2>No escrow records in this view</h2><p>P2P purchases create a prototype escrow record.</p></div>}</div><PrototypeNotice /></div>
}

export function EscrowActivity() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  useEffect(() => {
    let active = true
    const refresh = () => { if (user?.email) getUserEscrows(user).then((items) => { if (active) setRecords(items) }) }
    refresh(); window.addEventListener('giftly-escrow-change', refresh)
    return () => { active = false; window.removeEventListener('giftly-escrow-change', refresh) }
  }, [user])
  const visibleRecords = user?.email ? records.filter((item) => item.buyerId === user.email || item.sellerId === user.email) : []
  const active = visibleRecords.filter((item) => ['FUNDS_SECURED', 'CARD_LOCKED', 'DELIVERED', 'BUYER_REVIEW'].includes(item.status)).length
  const needsAction = visibleRecords.filter((item) => item.buyerId === user?.email && item.status === 'BUYER_REVIEW' || item.sellerId === user?.email && item.cardStatus === 'LOCKED' && item.deliveryStatus === 'PENDING').length
  const disputes = visibleRecords.filter((item) => item.status === 'DISPUTED').length
  const completed = visibleRecords.filter((item) => ['RELEASED', 'RESOLVED'].includes(item.status)).length
  return <section className="escrow-dashboard-activity"><div className="escrow-dashboard-heading"><div><p className="eyebrow">Prototype protection</p><h2>Escrow Activity</h2></div><Link to="/my-escrows">View Escrows <ArrowRight size={14} /></Link></div><div className="escrow-activity-stats"><Link to="/my-escrows"><b>{active}</b><small>Active Escrows</small></Link><Link to="/my-escrows?tab=Needs%20Action"><b>{needsAction}</b><small>Needs Your Action</small></Link><Link to="/disputes"><b>{disputes}</b><small>Open Disputes</small></Link><Link to="/my-escrows?tab=Completed"><b>{completed}</b><small>Completed Escrows</small></Link></div><div className="escrow-dashboard-actions"><Link to="/my-escrows"><LockKeyhole size={15} /> View Escrows</Link><Link to="/disputes"><MessageSquareWarning size={15} /> View Disputes</Link></div></section>
}

function EvidencePreview({ file }) {
  const preview = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(preview), [preview])
  return <img src={preview} alt="Current-session dispute evidence preview" />
}

export function AdminDisputesPage() {
  const { user } = useAuth()
  const [disputes, setDisputes] = useState([])
  const [selected, setSelected] = useState(null)
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = () => getDisputes(user).then((items) => { if (active) setDisputes(items) })
    refresh(); window.addEventListener('giftly-escrow-change', refresh)
    return () => { active = false; window.removeEventListener('giftly-escrow-change', refresh) }
  }, [user])
  const evidence = selected ? getCurrentSessionEvidence(selected.id) : []
  const confirmAction = async (note) => {
    setBusy(true); setError(''); setNotice('')
    try {
      if (action.kind === 'BUYER' || action.kind === 'SELLER') await resolveDisputeRecord(selected.id, user, action.kind.toLowerCase())
      else await setDisputeUnderReview(selected.id, user, note)
      setNotice(action.kind === 'BUYER' ? 'Resolved for buyer. Prototype funds status updated to Refunded.' : action.kind === 'SELLER' ? 'Resolved for seller. Prototype transaction released.' : 'Dispute marked under review.')
      setSelected(null); setAction(null); setDisputes(await getDisputes(user))
    } catch (issue) { setError(issue.message) }
    setBusy(false)
  }
  return <div className="admin-page escrow-admin-page"><div className="admin-heading"><div><p className="eyebrow">Trust operations</p><h1>Dispute Review</h1><p className="admin-verification-intro">Review reported P2P issues. All outcomes are prototype state changes.</p></div><span className="escrow-admin-label"><Info size={14} /> Mock review workflow</span></div><PrototypeNotice>Prototype resolution — no real funds were transferred.</PrototypeNotice>{error && <p className="escrow-error" role="alert">{error}</p>}{notice && <p className="escrow-success" role="status">{notice}</p>}<div className="escrow-table-wrap"><table className="escrow-table"><thead><tr><th>Dispute ID</th><th>Escrow ID</th><th>Buyer</th><th>Seller</th><th>Reason</th><th>Amount</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{disputes.map((dispute) => <tr key={dispute.id}><td>{dispute.disputeId}</td><td>{dispute.escrowId}</td><td>{maskedParty(dispute.buyerId, 'Buyer')}</td><td>{maskedParty(dispute.sellerId, 'Seller')}</td><td>{dispute.reason}</td><td>{money(dispute.currency, dispute.amount)}</td><td><EscrowStatus value={dispute.status} /></td><td>{dateOnly(dispute.createdAt)}</td><td><span className="escrow-admin-row-actions"><button onClick={() => setSelected(dispute)}>View Evidence</button><Link to={`/admin/escrow/${dispute.escrowRecordId}`}>Review</Link><button onClick={() => { setSelected(dispute); setAction({ kind: 'BUYER', label: 'Resolve Dispute for Buyer' }) }}>Resolve Buyer</button><button onClick={() => { setSelected(dispute); setAction({ kind: 'SELLER', label: 'Resolve Dispute for Seller' }) }}>Resolve Seller</button><button onClick={() => { setSelected(dispute); setAction({ kind: 'REVIEW', label: 'Request More Information', note: true }) }}>Request information</button></span></td></tr>)}</tbody></table>{disputes.length === 0 && <div className="escrow-empty"><span><MessageSquareWarning size={22} /></span><h2>No disputes to review</h2><p>Buyer disputes will appear here for prototype review.</p></div>}</div>{selected && !action && <div className="escrow-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="escrow-modal evidence-modal" role="dialog" aria-modal="true" aria-labelledby="admin-evidence-title"><button className="escrow-modal-close" onClick={() => setSelected(null)} aria-label="Close evidence"><X size={18} /></button><p className="eyebrow">{selected.disputeId}</p><h2 id="admin-evidence-title">Dispute evidence</h2><p>{selected.reason} · {selected.brand} · {money(selected.currency, selected.amount)}</p><div className="escrow-evidence-list"><b>{selected.evidenceCount || 0} evidence files</b>{evidence.length ? evidence.map((file, index) => file.type.startsWith('image/') ? <EvidencePreview key={`${file.name}-${index}`} file={file} /> : <span key={`${file.name}-${index}`}><FileText size={15} /> {file.name}</span>) : <small>Evidence previews exist only in the submitter's current browser session; no uploaded image is persisted.</small>}</div><PrototypeNotice>Admin review is simulated. No real financial or legal resolution is performed.</PrototypeNotice><Link className="button outline" to={`/admin/escrow/${selected.escrowRecordId}`}>Open escrow detail</Link></section></div>}{action && <AdminActionDialog action={action} onClose={() => setAction(null)} busy={busy} onConfirm={confirmAction} />}</div>
}
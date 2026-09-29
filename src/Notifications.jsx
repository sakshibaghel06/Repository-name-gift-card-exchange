import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Bell, Check, CheckCheck, CircleDollarSign,
  FileCheck2, Gavel, Gift, LockKeyhole, MessageSquareWarning, PackageCheck,
  ShieldCheck, ShoppingBag, Trash2, Wallet,
} from 'lucide-react'
import { useAuth } from './contexts'
import {
  deleteNotification, getAdminNotifications, getUserNotifications,
  markAllAsRead, markAsRead, NOTIFICATION_CHANGE_EVENT, NOTIFICATION_TYPES,
} from './services/notificationService'
import './Notifications.css'

const iconByType = {
  ORDER: ShoppingBag, GIFT_CARD: Gift, VERIFICATION: FileCheck2, ESCROW: ShieldCheck,
  TRADE: CircleDollarSign, AUCTION: Gavel, WALLET: Wallet, DISPUTE: MessageSquareWarning,
  DELIVERY: PackageCheck, FRAUD: AlertTriangle, SECURITY: LockKeyhole, SYSTEM: Bell,
}
const dateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

function NotificationRow({ notification, onRead, onDelete, admin = false }) {
  const Icon = iconByType[notification.type] || Bell
  const content = <><span className="notification-type-icon"><Icon size={18} /></span><span className="notification-copy"><span className="notification-row-heading"><b>{notification.title}</b>{!notification.read && <i>New</i>}</span><span>{notification.message}</span><small>{notification.type.replaceAll('_', ' ')} · {dateTime(notification.createdAt)}{admin ? ` · ${notification.userId}` : ''}</small></span></>
  return <article className={`notification-row ${notification.read ? 'is-read' : 'is-unread'}`}>
    {notification.href ? <Link className="notification-row-main" to={notification.href} onClick={() => !notification.read && onRead(notification)}>{content}</Link> : <div className="notification-row-main">{content}</div>}
    <div className="notification-row-actions">{!notification.read && <button title="Mark as read" aria-label={`Mark ${notification.title} as read`} onClick={() => onRead(notification)}><Check size={16} /></button>}<button title="Delete notification" aria-label={`Delete ${notification.title}`} onClick={() => onDelete(notification)}><Trash2 size={16} /></button>{notification.href && <Link to={notification.href} className="notification-open" aria-label={`Open ${notification.title}`}><ArrowRight size={16} /></Link>}</div>
  </article>
}

function NotificationList({ admin = false }) {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [scope, setScope] = useState('ALL')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const refresh = () => {
      try {
        setRecords(admin ? getAdminNotifications(user) : getUserNotifications(user.email))
        setError('')
      } catch (issue) { setError(issue.message || 'Notifications could not be loaded.') }
    }
    refresh()
    window.addEventListener(NOTIFICATION_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(NOTIFICATION_CHANGE_EVENT, refresh)
  }, [admin, user])

  const filtered = useMemo(() => records.filter((item) => (filter === 'ALL' || item.type === filter) && (scope === 'ALL' || (scope === 'UNREAD' ? !item.read : item.read))), [records, filter, scope])
  const unreadCount = records.filter((item) => !item.read).length
  const actor = user
  const handleRead = (item) => {
    try { markAsRead(item.notificationId, actor); setNotice('Notification marked as read.') }
    catch (issue) { setError(issue.message || 'Could not update notification.') }
  }
  const handleDelete = (item) => {
    if (!window.confirm(`Delete the notification “${item.title}”?`)) return
    try { deleteNotification(item.notificationId, actor); setNotice('Notification deleted.') }
    catch (issue) { setError(issue.message || 'Could not delete notification.') }
  }
  const handleReadAll = () => {
    try { markAllAsRead(actor); setNotice('All notifications marked as read.') }
    catch (issue) { setError(issue.message || 'Could not update notifications.') }
  }

  return <main className={`page notifications-page ${admin ? 'admin-notifications-page' : ''}`}>
    <header className="notifications-heading"><div><p className="eyebrow">{admin ? 'Operations · Inbox audit' : 'Your account · Updates'}</p><h1>{admin ? 'Notification Management' : 'Notifications'}</h1><p>{admin ? 'Inspect prototype notifications across local demo accounts.' : 'Updates from your Giftly prototype activity.'}</p></div>{unreadCount > 0 && <button className="button outline" onClick={handleReadAll}><CheckCheck size={15} /> Mark all read <span className="notification-unread-count">{unreadCount}</span></button>}</header>
    {!admin && <div className="notification-prototype-note"><Bell size={15} /> Notifications are saved in this browser only. They do not represent production alerts.</div>}
    {error && <p className="notification-feedback error" role="alert">{error}</p>}{notice && <p className="notification-feedback" role="status">{notice}</p>}
    <div className="notification-toolbar"><div className="notification-scope-tabs" role="tablist" aria-label="Read status filter">{[['ALL', 'All'], ['UNREAD', 'Unread'], ['READ', 'Read']].map(([value, label]) => <button key={value} role="tab" aria-selected={scope === value} className={scope === value ? 'active' : ''} onClick={() => setScope(value)}>{label}{value === 'UNREAD' && <small>{unreadCount}</small>}</button>)}</div><label>Type<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All types</option>{NOTIFICATION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label></div>
    {filtered.length ? <section className="notification-list">{filtered.map((item) => <NotificationRow key={item.notificationId} notification={item} onRead={handleRead} onDelete={handleDelete} admin={admin} />)}</section> : <section className="notification-empty"><span><Bell size={23} /></span><h2>{records.length ? 'No notifications in this view' : 'You are all caught up'}</h2><p>{records.length ? 'Choose another type or read-status filter.' : admin ? 'Prototype notification events will appear here when flows generate them.' : 'Activity updates from verification, wallet, trading, escrow, and delivery will appear here.'}</p>{!admin && <Link className="button outline" to="/gift-cards">Explore Giftly <ArrowRight size={14} /></Link>}</section>}
    <p className="notification-record-count">Showing {filtered.length} of {records.length} notifications</p>
  </main>
}

export function NotificationsPage() { return <NotificationList /> }
export function AdminNotificationsPage() { return <NotificationList admin /> }

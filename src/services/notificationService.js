const STORAGE_KEY = 'giftly-notifications'
export const NOTIFICATION_CHANGE_EVENT = 'giftly-notification-change'
export const NOTIFICATION_TYPES = ['ORDER', 'GIFT_CARD', 'VERIFICATION', 'ESCROW', 'TRADE', 'AUCTION', 'WALLET', 'DISPUTE', 'DELIVERY', 'FRAUD', 'SECURITY', 'SYSTEM']

function read() {
  try {
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(records) ? records : []
  } catch { return [] }
}

function write(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  window.dispatchEvent(new CustomEvent(NOTIFICATION_CHANGE_EVENT))
  return records
}

function requireUser(actor) {
  if (!actor?.email) throw new Error('Sign in to manage notifications.')
}

function canManage(notification, actor) {
  requireUser(actor)
  if (actor.role !== 'admin' && notification.userId !== actor.email) throw new Error('This notification is not available to your account.')
}

export function createNotification({ userId, type = 'SYSTEM', title, message, relatedId = null, relatedType = null, href = null, dedupeKey = null }) {
  if (!userId || !String(title || '').trim() || !String(message || '').trim()) throw new Error('A user, title, and message are required for a notification.')
  const current = read()
  if (dedupeKey) {
    const existing = current.find((item) => item.userId === String(userId) && item.dedupeKey === String(dedupeKey))
    if (existing) return existing
  }
  const normalizedType = NOTIFICATION_TYPES.includes(type) ? type : 'SYSTEM'
  const record = {
    notificationId: `ntf-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    userId: String(userId), type: normalizedType,
    title: String(title).trim().slice(0, 100), message: String(message).trim().slice(0, 240),
    createdAt: new Date().toISOString(), read: false, status: 'UNREAD',
    relatedId: relatedId == null ? null : String(relatedId).slice(0, 100),
    relatedType: relatedType ? String(relatedType).slice(0, 40) : null,
    href: href ? String(href).slice(0, 200) : null,
    dedupeKey: dedupeKey ? String(dedupeKey).slice(0, 150) : null,
  }
  try { write([record, ...current]) } catch { return null }
  return record
}

export function getNotifications() {
  return read().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function getUserNotifications(userId) {
  if (!userId) return []
  return getNotifications().filter((item) => item.userId === userId)
}

export function getUnreadCount(userId) {
  return getUserNotifications(userId).filter((item) => !item.read && item.status !== 'READ').length
}

export function getAdminNotifications(actor) {
  requireUser(actor)
  if (actor.role !== 'admin') throw new Error('Admin access is required to inspect all notifications.')
  return getNotifications()
}

export function markAsRead(notificationId, actor) {
  const record = read().find((item) => item.notificationId === notificationId)
  if (!record) throw new Error('Notification not found.')
  canManage(record, actor)
  const updated = { ...record, read: true, status: 'READ', readAt: record.readAt || new Date().toISOString() }
  write(read().map((item) => item.notificationId === notificationId ? updated : item))
  return updated
}

export function markAllAsRead(actor) {
  requireUser(actor)
  const now = new Date().toISOString()
  const records = read().map((item) => actor.role === 'admin' || item.userId === actor.email
    ? { ...item, read: true, status: 'READ', readAt: item.readAt || now }
    : item)
  write(records)
  return records.filter((item) => actor.role === 'admin' || item.userId === actor.email)
}

export function deleteNotification(notificationId, actor) {
  const record = read().find((item) => item.notificationId === notificationId)
  if (!record) return false
  canManage(record, actor)
  write(read().filter((item) => item.notificationId !== notificationId))
  return true
}

export function clearNotifications(actor) {
  requireUser(actor)
  write(actor.role === 'admin' ? [] : read().filter((item) => item.userId !== actor.email))
}

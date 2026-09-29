import { useEffect, useMemo, useState } from 'react'
import { Ban, Check, Eye, Info, Plus, Search, Settings2, ShieldAlert, Trash2, X } from 'lucide-react'
import { useAuth } from './contexts'
import { SUPPORTED_CURRENCIES } from './services/walletService'
import { getAdminCollection, saveAdminCollection, saveAdminSettings } from './services/adminPrototypeService'
import './AdminManagement.css'

const configuration = {
  'gift-cards': { title: 'Gift Cards', eyebrow: 'Catalog management', searchable: ['brand', 'name', 'category', 'id'], editable: ['brand', 'name', 'category', 'value', 'discount'], statuses: ['Active', 'Inactive'] },
  categories: { title: 'Categories', eyebrow: 'Catalog structure', searchable: ['name'], editable: ['name', 'count'], statuses: ['Active', 'Inactive'] },
  orders: { title: 'Orders', eyebrow: 'Prototype order records', searchable: ['id', 'status', 'date'], statuses: ['Processing', 'Delivered', 'Cancelled', 'Refunded'] },
  users: { title: 'Users', eyebrow: 'Known local account metadata', searchable: ['email', 'name', 'role', 'verificationStatus'] },
  exchanges: { title: 'Exchanges', eyebrow: 'Prototype exchange requests', searchable: ['id', 'brand', 'status'], statuses: ['Pending Review', 'Under Review', 'Paid', 'Rejected'] },
  offers: { title: 'Offers', eyebrow: 'Promotional catalog content', searchable: ['title', 'detail', 'code'], editable: ['title', 'detail', 'code', 'discount', 'validFrom', 'validUntil'], statuses: ['Active', 'Inactive'] },
}

const isActive = (record) => record.active !== false && !['Inactive', 'Disabled'].includes(record.status)

function loadSection(section, user) {
  try {
    const result = getAdminCollection(section, user)
    return { records: section === 'settings' ? [] : result, settings: section === 'settings' ? result : null, error: '' }
  } catch (issue) { return { records: [], settings: null, error: issue.message || 'Admin records are unavailable.' } }
}

export function AdminManagementPage({ section }) {
  const { user } = useAuth()
  const config = configuration[section]
  const [initialData] = useState(() => loadSection(section, user))
  const [records, setRecords] = useState(initialData.records)
  const [settings, setSettings] = useState(initialData.settings)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(initialData.error)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const refresh = () => {
      const next = loadSection(section, user)
      setRecords(next.records)
      setSettings(next.settings)
      setError(next.error)
    }
    window.addEventListener('giftly-admin-data-change', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('giftly-admin-data-change', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [section, user])

  const filtered = useMemo(() => records.filter((record) => {
    const text = (config?.searchable || []).map((key) => record[key]).join(' ').toLowerCase()
    const matchesText = text.includes(query.trim().toLowerCase())
    const matchesStatus = status === 'All statuses' || (status === 'Active' ? isActive(record) : status === 'Inactive' ? !isActive(record) : record.status === status)
    return matchesText && matchesStatus
  }), [records, config, query, status])

  if (section === 'settings') return <SettingsPage settings={settings} setSettings={setSettings} user={user} error={error} notice={notice} setError={setError} setNotice={setNotice} />
  if (!config) return <main className="admin-page"><h1>Admin section unavailable</h1></main>

  const save = (next) => {
    try {
      const updated = saveAdminCollection(section, next, user)
      setRecords(updated)
      setNotice('Prototype records updated in this browser.')
      setError('')
    } catch (issue) { setError(issue.message || 'Could not save this change.') }
  }
  const submitRecord = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(config.editable.map((field) => [field, form.get(field)]))
    const updated = editing.id
      ? records.map((record) => record.id === editing.id ? { ...record, ...values, ...(fieldExists('active', record) ? { active: record.active } : {}) } : record)
      : [{ id: `${section}-${Date.now()}`, ...values, active: true, ...defaults(section, values) }, ...records]
    save(updated)
    setEditing(null)
  }
  const toggleActive = (record) => save(records.map((item) => item.id === record.id ? { ...item, active: !isActive(item), status: ['orders', 'exchanges'].includes(section) ? item.status : undefined } : item))
  const changeStatus = (record, nextStatus) => save(records.map((item) => item.id === record.id ? { ...item, status: nextStatus, ...(section === 'gift-cards' || section === 'categories' || section === 'offers' ? { active: nextStatus === 'Active' } : {}) } : item))
  const remove = (record) => {
    if (!window.confirm(`Delete ${record.name || record.title || record.brand || record.id} from prototype ${config.title.toLowerCase()}?`)) return
    save(records.filter((item) => item.id !== record.id))
  }

  return <main className="admin-page admin-management-page">
    <header className="admin-heading"><div><p className="eyebrow">{config.eyebrow}</p><h1>{config.title}</h1><p className="admin-verification-intro">Local prototype records only. No production account or checkout system is connected.</p></div>{config.editable && <button className="button primary" onClick={() => setEditing({})}><Plus size={15} /> Add {section === 'gift-cards' ? 'gift card' : section === 'categories' ? 'category' : 'offer'}</button>}</header>
    {error && <p className="admin-management-feedback error" role="alert">{error}</p>}{notice && <p className="admin-management-feedback" role="status">{notice}</p>}
    <div className="admin-management-toolbar"><label className="admin-management-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}`} aria-label={`Search ${config.title.toLowerCase()}`} /></label>{config.statuses && <label className="admin-management-filter">Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option>{config.statuses.map((item) => <option key={item}>{item}</option>)}</select></label>}</div>
    {filtered.length ? <div className="admin-management-table-wrap"><table className="admin-management-table"><thead><tr>{tableHeaders(section).map((header) => <th key={header}>{header}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}>{rowCells(section, record).map((value, index) => <td key={`${record.id}-${index}`}>{value}</td>)}<td><div className="admin-management-actions"><button onClick={() => setSelected(record)} aria-label={`View ${record.name || record.title || record.brand || record.id}`}><Eye size={14} /> View</button>{config.editable && <button onClick={() => setEditing(record)} aria-label={`Edit ${record.name || record.title || record.brand || record.id}`}>Edit</button>}{config.statuses && ['gift-cards', 'categories', 'offers'].includes(section) && <button onClick={() => toggleActive(record)}>{isActive(record) ? <><Ban size={13} /> Deactivate</> : <><Check size={13} /> Activate</>}</button>}{['orders', 'exchanges'].includes(section) && <select aria-label={`Update status for ${record.id}`} value={record.status} onChange={(event) => changeStatus(record, event.target.value)}>{config.statuses.map((item) => <option key={item}>{item}</option>)}</select>}{config.editable && <button className="danger" onClick={() => remove(record)} aria-label={`Delete ${record.name || record.title || record.brand || record.id}`}><Trash2 size={13} /> Delete</button>}</div></td></tr>)}</tbody></table></div> : <div className="admin-management-empty"><span><Info size={20} /></span><b>{records.length ? 'No matching records' : `No ${config.title.toLowerCase()} found`}</b><small>{records.length ? 'Try another search or status.' : 'Available prototype records will appear here.'}</small></div>}
    <p className="admin-management-count">Showing {filtered.length} of {records.length} records</p>
    {editing && <RecordDialog section={section} config={config} record={editing} onClose={() => setEditing(null)} onSubmit={submitRecord} />}
    {selected && <RecordDetails section={section} record={selected} onClose={() => setSelected(null)} />}
  </main>
}

function fieldExists(field, record) { return Object.prototype.hasOwnProperty.call(record, field) }

function defaults(section, values) {
  if (section === 'gift-cards') return { discount: Number(values.discount) || 0, value: Number(values.value) || 0, rating: 0, color: '#f1edf8', accent: '#6047bf', logo: String(values.brand || 'G').slice(0, 1) }
  if (section === 'categories') return { count: Number(values.count) || 0, icon: 'Gift', color: '#f1edf8', accent: '#6047bf' }
  if (section === 'offers') return { color: 'lavender', icon: 'Gift' }
  return {}
}

function tableHeaders(section) {
  return {
    'gift-cards': ['Brand', 'Product', 'Category', 'Face value', 'Discount', 'Status'],
    categories: ['Category', 'Catalog count', 'Status'],
    orders: ['Order', 'Date', 'Items', 'Total', 'Status'],
    users: ['User', 'Role', 'Verification', 'Account status', 'Wallet'],
    exchanges: ['Reference', 'Brand', 'Face value', 'Estimated payout', 'Status', 'Date'],
    offers: ['Offer', 'Description', 'Code', 'Discount', 'Validity', 'Status'],
  }[section] || []
}

function rowCells(section, record) {
  if (section === 'gift-cards') return [record.brand, record.name, record.category, formatMoney('INR', record.value), `${record.discount}%`, <span className={`admin-management-status ${isActive(record) ? 'active' : 'inactive'}`} key="status">{isActive(record) ? 'Active' : 'Inactive'}</span>]
  if (section === 'categories') return [record.name, record.count, <span className={`admin-management-status ${isActive(record) ? 'active' : 'inactive'}`} key="status">{isActive(record) ? 'Active' : 'Inactive'}</span>]
  if (section === 'orders') return [record.id, record.date, `${record.items?.length || 0} items`, formatMoney('INR', record.total), <span className="admin-management-status" key="status">{record.status}</span>]
  if (section === 'users') return [record.email, record.role, record.verificationStatus, record.accountStatus, record.walletId || 'No wallet metadata']
  if (section === 'exchanges') return [record.id, record.brand, formatMoney('INR', record.value), formatMoney('INR', record.payout), <span className="admin-management-status" key="status">{record.status}</span>, record.date]
  if (section === 'offers') return [record.title, record.detail, record.code, record.discount ? `${record.discount}%` : '—', [record.validFrom, record.validUntil].filter(Boolean).join(' – ') || 'No dates set', <span className={`admin-management-status ${isActive(record) ? 'active' : 'inactive'}`} key="status">{isActive(record) ? 'Active' : 'Inactive'}</span>]
  return []
}

function formatMoney(currency, amount) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount) || 0) }
  catch { return `${currency} ${amount}` }
}

function RecordDialog({ section, config, record, onClose, onSubmit }) {
  return <div className="admin-management-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="admin-management-dialog" onSubmit={onSubmit} role="dialog" aria-modal="true"><header><div><p className="eyebrow">Prototype {record.id ? 'edit' : 'create'}</p><h2>{record.id ? 'Edit record' : `Add ${section === 'gift-cards' ? 'gift card' : section === 'categories' ? 'category' : 'offer'}`}</h2></div><button type="button" onClick={onClose} aria-label="Close"><X size={17} /></button></header>{config.editable.map((field) => <label key={field}>{fieldLabel(field)}{field === 'detail' ? <textarea name={field} defaultValue={record[field] || ''} rows="3" required /> : <input name={field} defaultValue={record[field] ?? ''} type={['value', 'discount', 'count'].includes(field) ? 'number' : ['validFrom', 'validUntil'].includes(field) ? 'date' : 'text'} min={['value', 'count'].includes(field) ? 0 : undefined} max={field === 'discount' ? 100 : undefined} required={!['validFrom', 'validUntil', 'discount'].includes(field)} />}</label>)}<p className="admin-management-dialog-note"><Info size={14} /> This changes local prototype catalog data only.</p><footer><button type="button" className="button outline" onClick={onClose}>Cancel</button><button className="button primary" type="submit">Save prototype record</button></footer></form></div>
}

function fieldLabel(field) { return field.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()) }

function RecordDetails({ section, record, onClose }) {
  const rows = Object.entries(record).filter(([key, value]) => !['color', 'accent', 'logo', 'items'].includes(key) && (typeof value !== 'object' || value === null)).filter(([key]) => !/password|pin|cvv|cardNumber|document|selfie|bank/i.test(key))
  if (section === 'orders' && Array.isArray(record.items)) rows.push(['items', record.items.map((item) => `${item.brand} × ${item.quantity || 1}`).join(', ') || 'No item details'])
  return <div className="admin-management-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="admin-management-dialog" role="dialog" aria-modal="true"><header><div><p className="eyebrow">{section.replaceAll('-', ' ')} · prototype detail</p><h2>Record details</h2></div><button type="button" onClick={onClose} aria-label="Close"><X size={17} /></button></header><dl className="admin-management-detail-list">{rows.map(([label, value]) => <div key={label}><dt>{fieldLabel(label)}</dt><dd>{String(value ?? '—')}</dd></div>)}</dl><footer><button type="button" className="button outline" onClick={onClose}>Close</button></footer></section></div>
}

function SettingsPage({ settings, setSettings, user, error, notice, setError, setNotice }) {
  const save = (event) => {
    event.preventDefault()
    try { setSettings(saveAdminSettings(settings, user)); setNotice('Prototype settings saved locally.'); setError('') }
    catch (issue) { setError(issue.message || 'Settings could not be saved.') }
  }
  return <main className="admin-page admin-management-page"><header className="admin-heading"><div><p className="eyebrow">Platform configuration</p><h1>Settings</h1><p className="admin-verification-intro">Preferences for this local prototype only. No payment, legal, or security controls are configured here.</p></div><span className="admin-management-settings-label"><Settings2 size={14} /> Prototype settings</span></header>{error && <p className="admin-management-feedback error" role="alert">{error}</p>}{notice && <p className="admin-management-feedback" role="status">{notice}</p>}{!settings ? <div className="admin-management-empty">Settings could not be loaded.</div> : <form className="admin-settings-form" onSubmit={save}><label>Platform name<input value={settings.platformName} onChange={(event) => setSettings((current) => ({ ...current, platformName: event.target.value }))} /></label><label>Default region<input value={settings.defaultRegion} onChange={(event) => setSettings((current) => ({ ...current, defaultRegion: event.target.value }))} /></label><fieldset><legend>Supported wallet currencies</legend><div>{SUPPORTED_CURRENCIES.map((item) => <span key={item.code}>{item.code} · {item.name}</span>)}</div><small>Rates remain fixed DEMO / PROTOTYPE values in the existing wallet service.</small></fieldset><div className="admin-settings-note"><ShieldAlert size={16} /> Payment integrations, production authentication, KYC providers, and fraud controls cannot be configured here.</div><button className="button primary" type="submit">Save prototype settings</button></form>}</main>
}

export function AdminFraudPage() {
  const { allGiftCardVerifications } = useAuth()
  const flagged = allGiftCardVerifications.filter((item) => ['HIGH RISK', 'MEDIUM RISK'].includes(item.riskStatus))
  return <main className="admin-page admin-management-page"><header className="admin-heading"><div><p className="eyebrow">Prototype trust signals</p><h1>Fraud & Risk Review</h1><p className="admin-verification-intro">Rules-based mock indicators from gift-card verification records. Not real AI fraud detection.</p></div><span className="admin-management-settings-label"><ShieldAlert size={14} /> Simulation</span></header><div className="admin-management-feedback">No real fraud decision or blocking action is performed by this prototype.</div>{flagged.length ? <div className="admin-management-table-wrap"><table className="admin-management-table"><thead><tr><th>Reference</th><th>User</th><th>Brand</th><th>Masked card</th><th>Risk level</th><th>Flags</th><th>Date</th></tr></thead><tbody>{flagged.map((record) => <tr key={record.id}><td>{record.referenceId}</td><td>{record.userName || 'Giftly member'}</td><td>{record.brand}</td><td>{record.maskedCardNumber}</td><td><span className="admin-management-status inactive">{record.riskStatus}</span></td><td>{record.riskFlags?.join(', ') || 'Prototype flag'}</td><td>{new Date(record.submittedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <div className="admin-management-empty"><span><ShieldAlert size={20} /></span><b>No prototype risk flags</b><small>Only local mock risk metadata is shown here.</small></div>}</main>
}

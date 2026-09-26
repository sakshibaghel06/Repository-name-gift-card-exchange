/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './contexts'
import { calculateVerificationRisk, checkGiftCardBalance, maskedNumber, scanGiftCardImage, verifyGiftCardDetails } from './services/giftCardVerification'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, ChevronRight,
  CircleAlert, Clock3, FileImage, FileText, Info, LockKeyhole, RefreshCw,
  ScanLine, ShieldCheck, Sparkles, Upload, X,
} from 'lucide-react'
import './GiftCardVerification.css'

const steps = ['Card Details', 'Upload Card', 'Verify Details', 'Balance Check', 'Result']
const countries = [
  ['India', 'INR'], ['United States', 'USD'], ['United Kingdom', 'GBP'],
  ['Canada', 'CAD'], ['Australia', 'AUD'], ['Singapore', 'SGD'],
  ['United Arab Emirates', 'AED'], ['Germany', 'EUR'],
]
const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
const maxFileSize = 10 * 1024 * 1024
const emptyDetails = { brand: '', country: 'India', currency: 'INR', cardType: 'Physical Gift Card', cardNumber: '', pin: '', expiry: '', ownership: false }
const sequence = ['Connecting to verification service', 'Validating gift card', 'Checking balance', 'Completing verification']
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const currentSessionUploads = new Map()

export const getCurrentSessionUploads = (id) => currentSessionUploads.get(id) || null

function referenceId() {
  const suffix = Math.floor(100000 + Math.random() * 900000)
  return `GX-VER-${new Date().getFullYear()}-${suffix}`
}

function formatBalance(currency, value) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value) } catch { return `${currency} ${value}` }
}

function ProgressSteps({ current }) {
  return <ol className="gc-stepper" aria-label="Gift card verification progress">{steps.map((label, index) => <li className={current > index + 1 ? 'complete' : current === index + 1 ? 'current' : ''} key={label}><span>{current > index + 1 ? <Check size={14} /> : index + 1}</span><small>{label}</small></li>)}</ol>
}

function SessionImage({ file, alt, className }) {
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  return <img className={className} src={previewUrl} alt={alt} />
}

function FileField({ label, file, onChange, onRemove, required = false, onError }) {
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  const validate = (picked) => {
    if (!picked) return
    if (!allowedTypes.includes(picked.type)) { onError('Use a PNG, JPG, JPEG, or WEBP image.'); return }
    if (picked.size > maxFileSize) { onError('Each image must be 10 MB or smaller.'); return }
    onError('')
    onChange(picked)
  }
  return <div className="gc-file-field"><span className="gc-file-label">{label}{required && <i>Required</i>}</span>{file ? <div className="gc-file-ready"><img src={previewUrl} alt={`${label} preview`} /><span><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span><label className="gc-small-icon" title={`Replace ${label}`}><Upload size={16} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => validate(event.target.files?.[0])} /></label><button className="gc-small-icon remove" type="button" onClick={onRemove} aria-label={`Remove ${label}`}><X size={16} /></button></div> : <label className="gc-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); validate(event.dataTransfer.files?.[0]) }}><FileImage size={23} /><b>Drag image here or browse files</b><small>PNG, JPG, JPEG, WEBP · Up to 10 MB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => validate(event.target.files?.[0])} /></label>}</div>
}

function CardField({ label, value, onChange, masked = false, type = 'text', required = false, ...props }) {
  const [visible, setVisible] = useState(false)
  return <label className="gc-field">{label}{required && <i>Required</i>}<span className="gc-sensitive-field"><input required={required} type={masked && !visible ? 'password' : type} value={value} onChange={onChange} autoComplete="off" {...props} />{masked && <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Hide ${label}` : `Show ${label}`}>{visible ? 'Hide' : 'Show'}</button>}</span></label>
}

function StatusPill({ status }) {
  const className = status.toLowerCase().replaceAll(' ', '-')
  return <span className={`gc-status gc-status-${className}`}>{status}</span>
}

export function GiftCardVerificationPage() {
  const { user, giftCardVerifications, saveGiftCardVerification } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [details, setDetails] = useState(emptyDetails)
  const [front, setFront] = useState(null)
  const [back, setBack] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [stepError, setStepError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanLines, setScanLines] = useState([])
  const [ocr, setOcr] = useState(null)
  const [ocrAccepted, setOcrAccepted] = useState(false)
  const [editExtracted, setEditExtracted] = useState(false)
  const [balanceLines, setBalanceLines] = useState([])
  const [result, setResult] = useState(null)

  const update = (field) => (event) => setDetails((current) => ({ ...current, [field]: event.target.value }))
  const currencyForCountry = (country) => countries.find(([name]) => name === country)?.[1] || 'USD'
  const goNext = () => {
    setStepError('')
    if (step === 1) {
      if (!details.brand || !details.cardNumber.trim() || !details.pin.trim() || !details.ownership) {
        setStepError('Add the required card details and confirm that you own this card.')
        return
      }
    }
    if (step === 2 && (!front || !back)) {
      setStepError('Upload both the front and back images to continue.')
      return
    }
    if (step === 3 && !ocrAccepted) {
      setStepError('Review and accept the mock OCR result before continuing.')
      return
    }
    setStep(Math.min(5, step + 1))
  }
  const scan = async () => {
    setStepError('')
    setLoading(true)
    setScanLines([])
    const lines = ['Scanning card image...', 'Reading card details...', 'Matching card information...']
    for (const line of lines) {
      await pause(430)
      setScanLines((current) => [...current, line])
    }
    const scanned = await scanGiftCardImage(details)
    setOcr(scanned)
    setOcrAccepted(false)
    setEditExtracted(false)
    setLoading(false)
  }
  const setCurrencyAndCountry = (event) => {
    const country = event.target.value
    setDetails((current) => ({ ...current, country, currency: currencyForCountry(country) }))
  }
  const startBalanceCheck = async () => {
    setStepError('')
    setLoading(true)
    setBalanceLines([])
    for (const line of sequence) {
      await pause(480)
      setBalanceLines((current) => [...current, line])
    }
    const detailResult = await verifyGiftCardDetails(details)
    const balanceResult = await checkGiftCardBalance(details)
    const failedAttempts = Number(sessionStorage.getItem('giftly-card-failed-attempts') || 0) + (detailResult.status === 'SUCCESSFUL' ? 0 : 1)
    sessionStorage.setItem('giftly-card-failed-attempts', String(failedAttempts))
    const risk = await calculateVerificationRisk({ maskedCardNumber: maskedNumber(details.cardNumber), failedAttempts, incomplete: false, manualReview: detailResult.status === 'REQUIRES REVIEW' }, giftCardVerifications)
    const status = detailResult.status === 'SUCCESSFUL' && balanceResult.status === 'VERIFIED' ? 'SUCCESSFUL' : detailResult.status === 'FAILED' || balanceResult.status === 'FAILED' ? 'FAILED' : detailResult.status === 'PARTIALLY VERIFIED' ? 'PARTIALLY VERIFIED' : 'REQUIRES REVIEW'
    const id = `gcv-${Date.now()}`
    const record = {
      id,
      referenceId: referenceId(),
      brand: details.brand,
      country: details.country,
      currency: details.currency,
      cardType: details.cardType,
      maskedCardNumber: maskedNumber(details.cardNumber),
      verificationStatus: status,
      balanceStatus: balanceResult.status,
      mockBalance: balanceResult.balance,
      cardStatus: balanceResult.cardStatus,
      reason: detailResult.reason || balanceResult.reason || '',
      submittedAt: new Date().toISOString(),
      verifiedAt: status === 'SUCCESSFUL' ? new Date().toISOString() : null,
      riskStatus: risk.level,
      riskFlags: risk.flags,
      detailsVerified: detailResult.status === 'SUCCESSFUL',
      userId: user?.email,
      userName: user?.name,
    }
    currentSessionUploads.set(id, { front, back, receipt })
    saveGiftCardVerification(record)
    setResult(record)
    setLoading(false)
    setStep(5)
  }
  const startOver = () => {
    setDetails(emptyDetails)
    setFront(null)
    setBack(null)
    setReceipt(null)
    setStep(1)
    setResult(null)
    setOcr(null)
    setOcrAccepted(false)
    setScanLines([])
    setBalanceLines([])
    setStepError('')
  }
  const sellPath = result ? `/sell-gift-card?verification=${encodeURIComponent(result.id)}` : '/sell-gift-card'

  return <main className="page gc-page">
    <Link className="back-link" to={searchParams.get('returnTo') || '/sell-gift-card'}><ArrowLeft size={16} /> Back</Link>
    <header className="gc-hero"><div><p className="eyebrow">Giftly trust tools</p><h1>Verify Your Gift Card</h1><p>Verify your gift card details before listing or exchanging it.</p></div><span className="gc-hero-icon"><ShieldCheck size={37} /></span></header>
    <section className="gc-prototype-banner"><Info size={17} /><span><b>Prototype simulation</b><small>No real OCR, retailer APIs, or real-time balance checking are connected.</small></span></section>
    <div className="gc-workspace">
      <section className="gc-form-panel">
        <ProgressSteps current={step} />
        {step === 1 && <div className="gc-step-content"><div className="gc-step-heading"><p className="eyebrow">Step 1</p><h2>Card Details</h2><p>Enter the details printed on the gift card.</p></div><div className="gc-form-grid"><label className="gc-field">Gift card brand<i>Required</i><select required value={details.brand} onChange={update('brand')}><option value="">Choose a brand</option>{['Amazon', 'Flipkart', 'Myntra', 'Swiggy', 'Zomato', 'BookMyShow', 'Other'].map((brand) => <option key={brand}>{brand}</option>)}</select></label><label className="gc-field">Country<i>Required</i><select value={details.country} onChange={setCurrencyAndCountry}>{countries.map(([country]) => <option key={country}>{country}</option>)}</select></label><label className="gc-field">Currency<i>Required</i><select value={details.currency} onChange={update('currency')}>{['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'SGD', 'AED'].map((currency) => <option key={currency}>{currency}</option>)}</select></label><label className="gc-field">Card type<i>Required</i><select value={details.cardType} onChange={update('cardType')}><option>Physical Gift Card</option><option>Digital Gift Card</option></select></label><CardField label="Card number" value={details.cardNumber} onChange={update('cardNumber')} masked required placeholder="Enter card number" /><CardField label="PIN / Security code" value={details.pin} onChange={update('pin')} masked required placeholder="Enter PIN or security code" /><CardField label="Expiry date" value={details.expiry} onChange={update('expiry')} type="month" /></div><label className="gc-ownership"><input type="checkbox" checked={details.ownership} onChange={(event) => setDetails((current) => ({ ...current, ownership: event.target.checked }))} /><span>I confirm that I own this gift card and have the right to sell or exchange it.</span></label><div className="gc-security-note"><LockKeyhole size={16} /><span>Never share your gift card PIN outside Giftly Exchange. Full card details are held only in this page's current session and are never saved.</span></div></div>}
        {step === 2 && <div className="gc-step-content"><div className="gc-step-heading"><p className="eyebrow">Step 2</p><h2>Upload Card</h2><p>Upload clear images of both sides of your card.</p></div><div className="gc-upload-grid"><FileField label="Front image" required file={front} onChange={setFront} onRemove={() => setFront(null)} onError={setUploadError} /><FileField label="Back image" required file={back} onChange={setBack} onRemove={() => setBack(null)} onError={setUploadError} /></div><FileField label="Receipt / proof of purchase" file={receipt} onChange={setReceipt} onRemove={() => setReceipt(null)} onError={setUploadError} /><div className="gc-security-note"><LockKeyhole size={16} /><span>Uploaded images are used for verification in this prototype and are not sent to a real retailer or verification provider.</span></div>{uploadError && <p className="gc-error" role="alert">{uploadError}</p>}</div>}
        {step === 3 && <div className="gc-step-content"><div className="gc-step-heading"><p className="eyebrow">Step 3</p><h2>Verify Details</h2><p>Simulate a scan, then review the extracted fields before continuing.</p></div><div className="gc-preview-strip"><SessionImage file={front} alt="Gift card front preview" /><span><b>{details.brand} · {details.cardType}</b><small>Card images available for this session only</small></span></div><div className="gc-demo-label"><ScanLine size={15} /> Mock OCR Result</div>{loading ? <div className="gc-processing" role="status"><span className="gc-spinner" /><div><b>Scanning card image...</b>{scanLines.map((line) => <small key={line}><CheckCircle2 size={13} /> {line}</small>)}</div></div> : ocr ? <div className="gc-ocr-result"><div><span>Brand</span><b>{ocr.brand}</b></div><div><span>Card number</span><b>{ocr.maskedCardNumber}</b></div><div><span>PIN</span><b>{ocr.maskedPin}</b></div><div><span>Expiry</span><b>{ocr.expiry}</b></div><div><span>Detected currency</span><b>{ocr.currency}</b></div><small>{ocr.source}</small>{editExtracted && <div className="gc-ocr-edit"><label className="gc-field">Brand<input value={details.brand} onChange={update('brand')} /></label><CardField label="Card number" value={details.cardNumber} onChange={update('cardNumber')} masked /><CardField label="PIN / Security code" value={details.pin} onChange={update('pin')} masked /><label className="gc-field">Expiry<input type="month" value={details.expiry} onChange={update('expiry')} /></label><label className="gc-field">Currency<select value={details.currency} onChange={update('currency')}>{['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'SGD', 'AED'].map((currency) => <option key={currency}>{currency}</option>)}</select></label><button type="button" className="button outline" onClick={() => setOcr((current) => ({ ...current, brand: details.brand, currency: details.currency, expiry: details.expiry || 'Not detected', maskedCardNumber: maskedNumber(details.cardNumber), maskedPin: details.pin ? `••••${details.pin.slice(-1)}` : 'Not detected' }))}>Update extracted result</button></div>}<div className="gc-ocr-actions"><button type="button" className="button outline" onClick={() => setEditExtracted((current) => !current)}>{editExtracted ? 'Close edit' : 'Edit details'}</button><button type="button" className="button outline" onClick={scan}><RefreshCw size={14} /> Re-scan card</button><button type="button" className="button primary" onClick={() => { setOcr((current) => ({ ...current, brand: details.brand, currency: details.currency, expiry: details.expiry || 'Not detected', maskedCardNumber: maskedNumber(details.cardNumber), maskedPin: details.pin ? `••••${details.pin.slice(-1)}` : 'Not detected' })); setOcrAccepted(true); setStepError('') }}><Check size={15} /> Accept details</button></div>{ocrAccepted && <p className="gc-accepted"><CheckCircle2 size={15} /> Mock extracted details accepted.</p>}</div> : <div className="gc-scan-prompt"><ScanLine size={27} /><b>Ready to scan</b><p>This prototype will simulate reading the images and matching the details you entered.</p><button type="button" className="button primary" onClick={scan}><ScanLine size={16} /> Scan Gift Card</button></div>}</div>}
        {step === 4 && <div className="gc-step-content"><div className="gc-step-heading"><p className="eyebrow">Step 4</p><h2>Balance Check</h2><p>Run a simulated balance check for the gift card.</p></div><div className="gc-balance-panel"><span className="gc-balance-icon"><RefreshCw size={22} /></span><h3>Checking Gift Card Balance</h3><p>Demo balance verification — real retailer balance APIs are not connected yet.</p>{loading ? <ol className="gc-check-list">{sequence.map((line, index) => <li className={balanceLines.includes(line) ? 'done' : ''} key={line}>{balanceLines.includes(line) ? <CheckCircle2 size={16} /> : balanceLines.length === index ? <span className="gc-mini-spinner" /> : <CircleAlert size={15} />} {line}{balanceLines.includes(line) && <b>Complete</b>}</li>)}</ol> : <button className="button primary" type="button" onClick={startBalanceCheck}><RefreshCw size={16} /> Check demo balance</button>}</div><div className="gc-security-note"><Info size={16} /><span>Giftly Exchange prototype verification does not currently connect to retailer systems.</span></div></div>}
        {step === 5 && result && <div className="gc-step-content gc-result-content"><div className="gc-step-heading"><p className="eyebrow">Step 5 · Result</p><h2>Verification result</h2><p>Your card check is complete. This is a prototype simulation.</p></div><div className={`gc-result-banner result-${result.verificationStatus.toLowerCase().replaceAll(' ', '-')}`}><span>{result.verificationStatus === 'SUCCESSFUL' ? <CheckCircle2 size={27} /> : result.verificationStatus === 'FAILED' ? <X size={27} /> : <Clock3 size={27} />}</span><div><b>{result.verificationStatus}</b><small>Reference ID · {result.referenceId}</small></div><StatusPill status={result.verificationStatus} /></div><div className="gc-result-grid"><div><span>Brand</span><b>{result.brand}</b></div><div><span>Card number</span><b>{result.maskedCardNumber}</b></div><div><span>Country / currency</span><b>{result.country} · {result.currency}</b></div><div><span>Available balance</span><b>{result.mockBalance == null ? 'Not available' : formatBalance(result.currency, result.mockBalance)}</b></div><div><span>Card status</span><b>{result.cardStatus || 'Not verified'}</b></div><div><span>Balance status</span><b>{result.balanceStatus}</b></div></div>{result.verificationStatus === 'SUCCESSFUL' ? <div className="gc-result-checks"><p><CheckCircle2 size={17} /> Gift card details verified</p><p><CheckCircle2 size={17} /> Card appears valid</p><p><CheckCircle2 size={17} /> Balance check completed</p><p><CheckCircle2 size={17} /> Ready for listing</p></div> : <div className="gc-failure-reasons"><b>Review notes</b><p><CircleAlert size={15} /> {result.reason || 'Manual review required'}</p>{['Card details could not be matched', 'Image quality insufficient', 'Card information incomplete', 'Balance could not be verified', 'Manual review required'].filter((reason) => reason !== result.reason).slice(0, 2).map((reason) => <small key={reason}>Possible issue: {reason}</small>)}</div>}<div className="gc-prototype-footnote"><Info size={15} /> Demo balance verification — real retailer balance APIs are not connected yet.</div><div className="gc-result-actions"><button className="button outline" type="button" onClick={startOver}>Verify another card</button><Link className="button outline" to="/gift-card-verifications">View history</Link>{result.verificationStatus === 'SUCCESSFUL' && <button className="button primary" type="button" onClick={() => navigate(sellPath)}><ArrowRight size={15} /> Continue to Sell</button>}</div></div>}
        {step < 5 && <div className="gc-form-footer">{step > 1 && <button className="button outline" type="button" onClick={() => { setStep((current) => current - 1); setStepError('') }}><ArrowLeft size={15} /> Back</button>}{step === 3 && !ocrAccepted ? <span className="gc-footer-hint">Scan and accept the mock result to continue</span> : step !== 4 && <button className="button primary" type="button" onClick={goNext}>Continue <ArrowRight size={15} /></button>}</div>}
        {stepError && <p className="gc-error" role="alert">{stepError}</p>}
      </section>
      <aside className="gc-sidebar"><section><span className="gc-sidebar-icon"><Sparkles size={19} /></span><h3>Prototype simulation</h3><p>OCR, card matching, balance verification, and risk checks shown here are simulated for product testing.</p></section><section><span className="gc-sidebar-icon"><LockKeyhole size={19} /></span><h3>Your card data</h3><p>Full card numbers, PINs, and uploaded images are never persisted. Only masked verification metadata is saved.</p></section><Link to="/gift-card-verifications" className="gc-history-link"><FileText size={17} /><span><b>Verification history</b><small>{giftCardVerifications.length} records</small></span><ChevronRight size={16} /></Link></aside>
    </div>
  </main>
}

function GiftCardRecordModal({ record, onClose, admin = false, onAction }) {
  const uploads = getCurrentSessionUploads(record.id)
  return <div className="gc-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="gc-record-modal" role="dialog" aria-modal="true" aria-labelledby="gc-record-title"><header><div><p className="eyebrow">{record.referenceId}</p><h2 id="gc-record-title">Gift card verification</h2></div><button type="button" className="gc-small-icon" onClick={onClose} aria-label="Close details"><X size={18} /></button></header><div className="gc-record-modal-summary"><div><span>Verification status</span><StatusPill status={record.verificationStatus} /></div><div><span>Balance status</span><b>{record.balanceStatus}</b></div><div><span>Card</span><b>{record.brand} · {record.cardType}</b></div><div><span>Card number</span><b>{record.maskedCardNumber}</b></div><div><span>Country / currency</span><b>{record.country} · {record.currency}</b></div><div><span>Demo balance</span><b>{record.mockBalance == null ? 'Not available' : formatBalance(record.currency, record.mockBalance)}</b></div><div><span>Card status</span><b>{record.cardStatus || 'Not verified'}</b></div><div><span>Submitted</span><b>{new Date(record.submittedAt).toLocaleString()}</b></div><div><span>Reference ID</span><b>{record.referenceId}</b></div><div><span>Risk status</span><b>{record.riskStatus || 'LOW RISK'}</b></div></div>{record.reason && <p className="gc-modal-reason"><CircleAlert size={15} /> {record.reason}</p>}{admin && <div className="gc-admin-risk"><b>Prototype Risk Assessment · {record.riskStatus || 'LOW RISK'}</b>{record.riskFlags?.length ? record.riskFlags.map((flag) => <small key={flag}>• {flag}</small>) : <small>No prototype risk flags detected.</small>}</div>}{admin && <div className="gc-session-preview"><b>Current-session image preview</b>{uploads ? <div className="gc-session-images">{uploads.front && <SessionImage file={uploads.front} alt="Gift card front, current session" />} {uploads.back && <SessionImage file={uploads.back} alt="Gift card back, current session" />}</div> : <small>Images are not available in this session. They are never saved.</small>}</div>}<div className="gc-record-history"><b>Verification history</b><span><CheckCircle2 size={14} /> Submitted · {new Date(record.submittedAt).toLocaleString()}</span>{record.verifiedAt && <span><BadgeCheck size={14} /> Mock checks completed · {new Date(record.verifiedAt).toLocaleString()}</span>}{record.reviewedAt && <span><ShieldCheck size={14} /> Admin decision · {new Date(record.reviewedAt).toLocaleString()}</span>}</div>{admin && <footer><button type="button" className="button outline" onClick={() => onAction('REQUIRES REVIEW')}><Clock3 size={15} /> Request manual review</button><button type="button" className="button reject-button" onClick={() => onAction('FAILED')}><X size={15} /> Reject</button><button type="button" className="button primary" onClick={() => onAction('SUCCESSFUL')}><Check size={15} /> Approve</button></footer>}</section></div>
}

export function GiftCardVerificationHistoryPage() {
  const { giftCardVerifications } = useAuth()
  const [selected, setSelected] = useState(null)
  return <main className="page gc-page gc-history-page"><header className="gc-list-heading"><div><p className="eyebrow">Your account</p><h1>Gift Card Verification History</h1><p>Safe details for the gift cards you have checked.</p></div><Link className="button primary" to="/gift-card-verification"><ScanLine size={16} /> Verify a card</Link></header>{giftCardVerifications.length ? <section className="gc-record-table-wrap"><div className="gc-record-table-scroll"><table className="gc-record-table"><thead><tr><th>Reference ID</th><th>Brand</th><th>Card number</th><th>Country</th><th>Balance status</th><th>Verification</th><th>Date</th><th /></tr></thead><tbody>{giftCardVerifications.map((record) => <tr key={record.id}><td>{record.referenceId}</td><td>{record.brand}</td><td>{record.maskedCardNumber}</td><td>{record.country}</td><td>{record.balanceStatus}</td><td><StatusPill status={record.verificationStatus} /></td><td>{new Date(record.submittedAt).toLocaleDateString()}</td><td><button type="button" className="gc-view-button" onClick={() => setSelected(record)}>View details <ChevronRight size={14} /></button></td></tr>)}</tbody></table></div></section> : <div className="gc-empty-state"><span><FileText size={24} /></span><h2>No verification history yet</h2><p>Verified cards and their masked details will appear here.</p><Link className="button primary" to="/gift-card-verification"><ScanLine size={16} /> Verify a gift card</Link></div>}{selected && <GiftCardRecordModal record={selected} onClose={() => setSelected(null)} />}</main>
}

export function AdminGiftCardVerificationsPage() {
  const { allGiftCardVerifications, updateGiftCardVerification } = useAuth()
  const [selected, setSelected] = useState(null)
  const [notice, setNotice] = useState('')
  const changeStatus = (record, verificationStatus) => {
    updateGiftCardVerification(record.id, { verificationStatus, reviewedAt: new Date().toISOString() })
    setSelected({ ...record, verificationStatus, reviewedAt: new Date().toISOString() })
    setNotice(verificationStatus === 'SUCCESSFUL' ? 'Card verification approved.' : verificationStatus === 'FAILED' ? 'Card verification rejected.' : 'Manual review requested.')
  }
  const sortedRecords = [...allGiftCardVerifications].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
  return <div className="admin-page gc-admin-page"><div className="admin-heading"><div><p className="eyebrow">Trust operations</p><h1>Gift Card Verifications</h1><p className="admin-verification-intro">Review simulated gift-card checks. No retailer systems are connected.</p></div><span className="gc-admin-prototype"><Info size={14} /> Prototype queue</span></div><section className="gc-record-table-wrap"><div className="gc-record-table-scroll"><table className="gc-record-table gc-admin-table"><thead><tr><th>Reference ID</th><th>User</th><th>Brand</th><th>Country</th><th>Currency</th><th>Card type</th><th>Status</th><th>Balance</th><th>Submitted</th><th>Risk status</th><th>Actions</th></tr></thead><tbody>{sortedRecords.map((record) => <tr key={record.id}><td>{record.referenceId}</td><td>{record.userName || record.userId}</td><td>{record.brand}</td><td>{record.country}</td><td>{record.currency}</td><td>{record.cardType}</td><td><StatusPill status={record.verificationStatus} /></td><td>{record.balanceStatus}</td><td>{new Date(record.submittedAt).toLocaleDateString()}</td><td><span className={`gc-risk risk-${(record.riskStatus || 'LOW RISK').toLowerCase().replaceAll(' ', '-')}`}>{record.riskStatus || 'LOW RISK'}</span></td><td><span className="gc-admin-actions"><button type="button" onClick={() => { setNotice(''); setSelected(record) }}>View</button><button type="button" onClick={() => changeStatus(record, 'SUCCESSFUL')} aria-label={`Approve ${record.referenceId}`}>Approve</button><button type="button" onClick={() => changeStatus(record, 'FAILED')} aria-label={`Reject ${record.referenceId}`}>Reject</button><button type="button" onClick={() => changeStatus(record, 'REQUIRES REVIEW')} aria-label={`Request manual review for ${record.referenceId}`}>Review</button></span></td></tr>)}</tbody></table></div>{sortedRecords.length === 0 && <div className="gc-empty-state"><span><FileText size={24} /></span><h2>No cards in the review queue</h2><p>Customer submissions will appear here with masked details only.</p></div>}</section><p className="gc-admin-disclaimer"><Info size={14} /> Prototype Risk Assessment is a rules-based mock indicator, not real fraud detection.</p>{selected && <><GiftCardRecordModal record={selected} admin onClose={() => { setSelected(null); setNotice('') }} onAction={(status) => changeStatus(selected, status)} />{notice && <div className="gc-admin-toast" role="status">{notice}</div>}</>}</div>
}
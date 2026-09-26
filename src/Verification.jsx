import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './contexts'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, ChevronRight, Circle,
  Clock3, FileCheck2, FileText, Fingerprint, Info, LockKeyhole, Mail, Phone,
  RefreshCw, ShieldCheck, Upload, UserRound, X,
} from 'lucide-react'
import './Verification.css'

const countries = [
  { name: 'India', code: '+91' }, { name: 'United States', code: '+1' },
  { name: 'United Kingdom', code: '+44' }, { name: 'Canada', code: '+1' },
  { name: 'Australia', code: '+61' }, { name: 'Singapore', code: '+65' },
  { name: 'United Arab Emirates', code: '+971' }, { name: 'Germany', code: '+49' },
]

const adminInitial = [
  { id: 'KYC-1048', name: 'Ananya Sharma', email: 'ananya.s@example.com', country: 'India', level: 'Identity', submittedAt: '24 Sep 2026', status: 'Pending Review', documentType: 'Passport', phone: '+91 ••••• ••482', dob: '12 Mar 1994', address: 'Bandra West, Mumbai, Maharashtra 400050', createdAt: '14 Feb 2025' },
  { id: 'KYC-1047', name: 'Oliver Bennett', email: 'oliver.b@example.com', country: 'United Kingdom', level: 'Identity', submittedAt: '23 Sep 2026', status: 'Pending Review', documentType: 'Driving Licence', phone: '+44 •••• ••731', dob: '08 Nov 1988', address: 'Islington, London N1 8XX', createdAt: '09 Jun 2025' },
  { id: 'KYC-1046', name: 'Sofia Chen', email: 'sofia.c@example.com', country: 'Singapore', level: 'Identity', submittedAt: '22 Sep 2026', status: 'Requires More Information', documentType: 'National ID', phone: '+65 •••• ••915', dob: '29 Jul 1997', address: 'Tiong Bahru, Singapore 160078', createdAt: '21 Jan 2026' },
  { id: 'KYC-1045', name: 'Mateo Garcia', email: 'mateo.g@example.com', country: 'Spain', level: 'Identity', submittedAt: '20 Sep 2026', status: 'Verified', documentType: 'Passport', phone: '+34 ••• •• 204', dob: '17 May 1990', address: 'Eixample, Barcelona 08009', createdAt: '11 Aug 2025' },
]

function readAdminRecords() {
  try { return JSON.parse(localStorage.getItem('giftly-admin-verifications')) || adminInitial } catch { return adminInitial }
}

function readVerificationRecords() {
  try { return JSON.parse(localStorage.getItem('giftly-verification-records')) || {} } catch { return {} }
}

function StatusBadge({ status }) {
  const statusIcons = {
    'Not Started': Circle, 'In Progress': RefreshCw, 'Pending Review': Clock3,
    Verified: BadgeCheck, Rejected: X, 'Requires More Information': Info,
  }
  const StatusIcon = statusIcons[status] || Circle
  return <span className={`verification-status status-${status.toLowerCase().replaceAll(' ', '-')}`}><StatusIcon size={14} aria-hidden="true" />{status}</span>
}

function SectionTitle({ eyebrow, title, detail, headingId }) {
  return <div className="verification-section-title"><div><p className="eyebrow">{eyebrow}</p><h2 id={headingId}>{title}</h2></div>{detail && <p>{detail}</p>}</div>
}

function FileUpload({ label, file, onChange, onRemove, accept = 'image/*,.pdf' }) {
  const preview = useMemo(() => file && file.type.startsWith('image/') ? URL.createObjectURL(file) : '', [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  return <div className="verification-upload">
    <span className="verification-upload-label">{label}</span>
    {file ? <div className="verification-file-preview">
      {preview ? <img src={preview} alt={`${label} preview`} /> : <span className="verification-file-icon"><FileText size={22} /></span>}
      <span className="verification-file-name"><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB · Preview ready</small></span>
      <label className="verification-icon-button" title={`Replace ${label}`}><Upload size={17} /><input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] || null)} /></label>
      <button className="verification-icon-button remove" type="button" onClick={onRemove} aria-label={`Remove ${label}`}><X size={17} /></button>
    </div> : <label className="verification-dropzone"><Upload size={21} /><b>Choose a file or drop it here</b><small>JPG, PNG or PDF · Max 10 MB</small><input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] || null)} /></label>}
  </div>
}

function VerificationTimeline({ verification }) {
  const submitted = Boolean(verification.submittedAt)
  const complete = verification.identityStatus === 'Verified'
  const timeline = [
    ['Account Created', true, 'Your Giftly account is ready'],
    ['Email Verified', verification.emailVerified, verification.emailVerified ? 'Email address confirmed' : 'Confirm your email address'],
    ['Phone Verified', verification.phoneVerified, verification.phoneVerified ? 'Phone number confirmed' : 'Complete phone verification'],
    ['Identity Submitted', submitted, submitted ? `Submitted ${new Date(verification.submittedAt).toLocaleDateString()}` : 'Complete identity onboarding'],
    ['Identity Review', ['Pending Review', 'Verified', 'Rejected', 'Requires More Information'].includes(verification.identityStatus), verification.identityStatus === 'Pending Review' ? 'Our review team will take a look' : 'Review starts after you submit'],
    ['Verification Complete', complete, complete ? 'Your account is verified' : 'One last step to build trust'],
  ]
  return <ol className="verification-timeline">{timeline.map(([title, done, detail], index) => <li className={done ? 'done' : ''} key={title}><span className="timeline-mark">{done ? <Check size={14} /> : index + 1}</span><span><b>{title}</b><small>{detail}</small></span></li>)}</ol>
}

export function VerificationPage() {
  const { user, updateVerification } = useAuth()
  const verification = user?.verification || {}
  const [countryCode, setCountryCode] = useState('+91')
  const [phone, setPhone] = useState(verification.phoneNumber || '')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [phoneMessage, setPhoneMessage] = useState('')
  const [step, setStep] = useState(1)
  const [stepError, setStepError] = useState('')
  const [identity, setIdentity] = useState(verification.identity || {})
  const [documentType, setDocumentType] = useState(verification.documentType || '')
  const [frontFile, setFrontFile] = useState(null)
  const [backFile, setBackFile] = useState(null)
  const [selfieFile, setSelfieFile] = useState(null)
  const [consent, setConsent] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')

  const setIdentityField = (field) => (event) => setIdentity((current) => ({ ...current, [field]: event.target.value }))
  const documentNeedsBack = documentType !== 'Passport'
  const identitySteps = ['Your details', 'Choose document', 'Upload documents', 'Selfie check', 'Review']
  const beginPhoneVerification = () => {
    if (phone.replace(/\D/g, '').length < 7) {
      setPhoneMessage('Enter a valid phone number to continue.')
      return
    }
    setOtpSent(true)
    setOtp('')
    setPhoneMessage('A demo verification code has been sent. Use any 6 digits to continue.')
    updateVerification({ phoneNumber: `${countryCode} ${phone}`, identityStatus: verification.identityStatus === 'Not Started' ? 'In Progress' : verification.identityStatus })
  }
  const verifyOtp = (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(otp)) {
      setPhoneMessage('Enter the 6-digit code to verify your number.')
      return
    }
    updateVerification({ phoneVerified: true, phoneNumber: `${countryCode} ${phone}`, identityStatus: verification.identityStatus === 'Not Started' ? 'In Progress' : verification.identityStatus })
    setPhoneMessage('Phone number verified successfully.')
  }
  const continueIdentity = (event) => {
    event.preventDefault()
    if (step === 1 && !['fullName', 'dateOfBirth', 'country', 'address', 'city', 'region', 'postalCode'].every((field) => identity[field]?.trim())) return
    if (step === 2 && !documentType) { setStepError('Choose an identity document to continue.'); return }
    if (step === 3 && (!frontFile || (documentNeedsBack && !backFile))) { setStepError('Upload the required sides of your document to continue.'); return }
    if (step === 4 && !selfieFile) { setStepError('Upload a selfie to continue.'); return }
    setStepError('')
    setStep((current) => Math.min(5, current + 1))
  }
  const submitIdentity = (event) => {
    event.preventDefault()
    if (!consent) return
    const submittedAt = new Date().toISOString()
    const record = {
      id: `KYC-${Date.now()}`, name: identity.fullName, email: user.email,
      country: identity.country, level: 'Identity',
      submittedAt: new Date(submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Pending Review', documentType,
      phone: verification.phoneNumber ? `${verification.phoneNumber.slice(0, 4)} ••••••` : 'Not provided',
      dob: identity.dateOfBirth,
      address: [identity.address, identity.city, identity.region, identity.postalCode].filter(Boolean).join(', '),
      createdAt: 'Giftly member',
    }
    const records = readAdminRecords()
    localStorage.setItem('giftly-admin-verifications', JSON.stringify([record, ...records.filter((item) => item.email !== user.email)]))
    updateVerification({
      identityStatus: 'Pending Review', documentType, country: identity.country,
      submittedAt, reviewedAt: null, verificationLevel: 'Identity', identity,
    })
    setSubmitMessage('Your information has been submitted for review.')
  }

  return <main className="page verification-page">
    <Link className="back-link" to="/profile"><ArrowLeft size={16} /> Back to profile</Link>
    <div className="verification-hero">
      <div><p className="eyebrow">Trust & verification</p><h1>Build trust with<br /><em>every exchange.</em></h1><p>Complete a few simple checks to help keep your Giftly account and community safer.</p></div>
      <div className="verification-hero-mark"><ShieldCheck size={48} strokeWidth={1.4} /><span>Giftly<br />Trust Centre</span></div>
    </div>

    <div className="verification-overview">
      <div className="verification-overview-heading"><span className="verification-shield"><ShieldCheck size={21} /></span><span><b>Your verification status</b><small>Steps completed help unlock a more trusted experience.</small></span><StatusBadge status={verification.identityStatus || 'Not Started'} /></div>
      <div className="verification-progress"><span style={{ width: `${verification.identityStatus === 'Verified' ? 100 : verification.identityStatus === 'Pending Review' ? 85 : verification.phoneVerified ? 45 : verification.emailVerified ? 25 : 10}%` }} /></div>
    </div>

    <div className="verification-main-grid">
      <div className="verification-main-column">
        <section className="verification-section" aria-labelledby="account-verification-title">
          <SectionTitle eyebrow="01 · Account" title="Account verification" detail="A few checks make your account more secure." headingId="account-verification-title" />
          <div className="account-check-list">
            <div className="account-check"><span className="account-check-icon"><Mail size={18} /></span><span><b>Email address</b><small>{user?.email || 'No email on file'}</small></span><span className={`check-state ${verification.emailVerified ? 'is-done' : ''}`}>{verification.emailVerified ? <><CheckCircle2 size={15} /> Verified</> : 'Not verified'}</span></div>
            <div className="account-check"><span className="account-check-icon"><Phone size={18} /></span><span><b>Phone number</b><small>{verification.phoneNumber || 'Add a phone number'}</small></span><span className={`check-state ${verification.phoneVerified ? 'is-done' : ''}`}>{verification.phoneVerified ? <><CheckCircle2 size={15} /> Verified</> : 'Not verified'}</span></div>
            <div className="account-check"><span className="account-check-icon"><LockKeyhole size={18} /></span><span><b>Account security</b><small>Password protected · Keep your sign-in details private</small></span><span className="check-state is-done"><CheckCircle2 size={15} /> Protected</span></div>
          </div>
        </section>

        <section className="verification-section" aria-labelledby="phone-verification-title">
          <SectionTitle eyebrow="02 · Phone" title="Verify your phone" detail="We'll send a one-time code to confirm it's you." headingId="phone-verification-title" />
          {verification.phoneVerified ? <div className="verification-success"><CheckCircle2 size={20} /><span><b>Phone verified</b><small>{verification.phoneNumber}</small></span></div> : <>
            <div className="phone-entry"><label>Country code<select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>{countries.map((item) => <option key={`${item.name}-${item.code}`} value={item.code}>{item.name} ({item.code})</option>)}</select></label><label>Phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="98765 43210" autoComplete="tel-national" /></label><button type="button" className="button primary" onClick={beginPhoneVerification}><Phone size={16} />{otpSent ? 'Resend code' : 'Send code'}</button></div>
            {otpSent && <form className="otp-entry" onSubmit={verifyOtp}><label>6-digit verification code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" /></label><button className="button outline" type="submit">Verify number <ArrowRight size={15} /></button><button className="resend-code" type="button" onClick={beginPhoneVerification}><RefreshCw size={13} /> Resend code</button></form>}
            {phoneMessage && <p className={verification.phoneVerified ? 'verification-inline-message success' : 'verification-inline-message'} role="status">{phoneMessage}</p>}
          </>}
        </section>

        <section className="verification-section identity-onboarding" aria-labelledby="identity-verification-title">
          <SectionTitle eyebrow="03 · Identity" title="Identity verification" detail="A guided, five-step identity check." headingId="identity-verification-title" />
          {verification.identityStatus === 'Pending Review' ? <div className="pending-review-panel"><span><Clock3 size={23} /></span><div><b>Pending Review</b><p>Your information was submitted on {new Date(verification.submittedAt).toLocaleDateString()}. We'll update your status here when the review is complete.</p></div><StatusBadge status="Pending Review" /></div> : verification.identityStatus === 'Verified' ? <div className="verified-panel"><BadgeCheck size={28} /><div><b>Identity verified</b><p>Your Giftly profile has been verified. Thanks for helping build trust in the community.</p></div></div> : <>
            <div className="identity-stepper" aria-label="Identity verification steps">{identitySteps.map((label, index) => <div className={step > index + 1 ? 'complete' : step === index + 1 ? 'current' : ''} key={label}><span>{step > index + 1 ? <Check size={13} /> : index + 1}</span><small>{label}</small></div>)}</div>
            <form className="identity-form" onSubmit={step === 5 ? submitIdentity : continueIdentity}>
              {step === 1 && <div className="identity-step-content"><h3>Your legal details</h3><p>Enter these as they appear on your identity document.</p><div className="verification-form-grid"><label className="wide">Full legal name<input required value={identity.fullName || ''} onChange={setIdentityField('fullName')} autoComplete="name" placeholder="As shown on your document" /></label><label>Date of birth<input required type="date" value={identity.dateOfBirth || ''} onChange={setIdentityField('dateOfBirth')} /></label><label>Country<select required value={identity.country || ''} onChange={setIdentityField('country')}><option value="">Select country</option>{countries.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label className="wide">Address<input required value={identity.address || ''} onChange={setIdentityField('address')} autoComplete="street-address" placeholder="Street address and unit" /></label><label>City<input required value={identity.city || ''} onChange={setIdentityField('city')} autoComplete="address-level2" /></label><label>State / Province<input required value={identity.region || ''} onChange={setIdentityField('region')} autoComplete="address-level1" /></label><label>Postal code<input required value={identity.postalCode || ''} onChange={setIdentityField('postalCode')} autoComplete="postal-code" /></label></div></div>}
              {step === 2 && <div className="identity-step-content"><h3>Choose an identity document</h3><p>Select a current, government-issued document from your country.</p><div className="document-choice-list">{[['Passport', 'International travel document'], ['National ID', 'Government-issued identity card'], ['Driving Licence', 'Valid photo driving licence']].map(([title, detail]) => <label className={documentType === title ? 'selected' : ''} key={title}><input type="radio" name="documentType" value={title} checked={documentType === title} onChange={() => setDocumentType(title)} /><span className="document-choice-icon"><FileCheck2 size={20} /></span><span><b>{title}</b><small>{detail}</small></span>{documentType === title && <CheckCircle2 size={18} />}</label>)}</div></div>}
              {step === 3 && <div className="identity-step-content"><h3>Upload your document</h3><p>Make sure the full document is visible, legible, and not expired.</p><FileUpload label="Front of document" file={frontFile} onChange={setFrontFile} onRemove={() => setFrontFile(null)} />{documentNeedsBack && <FileUpload label="Back of document" file={backFile} onChange={setBackFile} onRemove={() => setBackFile(null)} />}<div className="verification-note"><Info size={16} /><span>Only an image preview is held in this browser session. This prototype does not send or store real identity documents.</span></div></div>}
              {step === 4 && <div className="identity-step-content"><h3>Take a selfie</h3><p>A clear selfie helps us compare your appearance with your document photo.</p><div className="selfie-placeholder"><span><UserRound size={38} /></span><b>Selfie photo</b><small>Face the camera in good light. Remove hats and sunglasses.</small><label className="button outline"><Upload size={15} />{selfieFile ? 'Replace selfie' : 'Upload selfie'}<input type="file" accept="image/*" onChange={(event) => setSelfieFile(event.target.files?.[0] || null)} /></label>{selfieFile && <small className="selfie-file-name"><CheckCircle2 size={14} /> {selfieFile.name}</small>}</div><div className="verification-instructions"><span><CheckCircle2 size={16} /> Use a plain, well-lit background</span><span><CheckCircle2 size={16} /> Keep your full face in frame</span><span><CheckCircle2 size={16} /> Do not use a photo of a photo</span></div></div>}
              {step === 5 && <div className="identity-step-content"><h3>Review and submit</h3><p>Check your details before sending them for review.</p><div className="review-information"><div><span>Legal name</span><b>{identity.fullName}</b></div><div><span>Date of birth</span><b>{identity.dateOfBirth}</b></div><div><span>Country</span><b>{identity.country}</b></div><div><span>Address</span><b>{[identity.address, identity.city, identity.region, identity.postalCode].filter(Boolean).join(', ')}</b></div><div><span>Document type</span><b>{documentType}</b></div><div><span>Document files</span><b>{frontFile?.name}{documentNeedsBack ? ` · ${backFile?.name}` : ''}</b></div><div><span>Selfie</span><b>{selfieFile?.name}</b></div></div><label className="verification-consent"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I confirm the details above are accurate and consent to this mock verification workflow processing them for review.</span></label><div className="verification-prototype-note"><Info size={16} /><span>Prototype only. Giftly has not integrated identity verification or compliance providers. Do not submit real identity documents.</span></div></div>}
              {stepError && <p className="verification-step-error" role="alert">{stepError}</p>}
              <div className="identity-form-actions">{step > 1 && <button className="button outline" type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={15} /> Back</button>}{step < 5 ? <button className="button primary" type="submit">Continue <ArrowRight size={15} /></button> : <button className="button primary" type="submit" disabled={!consent}><ShieldCheck size={16} /> Submit for verification</button>}</div>
            </form>
            {submitMessage && <p className="verification-inline-message success" role="status">{submitMessage}</p>}
          </>}
        </section>

        <section className="verification-security"><span><LockKeyhole size={20} /></span><div><h2>Why we ask for verification</h2><p>Identity checks can help protect users, reduce fraud, support more secure transactions, and inform processes designed around applicable regulations.</p><p className="verification-disclaimer">This is a product prototype, not a claim of AML/KYC compliance. No real identity checks, regulatory processes, or third-party verification providers are connected.</p></div></section>
      </div>

      <aside className="verification-sidebar"><section className="verification-sidebar-section"><SectionTitle eyebrow="Your progress" title="Verification timeline" /><VerificationTimeline verification={verification} /></section><section className="verification-level-card"><span><Fingerprint size={21} /></span><div><b>Verification level</b><small>{verification.verificationLevel || 'None'}</small></div><p>{verification.identityStatus === 'Verified' ? 'Verified identity' : 'Complete identity checks to unlock this level.'}</p></section><div className="verification-help"><Info size={17} /><span><b>Need a hand?</b><small>Our support team can help with your verification steps.</small><Link to="/support">Visit support <ChevronRight size={13} /></Link></span></div></aside>
    </div>
  </main>
}

export function AdminVerificationsPage() {
  const [records, setRecords] = useState(readAdminRecords)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All statuses')
  const [note, setNote] = useState('')
  useEffect(() => localStorage.setItem('giftly-admin-verifications', JSON.stringify(records)), [records])
  const filtered = records.filter((record) => `${record.name} ${record.email} ${record.country} ${record.id}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All statuses' || record.status === filter))
  const updateStatus = (id, status) => {
    const reviewedAt = new Date().toISOString()
    const reviewedRecord = records.find((record) => record.id === id)
    setRecords((current) => current.map((record) => record.id === id ? { ...record, status, reviewedAt } : record))
    setSelected((current) => current ? { ...current, status, reviewedAt } : current)
    if (reviewedRecord) {
      const accountRecords = readVerificationRecords()
      if (accountRecords[reviewedRecord.email]) {
        accountRecords[reviewedRecord.email] = {
          ...accountRecords[reviewedRecord.email], identityStatus: status, reviewedAt,
          verificationLevel: status === 'Verified' ? 'Identity' : accountRecords[reviewedRecord.email].verificationLevel,
        }
        localStorage.setItem('giftly-verification-records', JSON.stringify(accountRecords))
      }
    }
    setNote(status === 'Verified' ? 'Verification approved.' : status === 'Rejected' ? 'Verification rejected.' : 'More information requested.')
  }
  const closeReview = () => { setSelected(null); setNote('') }

  return <div className="admin-page admin-verifications-page">
    <div className="admin-heading"><div><p className="eyebrow">Trust operations</p><h1>Verifications</h1><p className="admin-verification-intro">Review identity submissions and manage account verification status.</p></div><span className="admin-prototype-label"><Info size={14} /> Mock review workspace</span></div>
    <div className="verification-admin-stats"><div><span><Clock3 size={18} /></span><b>{records.filter((record) => record.status === 'Pending Review').length}</b><small>Pending review</small></div><div><span><Info size={18} /></span><b>{records.filter((record) => record.status === 'Requires More Information').length}</b><small>Needs information</small></div><div><span><BadgeCheck size={18} /></span><b>{records.filter((record) => record.status === 'Verified').length}</b><small>Verified</small></div></div>
    <section className="verification-admin-table-wrap"><div className="verification-admin-toolbar"><label className="verification-admin-search"><span className="sr-only">Search verifications</span><UserRound size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or reference" /></label><label className="verification-filter"><span className="sr-only">Filter by status</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All statuses</option>{['Pending Review', 'Requires More Information', 'Verified', 'Rejected'].map((status) => <option key={status}>{status}</option>)}</select></label></div>
      <div className="verification-admin-table-scroll"><table className="verification-admin-table"><thead><tr><th>User</th><th>Country</th><th>Level</th><th>Submitted</th><th>Status</th><th>Document</th><th><span className="sr-only">Review action</span></th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td><span className="admin-verification-user"><b>{record.name}</b><small>{record.email}</small></span></td><td>{record.country}</td><td><span className="level-chip">{record.level}</span></td><td>{record.submittedAt}</td><td><StatusBadge status={record.status} /></td><td>{record.documentType}</td><td><button className="review-record-button" onClick={() => setSelected(record)} aria-label={`Review ${record.name}'s verification`}>Review <ChevronRight size={14} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="verification-admin-empty">No verification records match this search.</div>}</div>
      <div className="verification-table-foot"><span>Showing {filtered.length} of {records.length} submissions</span><span>Documents are mock records. No real identity files are available.</span></div>
    </section>
    {selected && <div className="verification-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeReview() }}><section className="verification-review-modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title"><header><div><p className="eyebrow">Submission {selected.id}</p><h2 id="review-modal-title">Identity review</h2></div><button className="verification-icon-button" onClick={closeReview} aria-label="Close review"><X size={19} /></button></header><div className="review-modal-user"><span>{selected.name.split(' ').map((part) => part[0]).join('')}</span><div><b>{selected.name}</b><small>{selected.email}</small></div><StatusBadge status={selected.status} /></div><div className="review-modal-grid"><div><span>Country</span><b>{selected.country}</b></div><div><span>Verification level</span><b>{selected.level}</b></div><div><span>Document type</span><b>{selected.documentType}</b></div><div><span>Submitted</span><b>{selected.submittedAt}</b></div><div><span>Date of birth</span><b>{selected.dob}</b></div><div><span>Phone</span><b>{selected.phone}</b></div><div className="wide"><span>Address</span><b>{selected.address}</b></div><div><span>Account created</span><b>{selected.createdAt}</b></div><div><span>Document number</span><b>•••• •••• ••••</b></div></div><div className="review-document-placeholder"><span><FileText size={23} /></span><div><b>{selected.documentType} · document preview</b><small>Demo record only · original document not stored</small></div><LockKeyhole size={16} /></div><div className="review-modal-note"><Info size={15} /><span>Sample data for interface testing only. Decisions here do not represent real identity or regulatory checks.</span></div>{note && <p className="verification-inline-message success" role="status">{note}</p>}<footer><button className="button outline" onClick={() => updateStatus(selected.id, 'Requires More Information')}><Info size={15} /> Request information</button><button className="button reject-button" onClick={() => updateStatus(selected.id, 'Rejected')}><X size={15} /> Reject</button><button className="button primary" onClick={() => updateStatus(selected.id, 'Verified')}><Check size={15} /> Approve</button></footer></section></div>}
  </div>
}
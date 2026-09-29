import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Info, LockKeyhole, ShieldCheck } from 'lucide-react'
import './LegalPages.css'

const legalPages = {
  terms: {
    eyebrow: 'Product information', title: 'Terms of Use', intro: 'These prototype terms describe the current Giftly Exchange demonstration experience. They are not a substitute for production terms reviewed by qualified counsel.',
    sections: [
      ['Prototype use', 'Giftly Exchange is a product prototype for exploring gift-card discovery and exchange workflows. Catalog listings, offers, balances, account state, transactions, and operational outcomes may be sample or locally simulated data.'],
      ['No financial service', 'The prototype does not process payments, transfer funds, provide real payouts, hold assets, or provide escrow custody. Do not use it to complete a real purchase or financial transaction.'],
      ['No retailer or identity verification', 'Gift-card balance checks, OCR, phone verification, and identity review are simulated. No retailer, KYC, AML, or compliance provider is connected.'],
      ['Prototype records', 'Local browser data can be incomplete, reset, or changed as the interface evolves. Do not rely on prototype records as evidence of a completed purchase, sale, or financial obligation.'],
      ['Production readiness', 'Before a public launch, the service would require backend infrastructure, secure authentication and storage, regulated payment integrations where required, provider agreements, monitoring, audit controls, and legal review.'],
    ],
  },
  privacy: {
    eyebrow: 'Product information', title: 'Privacy Notice', intro: 'This page explains the limits of local prototype data handling. It is not a production privacy policy.',
    sections: [
      ['Browser-local data', 'Some demo account, wallet, cart, listing, escrow, delivery, and notification metadata is stored in localStorage in this browser. It is not a production account system or secure database.'],
      ['Sensitive information', 'Do not enter passwords, bank credentials, CVV, full gift-card numbers or PINs, identity documents, or selfie images. Prototype workflows are intended to use masked values and session-only file previews.'],
      ['No connected providers', 'The prototype does not send information to payment, KYC, retailer, email, or SMS providers. Email and SMS delivery labels are simulated only.'],
      ['Your browser', 'Clearing browser storage removes locally held prototype state. Data may also be lost when changing browser profiles or devices.'],
      ['Production requirements', 'A production privacy program would need a documented data inventory, retention and deletion policy, appropriate consent, secure storage, access controls, vendor review, and legal review.'],
    ],
  },
  compliance: {
    eyebrow: 'Product information', title: 'Compliance Overview', intro: 'Giftly Exchange is not currently a regulated or compliance-certified service. This prototype must not be used to assess regulatory eligibility or compliance.',
    sections: [
      ['Identity checks', 'The KYC/identity flow is a UI prototype. It does not perform a real identity check, sanctions screening, AML review, or regulatory decision.'],
      ['Risk indicators', 'Fraud and risk labels are prototype rules and indicators. They are not real AI fraud detection, a financial crime control, or a decisioning system.'],
      ['Payments and custody', 'Payments, wallet balances, payouts, and escrow events are simulated local state. No payment is collected and no assets are held.'],
      ['Retailer checks', 'Gift-card OCR, detail matching, and balance checks are simulated. Giftly is not connected to retailer systems or real-time retailer verification.'],
      ['Before production', 'A real service would require jurisdiction-specific legal and compliance review, appropriate regulated providers, documented controls, monitoring, auditability, and secure backend infrastructure.'],
    ],
  },
  security: {
    eyebrow: 'Product information', title: 'Security', intro: 'This prototype demonstrates interface concepts, not production security guarantees or certifications.',
    sections: [
      ['Prototype boundaries', 'Authentication and roles are local demo behavior. Browser localStorage is not a secure vault or trusted authorization boundary. Never use real credentials in this prototype.'],
      ['Card information', 'Delivery and listing surfaces display masked gift-card metadata only. Do not submit full card numbers, PINs, CVV, bank details, passwords, identity documents, or selfies.'],
      ['Simulated services', 'Payments, wallet activity, escrow, identity verification, OCR, retailer balance checking, risk flags, email, and SMS are simulated. No secure custody or real message delivery is provided.'],
      ['Production requirements', 'A production deployment would require secure backend infrastructure, server-side authorization, encrypted storage and transport, secrets management, logging, monitoring, incident response, and independent security review.'],
    ],
  },
  'how-it-works': {
    eyebrow: 'Product information', title: 'How Giftly Works', intro: 'Explore the intended product journey through a local prototype. No real transaction, verification, or delivery is completed.',
    sections: [
      ['1. Discover', 'Browse the sample gift-card catalog, offers, peer-to-peer listings, and auctions. Displayed availability and pricing are prototype information.'],
      ['2. Explore verification', 'The gift-card and identity workflows demonstrate product screens only. OCR, card balance, phone, and identity checks are simulated. Do not provide real credentials or documents.'],
      ['3. Try exchange flows', 'Cash-out, listing, bidding, wallet, and escrow actions update local prototype state. No payment, payout, asset custody, or settlement occurs.'],
      ['4. Delivery and updates', 'Delivery records and notification events show masked metadata. Email and SMS statuses are simulated and do not contact providers.'],
      ['A future production service', 'A launch would require secure backend and authentication, regulated payment infrastructure, KYC and retailer integrations, real delivery providers, monitoring, audit controls, and legal/compliance review.'],
    ],
  },
}

const pageLinks = [
  ['terms', 'Terms'], ['privacy', 'Privacy'], ['compliance', 'Compliance'],
  ['security', 'Security'], ['how-it-works', 'How it works'],
]

export function LegalPage({ page }) {
  const content = legalPages[page] || legalPages.terms
  return <main className="page legal-page"><header className="legal-hero"><span className="legal-hero-icon"><ShieldCheck size={23} /></span><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.intro}</p><span className="legal-prototype-label"><Info size={14} /> Prototype information · not legal advice</span></header>
    <nav className="legal-tabs" aria-label="Product information">{pageLinks.map(([slug, label]) => <Link className={slug === page ? 'active' : ''} to={`/${slug}`} key={slug}>{label}</Link>)}</nav>
    <div className="legal-content">{content.sections.map(([heading, text], index) => <section className="legal-section" key={heading}><span className="legal-section-number">{String(index + 1).padStart(2, '0')}</span><div><h2>{heading}</h2><p>{text}</p></div></section>)}</div>
    <aside className="legal-production-note"><LockKeyhole size={18} /><div><b>Prototype boundary</b><p>Giftly is for product exploration only. No real payments, KYC, email/SMS, retailer verification, fraud detection, or escrow custody are connected.</p></div><CheckCircle2 size={18} /></aside>
    <div className="legal-next-links"><Link to="/gift-cards">Explore gift cards <ArrowRight size={14} /></Link><Link to="/how-it-works">How it works <ArrowRight size={14} /></Link></div>
  </main>
}

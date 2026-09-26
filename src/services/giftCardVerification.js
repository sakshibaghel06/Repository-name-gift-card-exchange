const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const maskedNumber = (value = '') => {
  const digits = value.replace(/\D/g, '')
  return `•••• •••• •••• ${digits.slice(-4) || '••••'}`
}

// Prototype/mock implementation — replace with real provider integration.
export async function scanGiftCardImage(details) {
  await wait(650)
  return {
    brand: details.brand,
    currency: details.currency,
    expiry: details.expiry || 'Not detected',
    maskedCardNumber: maskedNumber(details.cardNumber),
    maskedPin: details.pin ? `••••${details.pin.slice(-1)}` : 'Not detected',
    confidence: 0.94,
    source: 'Mock OCR Result · Prototype simulation',
  }
}

// Prototype/mock implementation — replace with real provider integration.
export async function verifyGiftCardDetails(details) {
  await wait(450)
  const digits = details.cardNumber.replace(/\D/g, '')
  const lastDigit = Number(digits.at(-1))
  if (digits.length < 8 || details.pin.replace(/\D/g, '').length < 3) {
    return { status: 'FAILED', reason: 'Card information incomplete' }
  }
  if (lastDigit === 7) return { status: 'FAILED', reason: 'Card details could not be matched' }
  if (lastDigit === 8) return { status: 'REQUIRES REVIEW', reason: 'Manual review required' }
  if (lastDigit === 6 || lastDigit === 9) return { status: 'PARTIALLY VERIFIED', reason: 'Image quality insufficient' }
  return { status: 'SUCCESSFUL', reason: '', detailChecks: ['Gift card details verified', 'Card appears valid'] }
}

// Prototype/mock implementation — replace with real retailer balance APIs.
export async function checkGiftCardBalance(details) {
  await wait(550)
  const lastDigit = Number(details.cardNumber.replace(/\D/g, '').at(-1))
  if (lastDigit === 7) return { status: 'FAILED', balance: null, cardStatus: 'Unknown', reason: 'Balance could not be verified' }
  if (lastDigit === 8) return { status: 'REQUIRES REVIEW', balance: null, cardStatus: 'Review', reason: 'Manual review required' }
  const demoBalances = { INR: 2500, USD: 25, GBP: 20, EUR: 25, CAD: 35, AUD: 35, SGD: 30, AED: 90 }
  return {
    status: 'VERIFIED',
    balance: demoBalances[details.currency] || 25,
    currency: details.currency,
    cardStatus: 'Active',
    note: 'Demo balance verification — real retailer balance APIs are not connected yet.',
  }
}

// Prototype/mock implementation — replace with a real fraud/risk assessment provider.
export async function calculateVerificationRisk({ maskedCardNumber, failedAttempts = 0, incomplete = false, manualReview = false }, history = []) {
  await wait(180)
  const duplicate = history.some((record) => record.maskedCardNumber === maskedCardNumber)
  const flags = []
  if (duplicate) flags.push('Duplicate card submission')
  if (failedAttempts > 1) flags.push('Multiple failed verification attempts')
  if (history.length >= 3) flags.push('Suspicious verification frequency')
  if (incomplete) flags.push('Incomplete card information')
  if (manualReview) flags.push('Manual review required')
  const level = flags.length > 1 || failedAttempts > 2 ? 'HIGH RISK' : flags.length ? 'MEDIUM RISK' : 'LOW RISK'
  return { level, flags, label: 'Prototype Risk Assessment' }
}

export { maskedNumber }
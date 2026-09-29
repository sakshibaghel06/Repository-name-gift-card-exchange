import { useState } from 'react'
import { Globe2 } from 'lucide-react'
import { useAuth, useWallet } from './contexts'
import { COUNTRIES } from './services/countryData'
import { SUPPORTED_CURRENCIES } from './services/walletService'
import './GlobalPreferences.css'

const readRegion = () => {
  try {
    const saved = localStorage.getItem('giftly-preferred-country')
    return COUNTRIES.some((country) => country.name === saved) ? saved : 'India'
  } catch { return 'India' }
}
const readCurrency = () => {
  try {
    const saved = localStorage.getItem('giftly-preferred-currency')
    return SUPPORTED_CURRENCIES.some((currency) => currency.code === saved) ? saved : 'INR'
  } catch { return 'INR' }
}

export function CountrySelector() {
  const [country, setCountry] = useState(readRegion)
  const update = (event) => {
    const value = event.target.value
    setCountry(value)
    try { localStorage.setItem('giftly-preferred-country', value) } catch { /* Browser storage may be unavailable. */ }
    window.dispatchEvent(new CustomEvent('giftly-region-preference-change'))
  }
  return <label className="global-preference country-preference"><Globe2 size={14} /><span className="sr-only">Country or region</span><select aria-label="Country or region" value={country} onChange={update}>{COUNTRIES.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
}

export function CurrencySelector() {
  const { user } = useAuth()
  const wallet = useWallet()
  const [guestCurrency, setGuestCurrency] = useState(readCurrency)
  const value = user?.email ? wallet.selectedCurrency : guestCurrency
  const update = (event) => {
    const currency = event.target.value
    if (user?.email) wallet.setSelectedCurrency(currency)
    else {
      setGuestCurrency(currency)
      try { localStorage.setItem('giftly-preferred-currency', currency) } catch { /* Browser storage may be unavailable. */ }
    }
  }
  const symbol = SUPPORTED_CURRENCIES.find((item) => item.code === value)?.symbol || value
  return <label className="global-preference currency-preference" title="Currency rates are prototype demo rates"><span className="currency-symbol">{symbol}</span><span className="sr-only">Preferred currency</span><select aria-label="Preferred currency" value={value} onChange={update}>{SUPPORTED_CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
}

export function RegionCurrencyControls() {
  return <div className="region-currency-controls" aria-label="Global preferences"><CountrySelector /><CurrencySelector /><span className="demo-fx-label">Demo FX</span></div>
}


export const COUNTRIES = [
  { name: 'India', phoneCode: '+91', currency: 'INR', region: 'Asia' },
  { name: 'United States', phoneCode: '+1', currency: 'USD', region: 'North America' },
  { name: 'United Kingdom', phoneCode: '+44', currency: 'GBP', region: 'Europe' },
  { name: 'Canada', phoneCode: '+1', currency: 'CAD', region: 'North America' },
  { name: 'Australia', phoneCode: '+61', currency: 'AUD', region: 'Oceania' },
  { name: 'Singapore', phoneCode: '+65', currency: 'SGD', region: 'Asia' },
  { name: 'United Arab Emirates', phoneCode: '+971', currency: 'AED', region: 'Middle East' },
  { name: 'Germany', phoneCode: '+49', currency: 'EUR', region: 'Europe' },
]

export function getCountry(name) {
  return COUNTRIES.find((country) => country.name === name) || COUNTRIES[0]
}

export function getPreferredCountry() {
  try { return getCountry(localStorage.getItem('giftly-preferred-country')) } catch { return COUNTRIES[0] }
}

export const categories = [
  { name: 'Shopping', icon: 'Bag', color: '#eee9ff', accent: '#5b43d6', count: 18 },
  { name: 'Food & Dining', icon: 'Utensils', color: '#fff0e5', accent: '#e87535', count: 14 },
  { name: 'Entertainment', icon: 'Clapperboard', color: '#ffe8f1', accent: '#d84d83', count: 11 },
  { name: 'Travel', icon: 'Plane', color: '#e2f4f4', accent: '#16858a', count: 9 },
  { name: 'Gaming', icon: 'Gamepad2', color: '#e9edff', accent: '#5269d8', count: 12 },
  { name: 'Beauty', icon: 'Sparkles', color: '#fff1e8', accent: '#d8914a', count: 8 },
  { name: 'Fashion', icon: 'Shirt', color: '#f5e9ff', accent: '#9a50c8', count: 13 },
  { name: 'Technology', icon: 'Laptop', color: '#e8f5ed', accent: '#3c9564', count: 10 },
  { name: 'Subscriptions', icon: 'PlaySquare', color: '#ffeceb', accent: '#d65d58', count: 7 },
]

export const giftCards = [
  { id: 'amazon', brand: 'Amazon', name: 'Amazon Shopping Voucher', category: 'Shopping', value: 2000, discount: 8, rating: 4.9, color: '#fff5df', accent: '#f0a500', logo: 'a' },
  { id: 'swiggy', brand: 'Swiggy', name: 'Swiggy Food Voucher', category: 'Food & Dining', value: 1000, discount: 12, rating: 4.8, color: '#fff0e8', accent: '#f36f21', logo: 'S' },
  { id: 'myntra', brand: 'Myntra', name: 'Myntra Fashion Card', category: 'Fashion', value: 2500, discount: 10, rating: 4.7, color: '#fff0f7', accent: '#e83d86', logo: 'M' },
  { id: 'bookmyshow', brand: 'BookMyShow', name: 'BookMyShow Movie Pass', category: 'Entertainment', value: 750, discount: 15, rating: 4.8, color: '#ffe9e9', accent: '#e51b23', logo: 'B' },
  { id: 'flipkart', brand: 'Flipkart', name: 'Flipkart E-Gift Card', category: 'Shopping', value: 1500, discount: 7, rating: 4.6, color: '#eaf5ff', accent: '#2776d2', logo: 'F' },
  { id: 'zomato', brand: 'Zomato', name: 'Zomato Dining Credits', category: 'Food & Dining', value: 500, discount: 11, rating: 4.7, color: '#fff0ef', accent: '#d92c2c', logo: 'z' },
  { id: 'nykaa', brand: 'Nykaa', name: 'Nykaa Beauty Treat', category: 'Beauty', value: 1200, discount: 13, rating: 4.9, color: '#ffe9f2', accent: '#e73f87', logo: 'N' },
  { id: 'airtel', brand: 'Airtel', name: 'Airtel Recharge Card', category: 'Subscriptions', value: 599, discount: 5, rating: 4.5, color: '#ffecec', accent: '#e02727', logo: 'A' },
  { id: 'reliance', brand: 'Reliance Digital', name: 'Reliance Digital Gift Card', category: 'Technology', value: 5000, discount: 6, rating: 4.6, color: '#e9f6ff', accent: '#1478be', logo: 'R' },
]

export const offers = [
  { id: 1, title: 'The weekend treat', detail: 'Extra 5% off on food & dining vouchers', code: 'FEAST5', color: 'lavender', icon: 'Utensils' },
  { id: 2, title: 'First gift, first save', detail: 'Get ₹100 off your first Giftly order', code: 'WELCOME10', color: 'peach', icon: 'Gift' },
  { id: 3, title: 'Power up your play', detail: 'Up to 18% off gaming gift cards', code: 'PLAY18', color: 'mint', icon: 'Gamepad2' },
]

export const mockOrders = [
  { id: 'GEX-240821', date: '21 Aug 2024', status: 'Delivered', total: 1840, items: [{ ...giftCards[0], quantity: 1, price: 1840 }] },
  { id: 'GEX-240805', date: '05 Aug 2024', status: 'Delivered', total: 440, items: [{ ...giftCards[3], quantity: 1, price: 638 }] },
]

export const mockExchanges = [
  { id: 'EX-9182', brand: 'Myntra', value: 2500, payout: 2150, status: 'Under Review', date: '24 Aug 2024' },
  { id: 'EX-9074', brand: 'Amazon', value: 1000, payout: 890, status: 'Paid', date: '18 Aug 2024' },
]

export const formatINR = (value) => `₹${Number(value).toLocaleString('en-IN')}`
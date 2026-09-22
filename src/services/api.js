import { giftCards, mockExchanges, mockOrders, offers } from '../data'

const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 120))

export const api = {
  getGiftCards: () => delay(giftCards),
  getOffers: () => delay(offers),
  getOrders: () => delay(JSON.parse(localStorage.getItem('giftly-orders') || 'null') || mockOrders),
  getExchangeRequests: () => delay(JSON.parse(localStorage.getItem('giftly-exchanges') || 'null') || mockExchanges),
  createExchangeRequest: (request) => {
    const current = JSON.parse(localStorage.getItem('giftly-exchanges') || '[]')
    const next = { ...request, id: `EX-${Date.now()}`, status: 'Pending Review' }
    localStorage.setItem('giftly-exchanges', JSON.stringify([next, ...current]))
    return delay(next)
  },
}

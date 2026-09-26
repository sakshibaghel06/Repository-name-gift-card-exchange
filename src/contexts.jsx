/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

const stored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

const CartContext = createContext(null)
export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => stored('giftly-cart', []))
  useEffect(() => localStorage.setItem('giftly-cart', JSON.stringify(cart)), [cart])
  const addToCart = (item, quantity = 1) => setCart((current) => {
    const found = current.find((entry) => entry.id === item.id)
    return found ? current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + quantity } : entry) : [...current, { ...item, quantity, price: Math.round(item.value * (1 - item.discount / 100)) }]
  })
  const updateQuantity = (id, quantity) => setCart((current) => quantity < 1 ? current.filter((item) => item.id !== id) : current.map((item) => item.id === id ? { ...item, quantity } : item))
  const removeFromCart = (id) => setCart((current) => current.filter((item) => item.id !== id))
  return <CartContext.Provider value={{ cart, addToCart, updateQuantity, removeFromCart }}>{children}</CartContext.Provider>
}
export const useCart = () => useContext(CartContext)

const WishlistContext = createContext(null)
export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState(() => stored('giftly-wishlist', []))
  useEffect(() => localStorage.setItem('giftly-wishlist', JSON.stringify(wishlist)), [wishlist])
  const toggleWishlist = (item) => setWishlist((current) => current.some((entry) => entry.id === item.id) ? current.filter((entry) => entry.id !== item.id) : [...current, item])
  return <WishlistContext.Provider value={{ wishlist, toggleWishlist }}>{children}</WishlistContext.Provider>
}
export const useWishlist = () => useContext(WishlistContext)

const AuthContext = createContext(null)
const defaultVerification = {
  emailVerified: true,
  phoneVerified: false,
  identityStatus: 'Not Started',
  documentType: '',
  country: '',
  submittedAt: null,
  reviewedAt: null,
  verificationLevel: 'None',
  phoneNumber: '',
  identity: {},
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = stored('giftly-user', null)
    return savedUser ? { ...savedUser, verification: { ...defaultVerification, ...savedUser.verification } } : null
  })
  const [allGiftCardVerifications, setAllGiftCardVerifications] = useState(() => stored('giftly-card-verifications', []))
  useEffect(() => user ? localStorage.setItem('giftly-user', JSON.stringify(user)) : localStorage.removeItem('giftly-user'), [user])
  useEffect(() => localStorage.setItem('giftly-card-verifications', JSON.stringify(allGiftCardVerifications)), [allGiftCardVerifications])
  useEffect(() => {
    if (!user) return
    const records = stored('giftly-verification-records', {})
    localStorage.setItem('giftly-verification-records', JSON.stringify({ ...records, [user.email]: user.verification }))
  }, [user])
  const login = (email, name = 'Aarav Mehta') => {
    const records = stored('giftly-verification-records', {})
    setUser({ email, name, role: email.includes('admin') ? 'admin' : 'customer', verification: { ...defaultVerification, ...records[email] } })
  }
  const updateVerification = (changes) => setUser((current) => current ? { ...current, verification: { ...defaultVerification, ...current.verification, ...changes } } : current)
  const saveGiftCardVerification = (record) => {
    const allowedFields = [
      'id', 'referenceId', 'brand', 'country', 'currency', 'cardType',
      'maskedCardNumber', 'verificationStatus', 'balanceStatus', 'mockBalance',
      'cardStatus', 'reason', 'submittedAt', 'verifiedAt', 'riskStatus',
      'riskFlags', 'detailsVerified',
    ]
    const safeRecord = Object.fromEntries(allowedFields.filter((field) => field in record).map((field) => [field, record[field]]))
    safeRecord.userId = user?.email || ''
    safeRecord.userName = user?.name || 'Giftly member'
    setAllGiftCardVerifications((current) => [safeRecord, ...current.filter((item) => item.id !== safeRecord.id)])
    return safeRecord
  }
  const updateGiftCardVerification = (id, changes) => setAllGiftCardVerifications((current) => current.map((record) => record.id === id ? { ...record, ...changes } : record))
  const giftCardVerifications = allGiftCardVerifications.filter((record) => record.userId === user?.email)
  const logout = () => setUser(null)
  return <AuthContext.Provider value={{ user, login, logout, updateVerification, giftCardVerifications, allGiftCardVerifications, saveGiftCardVerification, updateGiftCardVerification }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
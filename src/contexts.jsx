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
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => stored('giftly-user', null))
  useEffect(() => user ? localStorage.setItem('giftly-user', JSON.stringify(user)) : localStorage.removeItem('giftly-user'), [user])
  const login = (email, name = 'Aarav Mehta') => setUser({ email, name, role: email.includes('admin') ? 'admin' : 'customer' })
  const logout = () => setUser(null)
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
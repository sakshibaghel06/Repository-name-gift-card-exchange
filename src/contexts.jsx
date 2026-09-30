/* eslint-disable react-refresh/only-export-components */
import { createContext, startTransition, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  convertCurrency, getTransactions, getWallet, setPreferredCurrency as savePreferredCurrency,
  simulateDeposit, simulateWithdrawal, WALLET_CHANGE_EVENT,
} from './services/walletService'
import { createNotification } from './services/notificationService'

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
  const clearCart = () => setCart([])
  return <CartContext.Provider value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart }}>{children}</CartContext.Provider>
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
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  const [allGiftCardVerifications, setAllGiftCardVerifications] =
    useState(() =>
      stored('giftly-card-verifications', [])
    )

  const normalizeRole = (role) => {
    const validRoles = [
      'customer',
      'admin',
      'support',
      'compliance',
      'operations',
    ]

    return validRoles.includes(role) ? role : 'customer'
  }

  /* -------------------------------------------------------
     Convert Supabase user into Giftly user
  ------------------------------------------------------- */

  const createGiftlyUser = useCallback((supabaseUser, profile = null) => {
    if (!supabaseUser) return null

    const email = supabaseUser.email || profile?.email || ''
    const records = stored(
      'giftly-verification-records',
      {}
    )

    return {
      id: supabaseUser.id,
      email,
      name:
        profile?.full_name ||
        supabaseUser.user_metadata?.name ||
        supabaseUser.user_metadata?.full_name ||
        email.split('@')[0] ||
        'Giftly Member',
      role: normalizeRole(
        profile?.role ||
          supabaseUser.user_metadata?.role ||
          supabaseUser.app_metadata?.role ||
          'customer'
      ),
      verification: {
        ...defaultVerification,
        ...records[email],
      },
    }
  }, [])

  /* -------------------------------------------------------
     Load Supabase session + listen for auth changes
  ------------------------------------------------------- */

  const syncUserFromSession = useCallback(
    async (session) => {
      const supabaseUser = session?.user || null

      if (!supabaseUser) {
        setUser(null)
        setAuthReady(true)
        return
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(
            'id, email, full_name, role, phone, country, avatar_url, status'
          )
          .eq('id', supabaseUser.id)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        setUser(createGiftlyUser(supabaseUser, profile))
      } catch (error) {
        console.error('Profile loading error:', error)
        setUser(createGiftlyUser(supabaseUser, null))
      } finally {
        setAuthReady(true)
      }
    },
    [createGiftlyUser]
  )

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!mounted) return

        await syncUserFromSession(session)
      } catch (error) {
        console.error(
          'Supabase session error:',
          error
        )
        if (mounted) {
          setUser(null)
          setAuthReady(true)
        }
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return
        syncUserFromSession(session)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [syncUserFromSession])

  /* -------------------------------------------------------
     Keep Giftly user data locally available
  ------------------------------------------------------- */

  useEffect(() => {
    if (user) {
      localStorage.setItem(
        'giftly-user',
        JSON.stringify(user)
      )
    } else {
      localStorage.removeItem('giftly-user')
    }
  }, [user])

  /* -------------------------------------------------------
     Save verification records
  ------------------------------------------------------- */

  useEffect(() => {
    if (!user) return

    const records = stored(
      'giftly-verification-records',
      {}
    )

    localStorage.setItem(
      'giftly-verification-records',
      JSON.stringify({
        ...records,
        [user.email]: user.verification,
      })
    )
  }, [user])

  /* -------------------------------------------------------
     Supabase passwordless login
  ------------------------------------------------------- */

  const login = async (email, name = '', mode = 'login') => {
    const cleanEmail = (email || '').trim().toLowerCase()

    if (!cleanEmail) {
      throw new Error('Please enter your email address.')
    }

    const cleanName = (name || '').trim()
    const otpOptions = {
      data: {
        name:
          cleanName ||
          cleanEmail.split('@')[0] ||
          'Giftly Member',
        role:
          mode === 'register' ? 'customer' : undefined,
      },
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: otpOptions,
    })

    if (error) {
      throw error
    }
  }

  const register = async (email, name) =>
    login(email, name, 'register')

  /* -------------------------------------------------------
     Update user verification
  ------------------------------------------------------- */

  const updateVerification = (changes) =>
    setUser((current) =>
      current
        ? {
            ...current,

            verification: {
              ...defaultVerification,
              ...current.verification,
              ...changes,
            },
          }
        : current
    )

  /* -------------------------------------------------------
     Gift card verification
  ------------------------------------------------------- */

  const saveGiftCardVerification = (record) => {
    const allowedFields = [
      'id',
      'referenceId',
      'brand',
      'country',
      'currency',
      'cardType',
      'maskedCardNumber',
      'verificationStatus',
      'balanceStatus',
      'mockBalance',
      'cardStatus',
      'reason',
      'submittedAt',
      'verifiedAt',
      'riskStatus',
      'riskFlags',
      'detailsVerified',
    ]

    const safeRecord = Object.fromEntries(
      allowedFields
        .filter((field) => field in record)
        .map((field) => [
          field,
          record[field],
        ])
    )

    safeRecord.userId = user?.email || ''
    safeRecord.userName =
      user?.name || 'Giftly member'

    setAllGiftCardVerifications(
      (current) => [
        safeRecord,
        ...current.filter(
          (item) => item.id !== safeRecord.id
        ),
      ]
    )

    return safeRecord
  }

  const updateGiftCardVerification = (
    id,
    changes
  ) =>
    setAllGiftCardVerifications(
      (current) =>
        current.map((record) =>
          record.id === id
            ? {
                ...record,
                ...changes,
              }
            : record
        )
    )

  const giftCardVerifications =
    allGiftCardVerifications.filter(
      (record) =>
        record.userId === user?.email
    )

  /* -------------------------------------------------------
     Logout
  ------------------------------------------------------- */

  const logout = async () => {
    const { error } =
      await supabase.auth.signOut()

    if (error) {
      console.error(
        'Supabase logout error:',
        error
      )
    }

    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        login,
        register,
        logout,
        updateVerification,
        giftCardVerifications,
        allGiftCardVerifications,
        saveGiftCardVerification,
        updateGiftCardVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () =>
  useContext(AuthContext)

/* =========================================================
   WALLET
========================================================= */

const WalletContext = createContext(null)
export function WalletProvider({ children }) {
  const { user } = useAuth()
  const [wallet, setWallet] = useState(() => user?.email ? getWallet(user.email) : null)
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState('')
  const currentWallet = wallet?.userId === user?.email ? wallet : null

  const refreshWallet = () => {
    if (!user?.email) { setWallet(null); setLoading(false); return null }
    setLoading(true)
    try {
      const updated = getWallet(user.email)
      setWallet(updated)
      return updated
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!user?.email) return undefined
    const refresh = () => startTransition(() => {
      setWallet(getWallet(user.email))
      setLoading(false)
    })
    refresh()
    window.addEventListener(WALLET_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(WALLET_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [user?.email])

  const runWalletAction = (action, successMessage, notificationTitle = '') => {
    try {
      const result = action()
      refreshWallet()
      setNotification(successMessage)
      if (notificationTitle && user?.email && result?.id) createNotification({
        userId: user.email, type: 'WALLET', title: notificationTitle,
        message: result.description || successMessage,
        relatedId: result.id, relatedType: 'WALLET', href: `/wallet/transactions/${result.id}`,
      })
      return result
    } catch (error) {
      setNotification(error.message || 'Wallet error. Please try again.')
      throw error
    }
  }
  const deposit = (details) => runWalletAction(() => simulateDeposit({ ...details, userId: user?.email }), 'Deposit successful', 'Demo deposit recorded')
  const withdraw = (details) => runWalletAction(() => simulateWithdrawal({ ...details, userId: user?.email }), 'Withdrawal submitted for prototype processing', 'Demo withdrawal requested')
  const convert = (details) => runWalletAction(() => convertCurrency({ ...details, userId: user?.email }), 'Conversion successful', 'Demo currency conversion recorded')
  const setSelectedCurrency = (currency) => runWalletAction(() => savePreferredCurrency(user?.email, currency), 'Default currency updated')
  const transactions = user?.email ? getTransactions(user.email) : []

  return <WalletContext.Provider value={{ wallet: currentWallet, balances: currentWallet?.balances || {}, selectedCurrency: currentWallet?.preferredCurrency || 'INR', setSelectedCurrency, deposit, withdraw, convert, transactions, refreshWallet, loading, notification, setNotification }}>{children}</WalletContext.Provider>
}
export const useWallet = () => useContext(WalletContext)
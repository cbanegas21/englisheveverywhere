'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CURRENCIES as ALL_CURRENCIES,
  CURRENCY_MAP,
  type Currency as CurrencyDef,
  formatAmount,
} from './currencies'
import { prefetchRates, getCachedRate } from './fx'

// Backward-compat: old code imports `CURRENCIES` (array of codes) and
// `CURRENCY_INFO` (record of symbol/name/flag). Re-export in those shapes.
export const CURRENCIES = ALL_CURRENCIES.map(c => c.code)
export type Currency = string

export const CURRENCY_INFO: Record<string, { symbol: string; name: string; flag: string }> =
  Object.fromEntries(
    ALL_CURRENCIES.map((c: CurrencyDef) => [c.code, { symbol: c.symbol, name: c.name, flag: c.flag }])
  )

const STORAGE_KEY = 'ee_currency'
const CURRENCY_CHANGE_EVENT = 'ee-currency-change'

interface UseCurrencyOptions {
  initialCurrency?: string
  onPersist?: (code: string) => void | Promise<void>
}

export function useCurrency(opts: UseCurrencyOptions = {}) {
  const { initialCurrency, onPersist } = opts
  // Priority: server-provided initial → localStorage → 'USD'.
  // Lazy init so we read localStorage exactly once on first client render.
  const [currency, setCurrency] = useState<Currency>(() => {
    if (initialCurrency) return initialCurrency
    if (typeof window === 'undefined') return 'USD'
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved && CURRENCY_MAP[saved]) return saved
    } catch { /* ignore */ }
    return 'USD'
  })
  const [loading, setLoading] = useState(true)
  const [, forceRender] = useState(0)

  useEffect(() => {
    prefetchRates('USD').then(() => {
      setLoading(false)
      forceRender(n => n + 1)
    })

    const handler = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved && CURRENCY_MAP[saved]) setCurrency(saved)
      } catch { /* ignore */ }
    }
    window.addEventListener(CURRENCY_CHANGE_EVENT, handler)
    return () => window.removeEventListener(CURRENCY_CHANGE_EVENT, handler)
  }, [])

  const changeCurrency = useCallback((c: Currency) => {
    if (!CURRENCY_MAP[c]) return
    setCurrency(c)
    try {
      localStorage.setItem(STORAGE_KEY, c)
      window.dispatchEvent(new Event(CURRENCY_CHANGE_EVENT))
    } catch { /* ignore */ }
    if (onPersist) {
      void Promise.resolve(onPersist(c)).catch(() => { /* swallow */ })
    }
  }, [onPersist])

  const convert = useCallback((usdAmount: number): string => {
    if (currency === 'USD') return formatAmount(usdAmount, 'USD')
    const rate = getCachedRate('USD', currency)
    return formatAmount(usdAmount * rate, currency)
  }, [currency])

  return {
    currency,
    changeCurrency,
    convert,
    info: CURRENCY_MAP[currency] || CURRENCY_MAP.USD,
    loading,
    CURRENCIES,
    CURRENCY_INFO,
  }
}

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
  // localStorage is read in an effect, NOT the initializer: the server renders
  // 'USD', so the first client render must too or hydration fails whenever a
  // visitor has a saved non-USD currency (Sentry ENGLISHKOLAB-7).
  const [currency, setCurrency] = useState<Currency>(() => initialCurrency ?? 'USD')
  const [loading, setLoading] = useState(true)
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!initialCurrency) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        if (saved && CURRENCY_MAP[saved]) setCurrency(saved)
      } catch { /* ignore */ }
    }
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
  }, [initialCurrency])

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
    // getCachedRate returns 1 as a sentinel when no rate is cached (FX API down /
    // not yet warmed). A real USD->non-USD rate is never exactly 1, so treat 1 as
    // "unavailable" and show the honest USD price rather than the local symbol at
    // 1:1 — which understates ~25x (e.g. "L129" instead of ~"L3,200") and reads as
    // a real (far cheaper) local price (FX-UNDERSTATEMENT-APIDOWN).
    if (rate === 1) return formatAmount(usdAmount, 'USD')
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

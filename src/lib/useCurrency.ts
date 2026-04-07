'use client'

import { useState, useEffect, useCallback } from 'react'

export const CURRENCIES = ['USD', 'HNL', 'COP', 'MXN', 'ARS'] as const
export type Currency = typeof CURRENCIES[number]

export const CURRENCY_INFO: Record<Currency, { symbol: string; name: string; flag: string }> = {
  USD: { symbol: '$',    name: 'USD', flag: '🇺🇸' },
  HNL: { symbol: 'L',   name: 'HNL', flag: '🇭🇳' },
  COP: { symbol: 'COP$', name: 'COP', flag: '🇨🇴' },
  MXN: { symbol: 'MX$', name: 'MXN', flag: '🇲🇽' },
  ARS: { symbol: 'AR$', name: 'ARS', flag: '🇦🇷' },
}

const STORAGE_KEY = 'ee_currency'
const CURRENCY_CHANGE_EVENT = 'ee-currency-change'

export function useCurrency() {
  const [currency, setCurrency] = useState<Currency>('USD')
  const [rates, setRates] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load saved currency
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Currency
      if (saved && CURRENCIES.includes(saved)) setCurrency(saved)
    } catch { /* ignore */ }

    // Fetch live rates
    fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
      .then(r => r.json())
      .then(data => {
        setRates(data?.usd || {})
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // Listen for currency changes from other components
    const handler = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) as Currency
        if (saved && CURRENCIES.includes(saved)) setCurrency(saved)
      } catch { /* ignore */ }
    }
    window.addEventListener(CURRENCY_CHANGE_EVENT, handler)
    return () => window.removeEventListener(CURRENCY_CHANGE_EVENT, handler)
  }, [])

  const changeCurrency = useCallback((c: Currency) => {
    setCurrency(c)
    try {
      localStorage.setItem(STORAGE_KEY, c)
      window.dispatchEvent(new Event(CURRENCY_CHANGE_EVENT))
    } catch { /* ignore */ }
  }, [])

  const convert = useCallback((usdAmount: number): string => {
    const info = CURRENCY_INFO[currency]
    if (currency === 'USD') return `${info.symbol}${usdAmount}`
    const rate = rates[currency.toLowerCase()]
    if (!rate) return `${info.symbol}${usdAmount}`
    const converted = Math.round(usdAmount * rate)
    if (converted >= 1_000_000) return `${info.symbol}${(converted / 1_000_000).toFixed(1)}M`
    if (converted >= 10_000) return `${info.symbol}${(converted / 1_000).toFixed(1)}K`
    return `${info.symbol}${converted.toLocaleString()}`
  }, [currency, rates])

  return {
    currency,
    changeCurrency,
    convert,
    info: CURRENCY_INFO[currency],
    loading,
    CURRENCIES,
    CURRENCY_INFO,
  }
}

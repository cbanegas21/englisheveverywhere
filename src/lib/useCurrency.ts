'use client'

import { useState, useEffect, useCallback } from 'react'

export const CURRENCIES = [
  'USD', 'HNL', 'MXN', 'GTQ', 'CRC', 'COP', 'ARS', 'CLP',
  'BRL', 'PEN', 'BOB', 'PYG', 'UYU', 'VES', 'NIO', 'DOP',
  'PAB', 'SVC', 'EUR', 'GBP',
] as const
export type Currency = typeof CURRENCIES[number]

export const CURRENCY_INFO: Record<Currency, { symbol: string; name: string; flag: string }> = {
  USD: { symbol: '$',    name: 'USD', flag: '🇺🇸' },
  HNL: { symbol: 'L',   name: 'HNL', flag: '🇭🇳' },
  MXN: { symbol: 'MX$', name: 'MXN', flag: '🇲🇽' },
  GTQ: { symbol: 'Q',   name: 'GTQ', flag: '🇬🇹' },
  CRC: { symbol: '₡',   name: 'CRC', flag: '🇨🇷' },
  COP: { symbol: 'COP$',name: 'COP', flag: '🇨🇴' },
  ARS: { symbol: 'AR$', name: 'ARS', flag: '🇦🇷' },
  CLP: { symbol: 'CL$', name: 'CLP', flag: '🇨🇱' },
  BRL: { symbol: 'R$',  name: 'BRL', flag: '🇧🇷' },
  PEN: { symbol: 'S/',  name: 'PEN', flag: '🇵🇪' },
  BOB: { symbol: 'Bs.', name: 'BOB', flag: '🇧🇴' },
  PYG: { symbol: '₲',   name: 'PYG', flag: '🇵🇾' },
  UYU: { symbol: '$U',  name: 'UYU', flag: '🇺🇾' },
  VES: { symbol: 'Bs.S',name: 'VES', flag: '🇻🇪' },
  NIO: { symbol: 'C$',  name: 'NIO', flag: '🇳🇮' },
  DOP: { symbol: 'RD$', name: 'DOP', flag: '🇩🇴' },
  PAB: { symbol: 'B/.',  name: 'PAB', flag: '🇵🇦' },
  SVC: { symbol: '₡',   name: 'SVC', flag: '🇸🇻' },
  EUR: { symbol: '€',   name: 'EUR', flag: '🇪🇺' },
  GBP: { symbol: '£',   name: 'GBP', flag: '🇬🇧' },
}

const STORAGE_KEY = 'ee_currency'
const RATES_STORAGE_KEY = 'ee_rates'
const RATES_TTL_MS = 60 * 60 * 1000 // 1 hour
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

    // Load cached rates or fetch fresh
    let shouldFetch = true
    try {
      const cached = localStorage.getItem(RATES_STORAGE_KEY)
      if (cached) {
        const { ts, data } = JSON.parse(cached)
        if (Date.now() - ts < RATES_TTL_MS) {
          setRates(data)
          setLoading(false)
          shouldFetch = false
        }
      }
    } catch { /* ignore */ }

    if (shouldFetch) {
      fetch('https://api.exchangerate-api.com/v4/latest/USD')
        .then(r => r.json())
        .then(data => {
          const r = data?.rates || {}
          setRates(r)
          setLoading(false)
          try {
            localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify({ ts: Date.now(), data: r }))
          } catch { /* ignore */ }
        })
        .catch(() => {
          // Fallback: try fawazahmed0 CDN
          fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
            .then(r => r.json())
            .then(data => {
              const r: Record<string, number> = {}
              const usdRates = data?.usd || {}
              // Convert keys to uppercase
              for (const k of Object.keys(usdRates)) {
                r[k.toUpperCase()] = usdRates[k]
              }
              setRates(r)
              setLoading(false)
            })
            .catch(() => setLoading(false))
        })
    }

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
    const rate = rates[currency] ?? rates[currency.toLowerCase()]
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

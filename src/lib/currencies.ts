// Currencies EnglishKolab actually bills in: USD/EUR/GBP anchors + Latin America.
// Pruned from the full ISO 4217 list (2026-06-03) — obscure currencies removed so
// the picker stays relevant to the LatAm audience. `country` is the ISO 3166-1
// alpha-2 code used to render a real SVG flag (flag-icons); `flag` emoji kept as a
// non-graphical fallback (emoji flags don't render on Windows).

export interface Currency {
  code: string     // ISO 4217 3-letter code
  name: string     // English name
  symbol: string   // Common symbol
  flag: string     // Unicode flag emoji (fallback only)
  country: string  // ISO 3166-1 alpha-2 (for flag-icons: <span class="fi fi-xx" />)
}

export const CURRENCIES: Currency[] = [
  // Anchors
  { code: 'USD', name: 'US Dollar',           symbol: '$',    flag: '🇺🇸', country: 'us' },
  { code: 'EUR', name: 'Euro',                symbol: '€',    flag: '🇪🇺', country: 'eu' },
  { code: 'GBP', name: 'British Pound',        symbol: '£',    flag: '🇬🇧', country: 'gb' },
  // Latin America
  { code: 'MXN', name: 'Mexican Peso',         symbol: 'MX$',  flag: '🇲🇽', country: 'mx' },
  { code: 'COP', name: 'Colombian Peso',       symbol: 'CO$',  flag: '🇨🇴', country: 'co' },
  { code: 'ARS', name: 'Argentine Peso',       symbol: 'AR$',  flag: '🇦🇷', country: 'ar' },
  { code: 'CLP', name: 'Chilean Peso',         symbol: 'CL$',  flag: '🇨🇱', country: 'cl' },
  { code: 'PEN', name: 'Peruvian Sol',         symbol: 'S/',   flag: '🇵🇪', country: 'pe' },
  { code: 'BRL', name: 'Brazilian Real',       symbol: 'R$',   flag: '🇧🇷', country: 'br' },
  { code: 'GTQ', name: 'Guatemalan Quetzal',   symbol: 'Q',    flag: '🇬🇹', country: 'gt' },
  { code: 'HNL', name: 'Honduran Lempira',     symbol: 'L',    flag: '🇭🇳', country: 'hn' },
  { code: 'NIO', name: 'Nicaraguan Córdoba',   symbol: 'C$',   flag: '🇳🇮', country: 'ni' },
  { code: 'CRC', name: 'Costa Rican Colón',    symbol: '₡',    flag: '🇨🇷', country: 'cr' },
  { code: 'PAB', name: 'Panamanian Balboa',    symbol: 'B/.',  flag: '🇵🇦', country: 'pa' },
  { code: 'DOP', name: 'Dominican Peso',       symbol: 'RD$',  flag: '🇩🇴', country: 'do' },
  { code: 'BOB', name: 'Bolivian Boliviano',   symbol: 'Bs',   flag: '🇧🇴', country: 'bo' },
  { code: 'PYG', name: 'Paraguayan Guaraní',   symbol: '₲',    flag: '🇵🇾', country: 'py' },
  { code: 'UYU', name: 'Uruguayan Peso',       symbol: '$U',   flag: '🇺🇾', country: 'uy' },
  { code: 'VES', name: 'Venezuelan Bolívar',   symbol: 'Bs.S', flag: '🇻🇪', country: 've' },
]

export const CURRENCY_MAP: Record<string, Currency> =
  Object.fromEntries(CURRENCIES.map(c => [c.code, c]))

export const CURRENCY_CODES = CURRENCIES.map(c => c.code)

export function getCurrency(code: string): Currency {
  return CURRENCY_MAP[code] || CURRENCY_MAP.USD
}

// Eurozone members that should resolve to EUR (the CURRENCIES entry uses the
// pseudo-country 'eu'). Spain matters most for this product's audience.
const EURO_COUNTRIES = new Set(['es', 'fr', 'de', 'it', 'pt', 'nl', 'be', 'at', 'ie', 'fi', 'gr', 'lu'])

/**
 * Map an ISO-3166 alpha-2 country (e.g. Vercel's x-vercel-ip-country) to a
 * supported currency code, or null when we don't carry that country's currency
 * (caller falls back to USD). Dollarized countries (EC/SV/PA-in-practice) fall
 * through to null → USD, which is correct.
 */
export function currencyForCountry(iso2: string | null | undefined): string | null {
  if (!iso2) return null
  const c = iso2.toLowerCase()
  if (c === 'us') return 'USD'
  if (EURO_COUNTRIES.has(c)) return 'EUR'
  return CURRENCIES.find(cur => cur.country === c)?.code ?? null
}

export function formatAmount(amount: number, code: string): string {
  const c = getCurrency(code)
  if (!Number.isFinite(amount)) return `${c.symbol}0`
  const abs = Math.abs(amount)
  // Use K/M suffix for large amounts so long HNL/VND/COP numbers stay compact.
  if (abs >= 1_000_000) return `${c.symbol}${(amount / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${c.symbol}${(amount / 1_000).toFixed(1)}K`
  // Keep cents for small amounts (per-class prices, teacher hourly rates) so a
  // $5.75 price doesn't round up to $6. For whole-number plan totals this
  // still renders cleanly ($49.00 → trimmed to $49).
  if (abs < 100) {
    const fixed = amount.toFixed(2)
    const trimmed = fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
    return `${c.symbol}${trimmed}`
  }
  return `${c.symbol}${Math.round(amount).toLocaleString()}`
}

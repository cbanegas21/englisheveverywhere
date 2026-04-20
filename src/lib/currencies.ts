// ISO 4217 currency list — active circulating currencies with country flag emojis.
// Source: ISO 4217 standard + Wikipedia currency list (trimmed to active, non-crypto).

export interface Currency {
  code: string   // ISO 4217 3-letter code
  name: string   // English name
  symbol: string // Common symbol
  flag: string   // Unicode flag emoji (regional indicator)
}

export const CURRENCIES: Currency[] = [
  { code: 'AED', name: 'UAE Dirham',             symbol: 'د.إ',  flag: '🇦🇪' },
  { code: 'AFN', name: 'Afghan Afghani',         symbol: '؋',    flag: '🇦🇫' },
  { code: 'ALL', name: 'Albanian Lek',           symbol: 'L',    flag: '🇦🇱' },
  { code: 'AMD', name: 'Armenian Dram',          symbol: '֏',    flag: '🇦🇲' },
  { code: 'ANG', name: 'Neth. Antillean Guilder',symbol: 'ƒ',    flag: '🇨🇼' },
  { code: 'AOA', name: 'Angolan Kwanza',         symbol: 'Kz',   flag: '🇦🇴' },
  { code: 'ARS', name: 'Argentine Peso',         symbol: 'AR$',  flag: '🇦🇷' },
  { code: 'AUD', name: 'Australian Dollar',      symbol: 'A$',   flag: '🇦🇺' },
  { code: 'AWG', name: 'Aruban Florin',          symbol: 'ƒ',    flag: '🇦🇼' },
  { code: 'AZN', name: 'Azerbaijani Manat',      symbol: '₼',    flag: '🇦🇿' },
  { code: 'BAM', name: 'Bosnia Mark',            symbol: 'KM',   flag: '🇧🇦' },
  { code: 'BBD', name: 'Barbadian Dollar',       symbol: 'Bds$', flag: '🇧🇧' },
  { code: 'BDT', name: 'Bangladeshi Taka',       symbol: '৳',    flag: '🇧🇩' },
  { code: 'BGN', name: 'Bulgarian Lev',          symbol: 'лв',   flag: '🇧🇬' },
  { code: 'BHD', name: 'Bahraini Dinar',         symbol: '.د.ب', flag: '🇧🇭' },
  { code: 'BIF', name: 'Burundian Franc',        symbol: 'FBu',  flag: '🇧🇮' },
  { code: 'BMD', name: 'Bermudian Dollar',       symbol: 'BD$',  flag: '🇧🇲' },
  { code: 'BND', name: 'Brunei Dollar',          symbol: 'B$',   flag: '🇧🇳' },
  { code: 'BOB', name: 'Bolivian Boliviano',     symbol: 'Bs.',  flag: '🇧🇴' },
  { code: 'BRL', name: 'Brazilian Real',         symbol: 'R$',   flag: '🇧🇷' },
  { code: 'BSD', name: 'Bahamian Dollar',        symbol: 'B$',   flag: '🇧🇸' },
  { code: 'BTN', name: 'Bhutanese Ngultrum',     symbol: 'Nu.',  flag: '🇧🇹' },
  { code: 'BWP', name: 'Botswana Pula',          symbol: 'P',    flag: '🇧🇼' },
  { code: 'BYN', name: 'Belarusian Ruble',       symbol: 'Br',   flag: '🇧🇾' },
  { code: 'BZD', name: 'Belize Dollar',          symbol: 'BZ$',  flag: '🇧🇿' },
  { code: 'CAD', name: 'Canadian Dollar',        symbol: 'C$',   flag: '🇨🇦' },
  { code: 'CDF', name: 'Congolese Franc',        symbol: 'FC',   flag: '🇨🇩' },
  { code: 'CHF', name: 'Swiss Franc',            symbol: 'CHF',  flag: '🇨🇭' },
  { code: 'CLP', name: 'Chilean Peso',           symbol: 'CL$',  flag: '🇨🇱' },
  { code: 'CNY', name: 'Chinese Yuan',           symbol: '¥',    flag: '🇨🇳' },
  { code: 'COP', name: 'Colombian Peso',         symbol: 'COP$', flag: '🇨🇴' },
  { code: 'CRC', name: 'Costa Rican Colón',      symbol: '₡',    flag: '🇨🇷' },
  { code: 'CUP', name: 'Cuban Peso',             symbol: '₱',    flag: '🇨🇺' },
  { code: 'CVE', name: 'Cape Verdean Escudo',    symbol: '$',    flag: '🇨🇻' },
  { code: 'CZK', name: 'Czech Koruna',           symbol: 'Kč',   flag: '🇨🇿' },
  { code: 'DJF', name: 'Djiboutian Franc',       symbol: 'Fdj',  flag: '🇩🇯' },
  { code: 'DKK', name: 'Danish Krone',           symbol: 'kr',   flag: '🇩🇰' },
  { code: 'DOP', name: 'Dominican Peso',         symbol: 'RD$',  flag: '🇩🇴' },
  { code: 'DZD', name: 'Algerian Dinar',         symbol: 'دج',   flag: '🇩🇿' },
  { code: 'EGP', name: 'Egyptian Pound',         symbol: 'E£',   flag: '🇪🇬' },
  { code: 'ERN', name: 'Eritrean Nakfa',         symbol: 'Nfk',  flag: '🇪🇷' },
  { code: 'ETB', name: 'Ethiopian Birr',         symbol: 'Br',   flag: '🇪🇹' },
  { code: 'EUR', name: 'Euro',                   symbol: '€',    flag: '🇪🇺' },
  { code: 'FJD', name: 'Fijian Dollar',          symbol: 'FJ$',  flag: '🇫🇯' },
  { code: 'FKP', name: 'Falkland Islands Pound', symbol: '£',    flag: '🇫🇰' },
  { code: 'GBP', name: 'British Pound',          symbol: '£',    flag: '🇬🇧' },
  { code: 'GEL', name: 'Georgian Lari',          symbol: '₾',    flag: '🇬🇪' },
  { code: 'GHS', name: 'Ghanaian Cedi',          symbol: '₵',    flag: '🇬🇭' },
  { code: 'GIP', name: 'Gibraltar Pound',        symbol: '£',    flag: '🇬🇮' },
  { code: 'GMD', name: 'Gambian Dalasi',         symbol: 'D',    flag: '🇬🇲' },
  { code: 'GNF', name: 'Guinean Franc',          symbol: 'FG',   flag: '🇬🇳' },
  { code: 'GTQ', name: 'Guatemalan Quetzal',     symbol: 'Q',    flag: '🇬🇹' },
  { code: 'GYD', name: 'Guyanese Dollar',        symbol: 'G$',   flag: '🇬🇾' },
  { code: 'HKD', name: 'Hong Kong Dollar',       symbol: 'HK$',  flag: '🇭🇰' },
  { code: 'HNL', name: 'Honduran Lempira',       symbol: 'L',    flag: '🇭🇳' },
  { code: 'HRK', name: 'Croatian Kuna',          symbol: 'kn',   flag: '🇭🇷' },
  { code: 'HTG', name: 'Haitian Gourde',         symbol: 'G',    flag: '🇭🇹' },
  { code: 'HUF', name: 'Hungarian Forint',       symbol: 'Ft',   flag: '🇭🇺' },
  { code: 'IDR', name: 'Indonesian Rupiah',      symbol: 'Rp',   flag: '🇮🇩' },
  { code: 'ILS', name: 'Israeli Shekel',         symbol: '₪',    flag: '🇮🇱' },
  { code: 'INR', name: 'Indian Rupee',           symbol: '₹',    flag: '🇮🇳' },
  { code: 'IQD', name: 'Iraqi Dinar',            symbol: 'ع.د',  flag: '🇮🇶' },
  { code: 'IRR', name: 'Iranian Rial',           symbol: '﷼',    flag: '🇮🇷' },
  { code: 'ISK', name: 'Icelandic Króna',        symbol: 'kr',   flag: '🇮🇸' },
  { code: 'JMD', name: 'Jamaican Dollar',        symbol: 'J$',   flag: '🇯🇲' },
  { code: 'JOD', name: 'Jordanian Dinar',        symbol: 'د.ا',  flag: '🇯🇴' },
  { code: 'JPY', name: 'Japanese Yen',           symbol: '¥',    flag: '🇯🇵' },
  { code: 'KES', name: 'Kenyan Shilling',        symbol: 'KSh',  flag: '🇰🇪' },
  { code: 'KGS', name: 'Kyrgyzstani Som',        symbol: 'с',    flag: '🇰🇬' },
  { code: 'KHR', name: 'Cambodian Riel',         symbol: '៛',    flag: '🇰🇭' },
  { code: 'KMF', name: 'Comorian Franc',         symbol: 'CF',   flag: '🇰🇲' },
  { code: 'KRW', name: 'South Korean Won',       symbol: '₩',    flag: '🇰🇷' },
  { code: 'KWD', name: 'Kuwaiti Dinar',          symbol: 'د.ك',  flag: '🇰🇼' },
  { code: 'KYD', name: 'Cayman Islands Dollar',  symbol: 'CI$',  flag: '🇰🇾' },
  { code: 'KZT', name: 'Kazakhstani Tenge',      symbol: '₸',    flag: '🇰🇿' },
  { code: 'LAK', name: 'Lao Kip',                symbol: '₭',    flag: '🇱🇦' },
  { code: 'LBP', name: 'Lebanese Pound',         symbol: 'ل.ل',  flag: '🇱🇧' },
  { code: 'LKR', name: 'Sri Lankan Rupee',       symbol: 'Rs',   flag: '🇱🇰' },
  { code: 'LRD', name: 'Liberian Dollar',        symbol: 'L$',   flag: '🇱🇷' },
  { code: 'LSL', name: 'Lesotho Loti',           symbol: 'L',    flag: '🇱🇸' },
  { code: 'LYD', name: 'Libyan Dinar',           symbol: 'ل.د',  flag: '🇱🇾' },
  { code: 'MAD', name: 'Moroccan Dirham',        symbol: 'د.م.', flag: '🇲🇦' },
  { code: 'MDL', name: 'Moldovan Leu',           symbol: 'L',    flag: '🇲🇩' },
  { code: 'MGA', name: 'Malagasy Ariary',        symbol: 'Ar',   flag: '🇲🇬' },
  { code: 'MKD', name: 'Macedonian Denar',       symbol: 'ден',  flag: '🇲🇰' },
  { code: 'MMK', name: 'Myanmar Kyat',           symbol: 'K',    flag: '🇲🇲' },
  { code: 'MNT', name: 'Mongolian Tögrög',       symbol: '₮',    flag: '🇲🇳' },
  { code: 'MOP', name: 'Macanese Pataca',        symbol: 'MOP$', flag: '🇲🇴' },
  { code: 'MRU', name: 'Mauritanian Ouguiya',    symbol: 'UM',   flag: '🇲🇷' },
  { code: 'MUR', name: 'Mauritian Rupee',        symbol: '₨',    flag: '🇲🇺' },
  { code: 'MVR', name: 'Maldivian Rufiyaa',      symbol: 'Rf',   flag: '🇲🇻' },
  { code: 'MWK', name: 'Malawian Kwacha',        symbol: 'MK',   flag: '🇲🇼' },
  { code: 'MXN', name: 'Mexican Peso',           symbol: 'MX$',  flag: '🇲🇽' },
  { code: 'MYR', name: 'Malaysian Ringgit',      symbol: 'RM',   flag: '🇲🇾' },
  { code: 'MZN', name: 'Mozambican Metical',     symbol: 'MT',   flag: '🇲🇿' },
  { code: 'NAD', name: 'Namibian Dollar',        symbol: 'N$',   flag: '🇳🇦' },
  { code: 'NGN', name: 'Nigerian Naira',         symbol: '₦',    flag: '🇳🇬' },
  { code: 'NIO', name: 'Nicaraguan Córdoba',     symbol: 'C$',   flag: '🇳🇮' },
  { code: 'NOK', name: 'Norwegian Krone',        symbol: 'kr',   flag: '🇳🇴' },
  { code: 'NPR', name: 'Nepalese Rupee',         symbol: '₨',    flag: '🇳🇵' },
  { code: 'NZD', name: 'New Zealand Dollar',     symbol: 'NZ$',  flag: '🇳🇿' },
  { code: 'OMR', name: 'Omani Rial',             symbol: 'ر.ع.', flag: '🇴🇲' },
  { code: 'PAB', name: 'Panamanian Balboa',      symbol: 'B/.',  flag: '🇵🇦' },
  { code: 'PEN', name: 'Peruvian Sol',           symbol: 'S/',   flag: '🇵🇪' },
  { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K',    flag: '🇵🇬' },
  { code: 'PHP', name: 'Philippine Peso',        symbol: '₱',    flag: '🇵🇭' },
  { code: 'PKR', name: 'Pakistani Rupee',        symbol: '₨',    flag: '🇵🇰' },
  { code: 'PLN', name: 'Polish Złoty',           symbol: 'zł',   flag: '🇵🇱' },
  { code: 'PYG', name: 'Paraguayan Guaraní',     symbol: '₲',    flag: '🇵🇾' },
  { code: 'QAR', name: 'Qatari Riyal',           symbol: 'ر.ق',  flag: '🇶🇦' },
  { code: 'RON', name: 'Romanian Leu',           symbol: 'lei',  flag: '🇷🇴' },
  { code: 'RSD', name: 'Serbian Dinar',          symbol: 'дин',  flag: '🇷🇸' },
  { code: 'RUB', name: 'Russian Ruble',          symbol: '₽',    flag: '🇷🇺' },
  { code: 'RWF', name: 'Rwandan Franc',          symbol: 'FRw',  flag: '🇷🇼' },
  { code: 'SAR', name: 'Saudi Riyal',            symbol: 'ر.س',  flag: '🇸🇦' },
  { code: 'SBD', name: 'Solomon Islands Dollar', symbol: 'SI$',  flag: '🇸🇧' },
  { code: 'SCR', name: 'Seychellois Rupee',      symbol: '₨',    flag: '🇸🇨' },
  { code: 'SDG', name: 'Sudanese Pound',         symbol: 'ج.س.', flag: '🇸🇩' },
  { code: 'SEK', name: 'Swedish Krona',          symbol: 'kr',   flag: '🇸🇪' },
  { code: 'SGD', name: 'Singapore Dollar',       symbol: 'S$',   flag: '🇸🇬' },
  { code: 'SHP', name: 'Saint Helena Pound',     symbol: '£',    flag: '🇸🇭' },
  { code: 'SLL', name: 'Sierra Leonean Leone',   symbol: 'Le',   flag: '🇸🇱' },
  { code: 'SOS', name: 'Somali Shilling',        symbol: 'S',    flag: '🇸🇴' },
  { code: 'SRD', name: 'Surinamese Dollar',      symbol: 'Sr$',  flag: '🇸🇷' },
  { code: 'STN', name: 'São Tomé Dobra',         symbol: 'Db',   flag: '🇸🇹' },
  { code: 'SVC', name: 'Salvadoran Colón',       symbol: '₡',    flag: '🇸🇻' },
  { code: 'SYP', name: 'Syrian Pound',           symbol: '£S',   flag: '🇸🇾' },
  { code: 'SZL', name: 'Eswatini Lilangeni',     symbol: 'L',    flag: '🇸🇿' },
  { code: 'THB', name: 'Thai Baht',              symbol: '฿',    flag: '🇹🇭' },
  { code: 'TJS', name: 'Tajikistani Somoni',     symbol: 'ЅМ',   flag: '🇹🇯' },
  { code: 'TMT', name: 'Turkmenistani Manat',    symbol: 'T',    flag: '🇹🇲' },
  { code: 'TND', name: 'Tunisian Dinar',         symbol: 'د.ت',  flag: '🇹🇳' },
  { code: 'TOP', name: 'Tongan Paʻanga',         symbol: 'T$',   flag: '🇹🇴' },
  { code: 'TRY', name: 'Turkish Lira',           symbol: '₺',    flag: '🇹🇷' },
  { code: 'TTD', name: 'Trinidad & Tobago Dollar', symbol: 'TT$', flag: '🇹🇹' },
  { code: 'TWD', name: 'Taiwan Dollar',          symbol: 'NT$',  flag: '🇹🇼' },
  { code: 'TZS', name: 'Tanzanian Shilling',     symbol: 'TSh',  flag: '🇹🇿' },
  { code: 'UAH', name: 'Ukrainian Hryvnia',      symbol: '₴',    flag: '🇺🇦' },
  { code: 'UGX', name: 'Ugandan Shilling',       symbol: 'USh',  flag: '🇺🇬' },
  { code: 'USD', name: 'US Dollar',              symbol: '$',    flag: '🇺🇸' },
  { code: 'UYU', name: 'Uruguayan Peso',         symbol: '$U',   flag: '🇺🇾' },
  { code: 'UZS', name: 'Uzbekistani Som',        symbol: "so'm", flag: '🇺🇿' },
  { code: 'VES', name: 'Venezuelan Bolívar',     symbol: 'Bs.S', flag: '🇻🇪' },
  { code: 'VND', name: 'Vietnamese Đồng',        symbol: '₫',    flag: '🇻🇳' },
  { code: 'VUV', name: 'Vanuatu Vatu',           symbol: 'Vt',   flag: '🇻🇺' },
  { code: 'WST', name: 'Samoan Tālā',            symbol: 'WS$',  flag: '🇼🇸' },
  { code: 'XAF', name: 'Central African Franc',  symbol: 'FCFA', flag: '🌍' },
  { code: 'XCD', name: 'East Caribbean Dollar',  symbol: 'EC$',  flag: '🌎' },
  { code: 'XOF', name: 'West African Franc',     symbol: 'CFA',  flag: '🌍' },
  { code: 'XPF', name: 'CFP Franc',              symbol: '₣',    flag: '🇵🇫' },
  { code: 'YER', name: 'Yemeni Rial',            symbol: '﷼',    flag: '🇾🇪' },
  { code: 'ZAR', name: 'South African Rand',     symbol: 'R',    flag: '🇿🇦' },
  { code: 'ZMW', name: 'Zambian Kwacha',         symbol: 'ZK',   flag: '🇿🇲' },
  { code: 'ZWL', name: 'Zimbabwean Dollar',      symbol: 'Z$',   flag: '🇿🇼' },
]

export const CURRENCY_MAP: Record<string, Currency> =
  Object.fromEntries(CURRENCIES.map(c => [c.code, c]))

export const CURRENCY_CODES = CURRENCIES.map(c => c.code)

export function getCurrency(code: string): Currency {
  return CURRENCY_MAP[code] || CURRENCY_MAP.USD
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

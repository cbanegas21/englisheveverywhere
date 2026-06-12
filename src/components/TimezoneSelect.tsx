'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Clock, ChevronDown, MapPin } from 'lucide-react'

interface Props {
  value: string
  onChange: (tz: string) => void
  lang?: string
  inputStyle?: React.CSSProperties
}

const translations = {
  en: { search: 'Search timezone…', noResults: 'No results', localTime: 'Local time:', detect: 'Use my timezone' },
  es: { search: 'Buscar zona horaria…', noResults: 'Sin resultados', localTime: 'Hora local:', detect: 'Usar mi zona' },
}

// Zones we float to the top of the (unfiltered) list — the markets EnglishKolab
// serves — so the common pick is one tap away instead of buried in 400 IANA ids.
const COMMON_ZONES = [
  'America/Tegucigalpa',
  'America/Mexico_City',
  'America/Bogota',
  'America/Guatemala',
  'America/El_Salvador',
  'America/Managua',
  'America/Costa_Rica',
  'America/Panama',
  'America/Lima',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/Madrid',
]

export default function TimezoneSelect({ value, onChange, lang = 'es', inputStyle }: Props) {
  const tx = translations[lang as keyof typeof translations] ?? translations.es
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || portalRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const allTimezones = useMemo(() => {
    try { return Intl.supportedValuesOf('timeZone') as string[] }
    catch {
      return [
        'America/Bogota', 'America/New_York', 'America/Chicago',
        'America/Los_Angeles', 'America/Mexico_City', 'America/Tegucigalpa',
        'Europe/Madrid', 'UTC',
      ]
    }
  }, [])

  // Unfiltered order: common zones first (de-duped), then everything else.
  const orderedTimezones = useMemo(() => {
    const common = COMMON_ZONES.filter((z) => allTimezones.includes(z))
    const rest = allTimezones.filter((z) => !common.includes(z))
    return [...common, ...rest]
  }, [allTimezones])

  function offsetOf(tz: string): string {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(now)
      return parts.find(p => p.type === 'timeZoneName')?.value ?? ''
    } catch { return '' }
  }

  function cityOf(tz: string): string {
    const segments = tz.split('/')
    return segments[segments.length - 1].replace(/_/g, ' ')
  }

  function timeOf(tz: string): string {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }).format(now)
    } catch { return '' }
  }

  // Human-first label: "Tegucigalpa · GMT-6 · 11:30 PM".
  function formatTzOption(tz: string) {
    try {
      const parts = [cityOf(tz), offsetOf(tz), timeOf(tz)].filter(Boolean)
      return parts.join(' · ')
    } catch { return tz }
  }

  function getLocalTime(tz: string) {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true, weekday: 'short' }).format(now)
    } catch { return '' }
  }

  const filteredTzs = useMemo(() => {
    if (!search) return orderedTimezones
    const q = search.toLowerCase()
    return orderedTimezones.filter(tz =>
      tz.toLowerCase().includes(q) ||
      formatTzOption(tz).toLowerCase().includes(q)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedTimezones, search, now])

  function detectMyZone() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) { onChange(tz); setOpen(false) }
    } catch { /* ignore */ }
  }

  function openDropdown() {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const width = rect.width
    // Position:fixed (viewport coords) so the menu never extends the document
    // height (no scrollbar flash → no layout shift), and clamp horizontally so
    // it never overflows the viewport edge.
    const vw = document.documentElement.clientWidth
    const maxLeft = vw - width - 8
    const left = Math.max(8, Math.min(rect.left, maxLeft))
    setDropdownPos({ top: rect.bottom + 4, left, width })
    setOpen(true)
    setSearch('')
  }

  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--ek-radius-md)',
    border: '1px solid var(--ek-border)',
    fontSize: '13px',
    color: 'var(--ek-text)',
    background: 'var(--ek-card)',
    outline: 'none',
    ...inputStyle,
  }

  return (
    <div>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (open ? setOpen(false) : openDropdown())}
          className="w-full flex items-center justify-between"
          style={{ ...baseStyle, cursor: 'pointer', textAlign: 'left' as const }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--ek-red)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--ek-border)')}
        >
          <span className="truncate">{value ? formatTzOption(value) : '—'}</span>
          <ChevronDown
            className="h-4 w-4 flex-shrink-0 ml-2 transition-transform"
            style={{ color: 'var(--ek-text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {mounted && open && dropdownPos && createPortal(
          <div
            ref={portalRef}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxWidth: 'calc(100vw - 16px)',
              zIndex: 9999,
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border)',
              borderRadius: 'var(--ek-radius-md)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              maxHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--ek-border-soft)', flexShrink: 0 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tx.search}
                className="block w-full text-[12px]"
                style={{ outline: 'none', border: 'none', background: 'transparent', color: 'var(--ek-text)' }}
                autoFocus
              />
              <button
                type="button"
                onClick={detectMyZone}
                className="inline-flex items-center gap-1 flex-shrink-0"
                style={{ fontSize: 11, fontWeight: 700, color: 'var(--ek-red)', background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                <MapPin className="h-3 w-3" />
                {tx.detect}
              </button>
            </div>
            <div className="overflow-y-auto flex-1" style={{ padding: 4 }}>
              {filteredTzs.slice(0, 150).map(tz => {
                const selected = tz === value
                return (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => { onChange(tz); setOpen(false); setSearch('') }}
                    className="w-full text-left text-[12px] transition-colors"
                    style={{
                      padding: '9px 10px',
                      borderRadius: 'var(--ek-radius-sm)',
                      background: selected ? 'var(--ek-red-tint)' : 'transparent',
                      color: selected ? 'var(--ek-red)' : 'var(--ek-text)',
                      fontWeight: selected ? 700 : 400,
                    }}
                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--ek-paper)' }}
                    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                  >
                    {formatTzOption(tz)}
                  </button>
                )
              })}
              {filteredTzs.length === 0 && (
                <div className="p-3 text-[12px]" style={{ color: 'var(--ek-text-muted)' }}>
                  {tx.noResults}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {value && (
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--ek-text-muted)' }}>
            <Clock className="h-3 w-3" />
            {tx.localTime} {getLocalTime(value)}
          </p>
          <button
            type="button"
            onClick={detectMyZone}
            className="inline-flex items-center gap-1 flex-shrink-0"
            style={{ fontSize: 11, fontWeight: 700, color: 'var(--ek-red)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <MapPin className="h-3 w-3" />
            {tx.detect}
          </button>
        </div>
      )}
    </div>
  )
}

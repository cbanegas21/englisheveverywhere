'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Clock, ChevronDown } from 'lucide-react'

interface Props {
  value: string
  onChange: (tz: string) => void
  lang?: string
  inputStyle?: React.CSSProperties
}

const translations = {
  en: { search: 'Search timezone...', noResults: 'No results', localTime: 'Local time:' },
  es: { search: 'Buscar zona horaria...', noResults: 'Sin resultados', localTime: 'Hora local:' },
}

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

  function formatTzOption(tz: string) {
    try {
      const offsetParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      }).formatToParts(now)
      const offset = offsetParts.find(p => p.type === 'timeZoneName')?.value ?? ''
      const segments = tz.split('/')
      const city = segments[segments.length - 1].replace(/_/g, ' ')
      const time = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(now)
      return `${offset} • ${city} • ${time}`
    } catch {
      return tz
    }
  }

  function getLocalTime(tz: string) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        weekday: 'short',
      }).format(now)
    } catch {
      return ''
    }
  }

  const filteredTzs = useMemo(() => {
    if (!search) return allTimezones
    const q = search.toLowerCase()
    return allTimezones.filter(tz =>
      tz.toLowerCase().includes(q) ||
      formatTzOption(tz).toLowerCase().includes(q)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTimezones, search, now])

  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1px solid #E5E7EB',
    fontSize: '13px',
    color: '#111111',
    background: '#fff',
    outline: 'none',
    ...inputStyle,
  }

  return (
    <div>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (open) {
              setOpen(false)
            } else {
              if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect()
                setDropdownPos({
                  top: rect.bottom + window.scrollY + 4,
                  left: rect.left + window.scrollX,
                  width: rect.width,
                })
              }
              setOpen(true)
              setSearch('')
            }
          }}
          className="w-full flex items-center justify-between"
          style={{ ...baseStyle, cursor: 'pointer', textAlign: 'left' as const }}
          onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
          onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
        >
          <span className="truncate">{value ? formatTzOption(value) : '—'}</span>
          <ChevronDown
            className="h-4 w-4 flex-shrink-0 ml-2 transition-transform"
            style={{ color: '#9CA3AF', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {mounted && open && dropdownPos && createPortal(
          <div
            ref={portalRef}
            style={{
              position: 'absolute',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
              background: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: '4px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              maxHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tx.search}
              className="block w-full px-3 py-2 text-[12px]"
              style={{ outline: 'none', borderBottom: '1px solid #E5E7EB', color: '#111111', flexShrink: 0 }}
              autoFocus
            />
            <div className="overflow-y-auto flex-1">
              {filteredTzs.slice(0, 150).map(tz => (
                <button
                  key={tz}
                  type="button"
                  onClick={() => { onChange(tz); setOpen(false); setSearch('') }}
                  className="w-full text-left px-3 py-2 text-[12px] transition-colors"
                  style={{
                    background: tz === value ? 'rgba(196,30,58,0.06)' : 'transparent',
                    color: tz === value ? '#C41E3A' : '#111111',
                  }}
                  onMouseEnter={e => { if (tz !== value) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (tz !== value) e.currentTarget.style.background = 'transparent' }}
                >
                  {formatTzOption(tz)}
                </button>
              ))}
              {filteredTzs.length === 0 && (
                <div className="p-3 text-[12px]" style={{ color: '#9CA3AF' }}>
                  {tx.noResults}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {value && (
        <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: '#9CA3AF' }}>
          <Clock className="h-3 w-3" />
          {tx.localTime} {getLocalTime(value)}
        </p>
      )}
    </div>
  )
}

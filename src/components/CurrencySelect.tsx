'use client'

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, Check } from 'lucide-react'
import { CURRENCIES, getCurrency } from '@/lib/currencies'

interface Props {
  value: string
  onChange: (code: string) => void
  lang?: string
  // Visual variants
  variant?: 'light' | 'dark'
  // Size
  compact?: boolean
  buttonStyle?: React.CSSProperties
}

const translations = {
  en: { search: 'Search currency…', noResults: 'No currencies match' },
  es: { search: 'Buscar moneda…',   noResults: 'Sin resultados' },
}

export default function CurrencySelect({
  value,
  onChange,
  lang = 'es',
  variant = 'light',
  compact = false,
  buttonStyle,
}: Props) {
  const tx = translations[lang as keyof typeof translations] ?? translations.es
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

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

  const selected = getCurrency(value)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return CURRENCIES
    return CURRENCIES.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
    )
  }, [search])

  function updateSearch(v: string) {
    setSearch(v)
    setHighlightIdx(0)
  }

  // Scroll highlighted option into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlightIdx}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  function openDropdown() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuWidth = Math.max(rect.width, 280)
      setDropdownPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: menuWidth,
      })
    }
    setOpen(true)
    setSearch('')
    setHighlightIdx(Math.max(0, CURRENCIES.findIndex(c => c.code === value)))
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function selectCode(code: string) {
    onChange(code)
    setOpen(false)
    setSearch('')
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = filtered[highlightIdx]
      if (pick) selectCode(pick.code)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const isDark = variant === 'dark'

  const lightBtn: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E5E7EB',
    color: '#111111',
  }
  const darkBtn: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(249,249,249,0.9)',
  }

  return (
    <div className="relative" style={{ display: 'inline-block' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="flex items-center gap-2 transition-all"
        style={{
          padding: compact ? '6px 10px' : '9px 12px',
          borderRadius: '8px',
          fontSize: compact ? '12px' : '13px',
          fontWeight: 600,
          cursor: 'pointer',
          minWidth: compact ? '88px' : '120px',
          ...(isDark ? darkBtn : lightBtn),
          ...buttonStyle,
        }}
        onMouseEnter={e => {
          if (isDark) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
          else e.currentTarget.style.borderColor = '#C41E3A'
        }}
        onMouseLeave={e => {
          if (!open) {
            if (isDark) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
            else e.currentTarget.style.borderColor = '#E5E7EB'
          }
        }}
      >
        <span style={{ fontSize: compact ? '14px' : '16px', lineHeight: 1 }}>{selected.flag}</span>
        <span>{selected.code}</span>
        <ChevronDown
          className="ml-auto transition-transform"
          style={{
            height: '14px',
            width: '14px',
            opacity: 0.6,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
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
            maxWidth: 'calc(100vw - 16px)',
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '360px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderBottom: '1px solid #F3F4F6',
              flexShrink: 0,
            }}
          >
            <Search className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => updateSearch(e.target.value)}
              onKeyDown={handleKey}
              placeholder={tx.search}
              style={{
                flex: 1,
                outline: 'none',
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                color: '#111111',
              }}
            />
          </div>

          <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#9CA3AF' }}>
                {tx.noResults}
              </div>
            ) : (
              filtered.map((c, i) => {
                const isSelected = c.code === value
                const isHighlight = i === highlightIdx
                return (
                  <button
                    key={c.code}
                    data-idx={i}
                    type="button"
                    onClick={() => selectCode(c.code)}
                    onMouseEnter={() => setHighlightIdx(i)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      textAlign: 'left',
                      color: isSelected ? '#C41E3A' : '#111111',
                      background: isHighlight
                        ? (isSelected ? 'rgba(196,30,58,0.08)' : '#F9FAFB')
                        : (isSelected ? 'rgba(196,30,58,0.04)' : 'transparent'),
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                    <span style={{
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      flexShrink: 0,
                      width: '42px',
                    }}>
                      {c.code}
                    </span>
                    <span style={{
                      flex: 1,
                      fontSize: '12px',
                      color: isSelected ? '#C41E3A' : '#6B7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {c.name}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#C41E3A' }} />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

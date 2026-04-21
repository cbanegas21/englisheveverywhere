'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'

interface Props { lang: string }

export default function AdminLangToggle({ lang }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, setIsPending] = useState(false)

  // Next.js 16 caches the [lang] route segment, so a plain router.push
  // to /<other-lang>/<same-rest> leaves the sidebar + page content
  // rendering in the old language — the URL updates but the tree
  // doesn't rebuild with the new segment. A full-page navigation via
  // location.assign is the simplest reliable fix for an action the
  // user only triggers occasionally (Fathom bug #24).
  function switchTo(target: 'es' | 'en') {
    if (target === lang || isPending) return
    const rest = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), '') || ''
    const qs = searchParams?.toString()
    const next = `/${target}${rest}${qs ? `?${qs}` : ''}`
    setIsPending(true)
    window.location.assign(next)
  }

  const btn = (target: 'es' | 'en', label: string) => {
    const active = lang === target
    return (
      <button
        type="button"
        onClick={() => switchTo(target)}
        disabled={active || isPending}
        className="text-[11px] font-bold tracking-wide transition-colors"
        style={{
          padding: '4px 8px',
          borderRadius: 6,
          background: active ? '#111111' : 'transparent',
          color: active ? '#fff' : '#9CA3AF',
          border: 'none',
          cursor: active ? 'default' : isPending ? 'wait' : 'pointer',
          opacity: isPending && !active ? 0.5 : 1,
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      className="flex items-center"
      style={{ background: '#F4F4F5', borderRadius: 8, padding: 2, gap: 2 }}
    >
      {btn('es', 'ES')}
      {btn('en', 'EN')}
    </div>
  )
}

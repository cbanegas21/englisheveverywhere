'use client'

import { usePathname, useRouter } from 'next/navigation'

interface Props { lang: string }

export default function AdminLangToggle({ lang }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  function switchTo(target: 'es' | 'en') {
    if (target === lang) return
    const next = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${target}`)
    router.push(next)
  }

  const btn = (target: 'es' | 'en', label: string) => {
    const active = lang === target
    return (
      <button
        type="button"
        onClick={() => switchTo(target)}
        className="text-[11px] font-bold tracking-wide transition-colors"
        style={{
          padding: '4px 8px',
          borderRadius: 6,
          background: active ? '#111111' : 'transparent',
          color: active ? '#fff' : '#9CA3AF',
          border: 'none',
          cursor: active ? 'default' : 'pointer',
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

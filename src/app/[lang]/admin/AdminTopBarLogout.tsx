'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props { lang: string }

export default function AdminTopBarLogout({ lang }: Props) {
  const router = useRouter()
  const label = lang === 'es' ? 'Cerrar sesión' : 'Sign out'

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${lang}/login`)
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      title={label}
      aria-label={label}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
      style={{ color: '#4B5563', border: '1px solid #E5E7EB', background: '#fff' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#FCA5A5'
        e.currentTarget.style.color = '#DC2626'
        e.currentTarget.style.background = '#FEF2F2'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#E5E7EB'
        e.currentTarget.style.color = '#4B5563'
        e.currentTarget.style.background = '#fff'
      }}
    >
      <LogOut className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}

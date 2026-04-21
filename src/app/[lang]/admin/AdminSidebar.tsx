'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, GraduationCap, CalendarCheck, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props { lang: string }

export default function AdminSidebar({ lang }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${lang}/login`)
  }

  const labels = lang === 'es'
    ? { overview: 'Resumen', students: 'Estudiantes', teachers: 'Maestros', bookings: 'Reservas', signOut: 'Cerrar sesión', adminPanel: 'Panel admin' }
    : { overview: 'Overview', students: 'Students', teachers: 'Teachers', bookings: 'Bookings', signOut: 'Sign out', adminPanel: 'Admin Panel' }

  const nav = [
    { href: `/${lang}/admin/overview`,  label: labels.overview,  icon: LayoutDashboard },
    { href: `/${lang}/admin/students`,  label: labels.students,  icon: Users },
    { href: `/${lang}/admin/teachers`,  label: labels.teachers,  icon: GraduationCap },
    { href: `/${lang}/admin/bookings`,  label: labels.bookings,  icon: CalendarCheck },
  ]

  return (
    <aside
      className="flex flex-col w-[220px] min-h-screen flex-shrink-0"
      style={{ background: '#111111', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          className="h-8 w-8 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0"
          style={{ background: '#C41E3A', color: '#fff' }}
        >
          EK
        </div>
        <div>
          <p className="text-[12px] font-black text-white leading-none">EnglishKolab</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{labels.adminPanel}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all"
              style={{
                background: active ? 'rgba(196,30,58,0.15)' : 'transparent',
                color: active ? '#C41E3A' : 'rgba(255,255,255,0.55)',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                }
              }}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: '#C41E3A' }} />}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all w-full"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
          }}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {labels.signOut}
        </button>
      </div>
    </aside>
  )
}

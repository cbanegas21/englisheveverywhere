'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import type { Locale } from '@/lib/i18n/translations'
import { EKMark } from '@/components/ui/EKMark'

interface NavItem {
  label: string
  href: string
  badge?: string
}

const studentNav = {
  en: [
    { label: 'Home', href: '/dashboard' },
    { label: 'My classes', href: '/dashboard/clases' },
    { label: 'Schedule', href: '/dashboard/agendar' },
    { label: 'Homework', href: '/dashboard/tareas' },
    { label: 'Library', href: '/dashboard/biblioteca' },
    { label: 'My teacher', href: '/dashboard/maestros' },
    { label: 'My progress', href: '/dashboard/progreso' },
    { label: 'My plan', href: '/dashboard/plan' },
    { label: 'Settings', href: '/dashboard/configuracion' },
  ] as NavItem[],
  es: [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Mis clases', href: '/dashboard/clases' },
    { label: 'Agendar', href: '/dashboard/agendar' },
    { label: 'Tareas', href: '/dashboard/tareas' },
    { label: 'Biblioteca', href: '/dashboard/biblioteca' },
    { label: 'Mi maestro', href: '/dashboard/maestros' },
    { label: 'Mi progreso', href: '/dashboard/progreso' },
    { label: 'Mi plan', href: '/dashboard/plan' },
    { label: 'Configuración', href: '/dashboard/configuracion' },
  ] as NavItem[],
}

const teacherNav = {
  en: [
    { label: 'Home', href: '/maestro/dashboard' },
    { label: 'My schedule', href: '/maestro/dashboard/agenda' },
    { label: 'My students', href: '/maestro/dashboard/estudiantes' },
    { label: 'Homework', href: '/maestro/dashboard/tareas' },
    { label: 'Availability', href: '/maestro/dashboard/disponibilidad' },
    { label: 'Materials', href: '/maestro/dashboard/materiales' },
    { label: 'Earnings', href: '/maestro/dashboard/ganancias' },
    { label: 'Settings', href: '/maestro/dashboard/configuracion' },
  ] as NavItem[],
  es: [
    { label: 'Inicio', href: '/maestro/dashboard' },
    { label: 'Mi agenda', href: '/maestro/dashboard/agenda' },
    { label: 'Mis estudiantes', href: '/maestro/dashboard/estudiantes' },
    { label: 'Tareas', href: '/maestro/dashboard/tareas' },
    { label: 'Disponibilidad', href: '/maestro/dashboard/disponibilidad' },
    { label: 'Materiales', href: '/maestro/dashboard/materiales' },
    { label: 'Ganancias', href: '/maestro/dashboard/ganancias' },
    { label: 'Configuración', href: '/maestro/dashboard/configuracion' },
  ] as NavItem[],
}

interface SidebarProps {
  lang: Locale
  role: 'student' | 'teacher'
  userName: string
  userEmail: string
  avatarInitials: string
}

const NAV_DIM = 'rgba(244,239,230,0.5)'
const NAV_DIM_SOFT = 'rgba(244,239,230,0.42)'
const NAV_TEXT = '#F4EFE6'
const NAV_BORDER = 'rgba(244,239,230,0.10)'

// Hover/active handled in CSS (no inline-JS style mutation). Colors are inlined
// into the template because they're sidebar-specific (cream-on-ink), not globals.
const SIDEBAR_STYLES = `
.ek-side-link {
  color: ${NAV_DIM};
  transition: color 0.16s ease, background 0.16s ease;
}
.ek-side-link:hover { color: ${NAV_TEXT}; }
.ek-side-link[data-active="true"],
.ek-side-link[data-active="true"]:hover { color: var(--ek-red); }
.ek-side-foot {
  color: ${NAV_DIM_SOFT};
  transition: color 0.16s ease, opacity 0.16s ease;
}
.ek-side-foot:hover { color: ${NAV_TEXT}; }
`

export default function Sidebar({ lang, role, userName, userEmail, avatarInitials }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const other = lang === 'en' ? 'es' : 'en'
  const otherLocalePath = pathname.replace(`/${lang}`, `/${other}`)
  const nav = role === 'teacher' ? teacherNav[lang] : studentNav[lang]

  function handleLocaleSwitch() {
    if (switching) return
    if (typeof window !== 'undefined') {
      localStorage.setItem('ee-locale', other)
      document.cookie = `ee-locale=${other}; path=/; max-age=31536000; SameSite=Lax`
    }
    setSwitching(true)
    setTimeout(() => {
      router.push(otherLocalePath, { scroll: false })
    }, 130)
  }

  function isActive(href: string) {
    const full = `/${lang}${href}`
    const base = role === 'teacher' ? `/${lang}/maestro/dashboard` : `/${lang}/dashboard`
    if (full === base) return pathname === full
    return pathname.startsWith(full)
  }

  const text = NAV_TEXT
  const dim = NAV_DIM
  const dimSoft = NAV_DIM_SOFT
  const border = NAV_BORDER

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'var(--ek-ink)',
        borderRight: `1px solid ${border}`,
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      <style>{SIDEBAR_STYLES}</style>
      {/* Logo */}
      <div className="px-[18px] py-[18px]" style={{ borderBottom: `1px solid ${border}` }}>
        <Link
          href={`/${lang}`}
          className="inline-flex items-center gap-2"
          style={{ textDecoration: 'none', lineHeight: 1 }}
        >
          <EKMark size={26} bg="var(--ek-ink)" barColor="#F4EFE6" />
          <span style={{ color: text, fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>
            EnglishKolab
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto" style={{ padding: '12px 10px' }}>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {nav.map((item) => {
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={`/${lang}${item.href}`}
                  onClick={() => setMobileOpen(false)}
                  className="ek-side-link"
                  data-active={active ? 'true' : 'false'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '9px 13px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    background: active ? 'rgba(196,30,58,0.12)' : 'transparent',
                    boxShadow: active ? 'inset 3px 0 0 var(--ek-red)' : 'none',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 4,
                        padding: '2px 6px',
                        background: 'rgba(196,30,58,0.15)',
                        color: 'var(--ek-red)',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User section — bottom */}
      <div style={{ padding: 14, borderTop: `1px solid ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: 'rgba(196,30,58,0.18)',
              border: '1px solid rgba(196,30,58,0.28)',
              color: 'var(--ek-red)',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {avatarInitials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: text,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: dimSoft,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userEmail}
            </div>
          </div>
        </div>

        <button
          onClick={handleLocaleSwitch}
          className="ek-side-foot"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            marginBottom: 1,
            borderRadius: 6,
            fontSize: 11.5,
            opacity: switching ? 0.5 : 1,
            background: 'transparent',
            border: 0,
            cursor: switching ? 'default' : 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--ek-font-sans)',
          }}
        >
          <span
            className={`fi fi-${other === 'en' ? 'us' : 'es'}`}
            aria-hidden
            style={{ fontSize: 13, borderRadius: 2, lineHeight: 1, boxShadow: '0 0 0 1px rgba(255,255,255,0.12)' }}
          />
          <span>{other === 'en' ? 'Switch to English' : 'Cambiar a Español'}</span>
        </button>

        <a
          href="mailto:hola@englishkolab.com"
          className="ek-side-foot"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            marginBottom: 1,
            borderRadius: 6,
            fontSize: 11.5,
            textDecoration: 'none',
            fontFamily: 'var(--ek-font-sans)',
          }}
        >
          {lang === 'es' ? 'Ayuda y contacto' : 'Help & contact'}
        </a>

        <form action={signOut.bind(null, lang)}>
          <button
            type="submit"
            className="ek-side-foot"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 11.5,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'var(--ek-font-sans)',
            }}
          >
            {lang === 'es' ? 'Cerrar sesión' : 'Sign out'}
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-[224px] flex-col h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--ek-ink)', borderBottom: `1px solid ${border}` }}
      >
        <Link
          href={`/${lang}`}
          className="inline-flex items-center gap-2"
          style={{ textDecoration: 'none', lineHeight: 1 }}
        >
          <EKMark size={24} bg="var(--ek-ink)" barColor="#F4EFE6" />
          <span style={{ color: text, fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>
            EnglishKolab
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="ek-side-foot"
          style={{ background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex' }}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)' }}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[224px] z-50 flex flex-col"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

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
  glyph: string
  label: string
  href: string
  badge?: string
}

const studentNav = {
  en: [
    { glyph: '▤', label: 'Home', href: '/dashboard' },
    { glyph: '▦', label: 'My classes', href: '/dashboard/clases' },
    { glyph: '+', label: 'Schedule', href: '/dashboard/agendar' },
    { glyph: '✎', label: 'Homework', href: '/dashboard/tareas' },
    { glyph: '▥', label: 'Library', href: '/dashboard/biblioteca' },
    { glyph: '○', label: 'My teacher', href: '/dashboard/maestros' },
    { glyph: '↗', label: 'My progress', href: '/dashboard/progreso' },
    { glyph: '◇', label: 'My plan', href: '/dashboard/plan' },
    { glyph: '⚙', label: 'Settings', href: '/dashboard/configuracion' },
  ] as NavItem[],
  es: [
    { glyph: '▤', label: 'Inicio', href: '/dashboard' },
    { glyph: '▦', label: 'Mis clases', href: '/dashboard/clases' },
    { glyph: '+', label: 'Agendar', href: '/dashboard/agendar' },
    { glyph: '✎', label: 'Tareas', href: '/dashboard/tareas' },
    { glyph: '▥', label: 'Biblioteca', href: '/dashboard/biblioteca' },
    { glyph: '○', label: 'Mi maestro', href: '/dashboard/maestros' },
    { glyph: '↗', label: 'Mi progreso', href: '/dashboard/progreso' },
    { glyph: '◇', label: 'Mi plan', href: '/dashboard/plan' },
    { glyph: '⚙', label: 'Configuración', href: '/dashboard/configuracion' },
  ] as NavItem[],
}

const teacherNav = {
  en: [
    { glyph: '▤', label: 'Home', href: '/maestro/dashboard' },
    { glyph: '▦', label: 'My schedule', href: '/maestro/dashboard/agenda' },
    { glyph: '○', label: 'My students', href: '/maestro/dashboard/estudiantes' },
    { glyph: '✎', label: 'Homework', href: '/maestro/dashboard/tareas' },
    { glyph: '+', label: 'Availability', href: '/maestro/dashboard/disponibilidad' },
    { glyph: '▥', label: 'Materials', href: '/maestro/dashboard/materiales' },
    { glyph: '◇', label: 'Earnings', href: '/maestro/dashboard/ganancias' },
    { glyph: '⚙', label: 'Settings', href: '/maestro/dashboard/configuracion' },
  ] as NavItem[],
  es: [
    { glyph: '▤', label: 'Inicio', href: '/maestro/dashboard' },
    { glyph: '▦', label: 'Mi agenda', href: '/maestro/dashboard/agenda' },
    { glyph: '○', label: 'Mis estudiantes', href: '/maestro/dashboard/estudiantes' },
    { glyph: '✎', label: 'Tareas', href: '/maestro/dashboard/tareas' },
    { glyph: '+', label: 'Disponibilidad', href: '/maestro/dashboard/disponibilidad' },
    { glyph: '▥', label: 'Materiales', href: '/maestro/dashboard/materiales' },
    { glyph: '◇', label: 'Ganancias', href: '/maestro/dashboard/ganancias' },
    { glyph: '⚙', label: 'Configuración', href: '/maestro/dashboard/configuracion' },
  ] as NavItem[],
}

interface SidebarProps {
  lang: Locale
  role: 'student' | 'teacher'
  userName: string
  userEmail: string
  avatarInitials: string
}

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

  const dim = 'rgba(244,239,230,0.5)'
  const dimSoft = 'rgba(244,239,230,0.42)'
  const text = '#F4EFE6'
  const border = 'rgba(244,239,230,0.10)'

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'var(--ek-ink)',
        borderRight: `1px solid ${border}`,
        fontFamily: 'var(--ek-font-sans)',
      }}
    >
      {/* Logo */}
      <div
        className="px-[18px] py-[18px]"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <Link
          href={`/${lang}`}
          className="inline-flex items-center gap-2"
          style={{ textDecoration: 'none', lineHeight: 1 }}
        >
          <EKMark size={26} bg="var(--ek-ink)" barColor="#F4EFE6" />
          <span
            style={{
              color: text,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '-0.02em',
            }}
          >
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
                  className="transition-colors"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '9px 13px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--ek-red)' : dim,
                    background: active ? 'rgba(196,30,58,0.12)' : 'transparent',
                    boxShadow: active ? 'inset 3px 0 0 var(--ek-red)' : 'none',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.color = text
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.color = dim
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

        {/* Become a teacher */}
        {role === 'student' && (
          <>
            <div style={{ height: 14 }} />
            <Link
              href={`mailto:hola@englishkolab.com?subject=${encodeURIComponent(lang === 'es' ? 'Me interesa enseñar en EnglishKolab' : 'Interested in teaching at EnglishKolab')}`}
              className="transition-colors"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '9px 12px',
                marginTop: 4,
                paddingTop: 14,
                borderTop: `1px solid ${border}`,
                fontSize: 13,
                color: dim,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = text)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = dim)}
            >
              {lang === 'es' ? 'Enseñar en la plataforma' : 'Become a teacher'}
            </Link>
          </>
        )}
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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            marginBottom: 1,
            borderRadius: 6,
            fontSize: 11.5,
            color: dimSoft,
            opacity: switching ? 0.5 : 1,
            background: 'transparent',
            border: 0,
            cursor: switching ? 'default' : 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--ek-font-sans)',
          }}
          onMouseEnter={(e) => {
            if (!switching) e.currentTarget.style.color = text
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = dimSoft
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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            marginBottom: 1,
            borderRadius: 6,
            fontSize: 11.5,
            color: dimSoft,
            textDecoration: 'none',
            fontFamily: 'var(--ek-font-sans)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = dimSoft)}
        >
          <span style={{ width: 13, textAlign: 'center', fontFamily: 'var(--ek-font-mono)' }}>?</span>
          {lang === 'es' ? 'Ayuda y contacto' : 'Help & contact'}
        </a>

        <form action={signOut.bind(null, lang)}>
          <button
            type="submit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 11.5,
              color: dimSoft,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'var(--ek-font-sans)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = dimSoft)}
          >
            <span style={{ width: 13, textAlign: 'center', fontFamily: 'var(--ek-font-mono)' }}>⏻</span>
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
          style={{ color: dim, background: 'transparent', border: 0, cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = dim)}
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

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, Calendar, Users, BookOpen, CreditCard,
  Settings, LogOut, Menu, X, GraduationCap, Clock, BarChart3, ClipboardList,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import type { Locale } from '@/lib/i18n/translations'

interface NavItem { icon: React.ElementType; label: string; href: string; badge?: string }

const studentNav = {
  en: [
    { icon: LayoutDashboard, label: 'Home', href: '/dashboard' },
    { icon: Calendar, label: 'My classes', href: '/dashboard/clases' },
    { icon: ClipboardList, label: 'Homework', href: '/dashboard/tareas' },
    { icon: Users, label: 'My teacher', href: '/dashboard/maestros' },
    { icon: BarChart3, label: 'My progress', href: '/dashboard/progreso' },
    { icon: CreditCard, label: 'My plan', href: '/dashboard/plan' },
    { icon: Settings, label: 'Settings', href: '/dashboard/configuracion' },
  ] as NavItem[],
  es: [
    { icon: LayoutDashboard, label: 'Inicio', href: '/dashboard' },
    { icon: Calendar, label: 'Mis clases', href: '/dashboard/clases' },
    { icon: ClipboardList, label: 'Tareas', href: '/dashboard/tareas' },
    { icon: Users, label: 'Mi maestro', href: '/dashboard/maestros' },
    { icon: BarChart3, label: 'Mi progreso', href: '/dashboard/progreso' },
    { icon: CreditCard, label: 'Mi plan', href: '/dashboard/plan' },
    { icon: Settings, label: 'Configuración', href: '/dashboard/configuracion' },
  ] as NavItem[],
}

const teacherNav = {
  en: [
    { icon: LayoutDashboard, label: 'Home', href: '/maestro/dashboard' },
    { icon: Calendar, label: 'My schedule', href: '/maestro/dashboard/agenda' },
    { icon: GraduationCap, label: 'My students', href: '/maestro/dashboard/estudiantes' },
    { icon: ClipboardList, label: 'Homework', href: '/maestro/dashboard/tareas' },
    { icon: Clock, label: 'Availability', href: '/maestro/dashboard/disponibilidad' },
    { icon: BookOpen, label: 'Materials', href: '/maestro/dashboard/materiales' },
    { icon: CreditCard, label: 'Earnings', href: '/maestro/dashboard/ganancias' },
    { icon: Settings, label: 'Settings', href: '/maestro/dashboard/configuracion' },
  ] as NavItem[],
  es: [
    { icon: LayoutDashboard, label: 'Inicio', href: '/maestro/dashboard' },
    { icon: Calendar, label: 'Mi agenda', href: '/maestro/dashboard/agenda' },
    { icon: GraduationCap, label: 'Mis estudiantes', href: '/maestro/dashboard/estudiantes' },
    { icon: ClipboardList, label: 'Tareas', href: '/maestro/dashboard/tareas' },
    { icon: Clock, label: 'Disponibilidad', href: '/maestro/dashboard/disponibilidad' },
    { icon: BookOpen, label: 'Materiales', href: '/maestro/dashboard/materiales' },
    { icon: CreditCard, label: 'Ganancias', href: '/maestro/dashboard/ganancias' },
    { icon: Settings, label: 'Configuración', href: '/maestro/dashboard/configuracion' },
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

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{ background: '#111111', borderRight: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link href={`/${lang}`} className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-[9px] font-black"
            style={{ background: '#C41E3A', color: '#fff' }}
          >
            EK
          </div>
          <span className="font-black text-[14px]" style={{ color: '#F9F9F9' }}>
            EnglishKolab
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5 px-3">
          {nav.map((item) => {
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={`/${lang}${item.href}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded text-[13px] font-medium transition-all"
                  style={
                    active
                      ? { background: 'rgba(196,30,58,0.1)', color: '#C41E3A' }
                      : { color: 'rgba(249,249,249,0.5)' }
                  }
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(249,249,249,0.85)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(249,249,249,0.5)' }}
                >
                  <item.icon
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: active ? '#C41E3A' : 'inherit' }}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className="text-[10px] font-bold rounded px-1.5 py-0.5"
                      style={{ background: 'rgba(196,30,58,0.15)', color: '#C41E3A' }}
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
          <div className="mt-4 mx-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Link
              href={`/${lang}/maestro/dashboard`}
              className="flex items-center gap-3 px-3 py-2.5 rounded text-[13px] transition-all"
              style={{ color: 'rgba(249,249,249,0.5)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(249,249,249,0.85)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(249,249,249,0.5)' }}
            >
              <GraduationCap className="h-4 w-4 flex-shrink-0" style={{ color: 'inherit' }} />
              {lang === 'es' ? 'Enseñar en la plataforma' : 'Become a teacher'}
            </Link>
          </div>
        )}
      </nav>

      {/* User section — bottom */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{
              background: 'rgba(196,30,58,0.15)',
              color: '#C41E3A',
              border: '1px solid rgba(196,30,58,0.2)',
            }}
          >
            {avatarInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate" style={{ color: '#F9F9F9' }}>{userName}</div>
            <div className="text-[11px] truncate" style={{ color: 'rgba(249,249,249,0.4)' }}>{userEmail}</div>
          </div>
        </div>
        <button
          onClick={handleLocaleSwitch}
          className="flex items-center gap-2 w-full px-3 py-2 mb-1 rounded text-[12px] transition-all"
          style={{ color: 'rgba(249,249,249,0.4)', opacity: switching ? 0.5 : 1 }}
          onMouseEnter={e => { if (!switching) e.currentTarget.style.color = '#F9F9F9' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(249,249,249,0.4)' }}
        >
          <span style={{ fontSize: '14px' }}>{other === 'en' ? '🇺🇸' : '🇪🇸'}</span>
          <span>{other === 'en' ? 'Switch to English' : 'Cambiar a Español'}</span>
        </button>
        <form action={signOut.bind(null, lang)}>
          <button
            type="submit"
            className="flex items-center gap-2 w-full px-3 py-2 rounded text-[12px] transition-all"
            style={{ color: 'rgba(249,249,249,0.4)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#F9F9F9' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(249,249,249,0.4)' }}
          >
            <LogOut className="h-3.5 w-3.5" />
            {lang === 'es' ? 'Cerrar sesión' : 'Sign out'}
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-[220px] flex-col h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3"
        style={{ background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Link href={`/${lang}`} className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-black"
            style={{ background: '#C41E3A', color: '#fff' }}
          >
            EK
          </div>
          <span className="font-black text-[14px]" style={{ color: '#F9F9F9' }}>EnglishKolab</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="transition-colors"
          style={{ color: 'rgba(249,249,249,0.5)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F9F9F9')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(249,249,249,0.5)')}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)' }}
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[220px] z-50 flex flex-col"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

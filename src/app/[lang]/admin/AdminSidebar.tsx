'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EKMark } from '@/components/ui/EKMark'

interface Props { lang: string }

export default function AdminSidebar({ lang }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${lang}/login`)
  }

  const labels = lang === 'es'
    ? { overview: 'Resumen', students: 'Estudiantes', teachers: 'Maestros', bookings: 'Reservas', whatsapp: 'WhatsApp', library: 'Biblioteca', signOut: 'Cerrar sesión', adminPanel: 'Panel admin', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú' }
    : { overview: 'Overview', students: 'Students', teachers: 'Teachers', bookings: 'Bookings', whatsapp: 'WhatsApp', library: 'Library', signOut: 'Sign out', adminPanel: 'Admin Panel', openMenu: 'Open menu', closeMenu: 'Close menu' }

  // Mono glyphs match the student/teacher sidebar style — JBM mono characters
  // instead of Lucide icons for the editorial direction.
  const nav = [
    { href: `/${lang}/admin/overview`,   label: labels.overview, glyph: '▤' },
    { href: `/${lang}/admin/students`,   label: labels.students, glyph: '○' },
    { href: `/${lang}/admin/teachers`,   label: labels.teachers, glyph: '◯' },
    { href: `/${lang}/admin/bookings`,   label: labels.bookings, glyph: '▦' },
    { href: `/${lang}/admin/whatsapp`,   label: labels.whatsapp, glyph: '◇' },
    { href: `/${lang}/admin/biblioteca`, label: labels.library,  glyph: '▥' },
  ]

  const dim = 'rgba(244,239,230,0.5)'
  const text = '#F4EFE6'
  const border = 'rgba(244,239,230,0.10)'

  // Shared rail — rendered both in the desktop aside and inside the mobile
  // off-canvas drawer (mirrors the student/teacher Sidebar mechanics).
  const railContent = (
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
          href={`/${lang}/admin`}
          className="inline-flex items-center gap-2"
          style={{ textDecoration: 'none', lineHeight: 1 }}
          onClick={() => setMobileOpen(false)}
        >
          <EKMark size={26} bg="var(--ek-ink)" barColor="#F4EFE6" />
          <div>
            <div style={{ color: text, fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>
              EnglishKolab
            </div>
            <div
              style={{
                color: dim,
                fontSize: 10,
                marginTop: 2,
                fontFamily: 'var(--ek-font-mono)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {labels.adminPanel}
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '12px 10px' }}>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 1, margin: 0, padding: 0, listStyle: 'none' }}>
          {nav.map(({ href, label, glyph }) => {
            const active = pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '9px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: active ? 'var(--ek-red)' : dim,
                    background: active ? 'rgba(196,30,58,0.10)' : 'transparent',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.color = text
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.color = dim
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 16,
                      textAlign: 'center',
                      fontSize: 13,
                      opacity: active ? 1 : 0.7,
                      fontFamily: 'var(--ek-font-mono)',
                    }}
                  >
                    {glyph}
                  </span>
                  <span style={{ flex: 1 }}>{label}</span>
                  {active && (
                    <span
                      aria-hidden="true"
                      style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ek-red)' }}
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Sign out */}
      <div style={{ padding: '14px', borderTop: `1px solid ${border}` }}>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 11.5,
            color: 'rgba(244,239,230,0.42)',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--ek-font-sans)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = text)}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(244,239,230,0.42)')}
        >
          <span style={{ width: 13, textAlign: 'center', fontFamily: 'var(--ek-font-mono)' }}>⏻</span>
          {labels.signOut}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden md:flex w-[224px] flex-col h-screen sticky top-0 flex-shrink-0">
        {railContent}
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--ek-ink)', borderBottom: `1px solid ${border}` }}
      >
        <Link
          href={`/${lang}/admin`}
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
          style={{ background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex', color: text }}
          aria-label={mobileOpen ? labels.closeMenu : labels.openMenu}
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
              {railContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

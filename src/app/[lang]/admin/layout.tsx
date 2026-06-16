import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from './AdminSidebar'
import AdminLangToggle from './AdminLangToggle'
import AdminTopBarLogout from './AdminTopBarLogout'

interface Props {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

// Guards every route under /[lang]/admin.
// Only users with role = 'admin' in their profile may access.
export default async function AdminLayout({ children, params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect(`/${lang}/dashboard`)

  // Second-factor (2FA) gate. `nextLevel === 'aal2'` means the admin has a
  // VERIFIED authenticator enrolled; if the current session is still aal1, force
  // a TOTP step-up. The step-up page (/verificar-admin) lives OUTSIDE this layout
  // so there's no redirect loop. Crucially this only triggers once a factor is
  // enrolled — an admin who never sets up 2FA is never gated, so building this
  // can't lock anyone out. (Recovery if a device is lost: delete the factor via
  // the service-role admin API.)
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    redirect(`/${lang}/verificar-admin`)
  }

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'Admin'

  return (
    <div className="flex flex-col md:flex-row min-h-screen" style={{ background: 'var(--ek-paper)' }}>
      <AdminSidebar lang={lang} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="hidden md:flex items-center justify-between flex-shrink-0 px-4 py-3 md:px-7 md:py-[14px]"
          style={{
            background: 'var(--ek-card)',
            borderBottom: '1px solid var(--ek-border)',
            fontFamily: 'var(--ek-font-sans)',
          }}
        >
          <div />
          <div className="hidden md:flex items-center gap-3">
            <AdminLangToggle lang={lang} />
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--ek-red)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ek-text)' }}>{displayName}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 999,
                background: 'var(--ek-red-tint)',
                color: 'var(--ek-red)',
                fontFamily: 'var(--ek-font-mono)',
              }}
            >
              Admin
            </span>
            <div style={{ width: 1, height: 24, margin: '0 4px', background: 'var(--ek-border)' }} />
            <AdminTopBarLogout lang={lang} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 p-4 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}

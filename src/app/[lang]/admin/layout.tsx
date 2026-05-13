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

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'Admin'

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--ek-paper)' }}>
      <AdminSidebar lang={lang} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="flex items-center justify-between flex-shrink-0"
          style={{
            background: 'var(--ek-card)',
            borderBottom: '1px solid var(--ek-border)',
            padding: '14px 28px',
            fontFamily: 'var(--ek-font-sans)',
          }}
        >
          <div />
          <div className="flex items-center gap-3">
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
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

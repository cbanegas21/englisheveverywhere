import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from './AdminSidebar'

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
    <div className="flex min-h-screen" style={{ background: '#F4F4F5' }}>
      <AdminSidebar lang={lang} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="px-8 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}
        >
          <div />
          <div className="flex items-center gap-3">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: '#C41E3A' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[13px] font-medium" style={{ color: '#111111' }}>{displayName}</span>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(196,30,58,0.08)', color: '#C41E3A' }}
            >
              Admin
            </span>
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

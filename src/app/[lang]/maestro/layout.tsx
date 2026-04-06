import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default async function MaestroLayout({ children, params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect(`/${lang}/login`)
  }

  const role = user.user_metadata?.role as 'student' | 'teacher'

  // Students should not access teacher dashboard
  if (role !== 'teacher') {
    redirect(`/${lang}/dashboard`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const name = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Teacher'

  return (
    <div className="flex min-h-screen" style={{ background: '#F9F9F9' }}>
      <Sidebar
        lang={lang as Locale}
        role="teacher"
        userName={name}
        userEmail={user.email || ''}
        avatarInitials={getInitials(name)}
      />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}

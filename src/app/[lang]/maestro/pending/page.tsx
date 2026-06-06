import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/translations'
import { Logo } from '@/components/ui/Logo'

interface Props {
  params: Promise<{ lang: string }>
}

const t = {
  en: {
    headline: 'Your application is under review',
    sub: 'Our team is reviewing your teacher profile. You\'ll receive an email at the address you signed up with once your account is activated.',
    timeline: 'Typical review time: 24–48 hours',
    whatNext: 'What happens next?',
    steps: [
      'Our team reviews your bio, specializations, and certifications',
      'You receive an activation email',
      'You gain full access to your teacher dashboard',
    ],
    questions: 'Questions?',
    contact: 'Contact us at',
    logout: 'Sign out',
    alreadyActive: 'Already activated? Click here to access your dashboard.',
    dashboard: 'Go to dashboard',
  },
  es: {
    headline: 'Tu solicitud está siendo revisada',
    sub: 'Nuestro equipo está revisando tu perfil de maestro. Recibirás un correo en la dirección con la que te registraste cuando tu cuenta esté activada.',
    timeline: 'Tiempo de revisión típico: 24–48 horas',
    whatNext: '¿Qué sigue?',
    steps: [
      'Nuestro equipo revisa tu bio, especializaciones y certificaciones',
      'Recibes un correo de activación',
      'Obtienes acceso completo a tu dashboard de maestro',
    ],
    questions: '¿Preguntas?',
    contact: 'Escríbenos a',
    logout: 'Cerrar sesión',
    alreadyActive: '¿Ya activaste tu cuenta? Haz clic aquí para ir a tu dashboard.',
    dashboard: 'Ir al dashboard',
  },
}

export default async function MaestroPendingPage({ params }: Props) {
  const { lang } = await params
  const tx = t[lang as Locale]
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  // If teacher got activated since last visit, send them to dashboard
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (teacher?.is_active) {
    redirect(`/${lang}/maestro/dashboard`)
  }

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Teacher'

  async function handleSignOut() {
    'use server'
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const supabaseServer = await createServerClient()
    await supabaseServer.auth.signOut()
    redirect(`/${lang}/login`)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--ek-paper)' }}>
      {/* Top bar */}
      <div
        className="px-8 py-4 flex items-center justify-between"
        style={{ background: 'var(--ek-card)', borderBottom: '1px solid var(--ek-border)' }}
      >
        <Logo size={28} />
        <form action={handleSignOut}>
          <button type="submit" className="ek-link-muted" style={{ fontSize: 12 }}>
            {tx.logout}
          </button>
        </form>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[480px]">

          {/* Status — typographic crimson microlabel + hairline rule */}
          <div className="mb-8" style={{ textAlign: 'center' }}>
            <span className="ek-kicker ek-kicker--red" style={{ justifyContent: 'center' }}>
              {lang === 'es' ? 'En revisión' : 'Under review'}
            </span>
            <div style={{ borderTop: '1px solid var(--ek-border-soft)', marginTop: 14 }} />
          </div>

          {/* Headline */}
          <h1
            className="font-black text-center mb-3"
            style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', color: 'var(--ek-text)', lineHeight: 1.2 }}
          >
            {tx.headline}
          </h1>
          <p className="text-[14px] text-center leading-relaxed mb-2" style={{ color: 'var(--ek-text-soft)' }}>
            {tx.sub}
          </p>
          <p className="text-[12px] text-center mb-10" style={{ color: 'var(--ek-text-muted)' }}>
            {tx.timeline}
          </p>

          {/* What happens next */}
          <div
            className="p-6 mb-5"
            style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)' }}
          >
            <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--ek-text)' }}>
              {tx.whatNext}
            </h2>
            <ol className="space-y-3" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {tx.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      fontFamily: 'var(--ek-font-serif)',
                      fontSize: 20,
                      lineHeight: 1,
                      color: 'var(--ek-red)',
                      fontFeatureSettings: '"tnum"',
                      width: 18,
                      textAlign: 'right',
                    }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ek-text-soft)' }}>
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* Hello, name */}
          <p className="text-center text-[13px] mb-4" style={{ color: 'var(--ek-text-muted)' }}>
            {lang === 'es' ? `Cuenta registrada como: ` : `Account registered as: `}
            <span className="font-semibold" style={{ color: 'var(--ek-text-soft)' }}>{name}</span>
          </p>

          {/* Contact */}
          <p className="text-center text-[13px] mb-6" style={{ color: 'var(--ek-text-muted)' }}>
            {tx.questions}{' '}
            {tx.contact}{' '}
            <a
              href="mailto:hola@englishkolab.com"
              className="font-semibold underline underline-offset-2"
              style={{ color: 'var(--ek-text)' }}
            >
              hola@englishkolab.com
            </a>
          </p>

          {/* Refresh link — server checks is_active on each load */}
          <div className="text-center">
            <Link
              href={`/${lang}/maestro/pending`}
              className="ek-link-muted"
              style={{ fontSize: 12, fontWeight: 500 }}
            >
              {lang === 'es' ? 'Actualizar estado' : 'Refresh status'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

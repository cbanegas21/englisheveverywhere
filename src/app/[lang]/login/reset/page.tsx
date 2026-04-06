'use client'

import { Suspense, useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, MailCheck } from 'lucide-react'
import { resetPassword } from '@/app/actions/auth'
import type { Locale } from '@/lib/i18n/translations'

const t = {
  en: {
    backToLogin: '← Back to login',
    headline: 'Reset your password',
    sub: "Enter your email and we'll send you a reset link.",
    email: 'Email address',
    emailPlaceholder: 'you@email.com',
    submit: 'Send reset link',
    loading: 'Sending…',
    successHeadline: 'Check your email',
    successSub: "We've sent you a password reset link. Check your inbox (and spam folder).",
    backToLoginBtn: 'Back to login',
  },
  es: {
    backToLogin: '← Volver al login',
    headline: 'Restablecer contraseña',
    sub: 'Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.',
    email: 'Correo electrónico',
    emailPlaceholder: 'tu@correo.com',
    submit: 'Enviar enlace',
    loading: 'Enviando…',
    successHeadline: 'Revisa tu correo',
    successSub: 'Te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja (y spam).',
    backToLoginBtn: 'Volver al login',
  },
}

interface ResetPageProps {
  params: Promise<{ lang: string }>
}

function ResetForm({ lang }: { lang: Locale }) {
  const [isPending, startTransition] = useTransition()
  const searchParams = useSearchParams()
  const sent = searchParams.get('success') === 'reset'
  const tx = t[lang]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('lang', lang)
    startTransition(() => resetPassword(fd))
  }

  return (
    <AnimatePresence mode="wait">
      {sent ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div
            className="flex h-14 w-14 mx-auto items-center justify-center rounded-xl mb-5"
            style={{ background: 'rgba(196,30,58,0.08)' }}
          >
            <MailCheck className="h-7 w-7" style={{ color: '#C41E3A' }} />
          </div>
          <h1 className="font-black mb-2" style={{ fontSize: '1.6rem', color: '#111111' }}>{tx.successHeadline}</h1>
          <p className="text-[14px] mb-8 leading-relaxed" style={{ color: '#4B5563' }}>{tx.successSub}</p>
          <Link
            href={`/${lang}/login`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded font-bold text-[14px] transition-all"
            style={{ background: '#C41E3A', color: '#fff' }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#9E1830')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#C41E3A')}
          >
            {tx.backToLoginBtn}
          </Link>
        </motion.div>
      ) : (
        <motion.div key="form">
          <h1 className="font-black mb-1" style={{ fontSize: '1.6rem', color: '#111111' }}>{tx.headline}</h1>
          <p className="text-[14px] mb-8" style={{ color: '#4B5563' }}>{tx.sub}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                className="block text-[12px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#4B5563' }}
              >
                {tx.email}
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder={tx.emailPlaceholder}
                className="w-full rounded px-4 py-3.5 text-[14px] outline-none transition-all"
                style={{
                  border: '1px solid #E5E7EB',
                  color: '#111111',
                  background: '#fff',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="flex items-center justify-center gap-2 w-full py-4 rounded font-bold text-[14px] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#C41E3A', color: '#fff' }}
              onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
              onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {tx.loading}
                </>
              ) : (
                <>
                  {tx.submit}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function ResetPage({ params }: ResetPageProps) {
  const [lang, setLang] = useState<Locale>('es')

  useEffect(() => {
    params.then(({ lang: l }) => setLang(l as Locale))
  }, [params])

  const tx = t[lang]

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: '#F9F9F9' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link
          href={`/${lang}/login`}
          className="inline-flex text-[13px] mb-8 transition-colors"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#111111')}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF')}
        >
          {tx.backToLogin}
        </Link>

        <Suspense fallback={<div className="h-64 rounded-xl animate-pulse" style={{ background: '#F3F4F6' }} />}>
          <ResetForm lang={lang} />
        </Suspense>
      </motion.div>
    </div>
  )
}

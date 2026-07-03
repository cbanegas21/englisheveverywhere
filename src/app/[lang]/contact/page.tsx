import { locales, type Locale } from '@/lib/i18n/translations'
import { notFound } from 'next/navigation'
import Navbar from '@/components/landing/Navbar'
import Footer from '@/components/landing/Footer'

const CONTACT_EMAIL = 'hola@englishkolab.com'

// WhatsApp support number in international format, digits only (e.g. '50412345678').
// Empty hides the WhatsApp button so we never link to a broken wa.me URL.
const WHATSAPP_NUMBER = '50488902191'

const t = {
  en: {
    title: 'Contact us',
    intro:
      "Questions, problems, or feedback? We're a small team and we read every message. Reach us in whichever way is easiest for you — we usually reply within one business day.",
    emailKicker: 'Email',
    emailCta: 'Write to us',
    whatsappKicker: 'WhatsApp',
    whatsappLine: 'Message us on WhatsApp',
    whatsappCta: 'Open WhatsApp',
    hoursKicker: 'Response time',
    hoursLine:
      'We answer Monday to Friday and aim to reply within one business day. Times shown are Central America (Honduras).',
  },
  es: {
    title: 'Contáctanos',
    intro:
      '¿Tienes preguntas, problemas o comentarios? Somos un equipo pequeño y leemos cada mensaje. Escríbenos por el medio que te resulte más fácil — normalmente respondemos en un día hábil.',
    emailKicker: 'Correo',
    emailCta: 'Escríbenos',
    whatsappKicker: 'WhatsApp',
    whatsappLine: 'Escríbenos por WhatsApp',
    whatsappCta: 'Abrir WhatsApp',
    hoursKicker: 'Tiempo de respuesta',
    hoursLine:
      'Respondemos de lunes a viernes y buscamos contestar en un día hábil. Los horarios mostrados son de Centroamérica (Honduras).',
  },
} as const

export default async function ContactPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  // Layout notFound() does not protect pages (they render in parallel) — a
  // dotted path skips the locale proxy and lands here with an invalid lang
  // (same class as the landing eyebrow crash, Sentry ENGLISHKOLAB-3/4/G).
  if (!locales.includes(lang as Locale)) notFound()
  const tx = t[lang]
  const hasWhatsApp = WHATSAPP_NUMBER.length > 0

  return (
    <>
      <Navbar lang={lang} />
      <main className="min-h-screen" style={{ background: 'var(--ek-paper)' }}>
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-[40px] font-black mb-4 tracking-tight" style={{ color: '#111111' }}>
            {tx.title}
          </h1>
          <p className="text-[15px] leading-relaxed mb-10" style={{ color: '#1F2937' }}>
            {tx.intro}
          </p>

          <div className="space-y-6">
            {/* Email */}
            <section
              className="p-7 rounded-2xl"
              style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
            >
              <p
                className="text-[12px] font-bold uppercase tracking-wider mb-2"
                style={{ color: 'var(--ek-text-muted)' }}
              >
                {tx.emailKicker}
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-[18px] font-semibold"
                style={{ color: 'var(--ek-red)' }}
              >
                {CONTACT_EMAIL}
              </a>
              <div className="mt-4">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-block px-5 py-2.5 rounded-full text-[14px] font-semibold"
                  style={{ background: 'var(--ek-red)', color: '#fff' }}
                >
                  {tx.emailCta}
                </a>
              </div>
            </section>

            {/* WhatsApp — only shown once a real number is configured */}
            {hasWhatsApp && (
              <section
                className="p-7 rounded-2xl"
                style={{ background: 'var(--ek-card)', border: '1px solid var(--ek-border)' }}
              >
                <p
                  className="text-[12px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--ek-text-muted)' }}
                >
                  {tx.whatsappKicker}
                </p>
                <p className="text-[15px]" style={{ color: '#1F2937' }}>
                  {tx.whatsappLine}
                </p>
                <div className="mt-4">
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-5 py-2.5 rounded-full text-[14px] font-semibold"
                    style={{ background: '#25D366', color: '#fff' }}
                  >
                    {tx.whatsappCta}
                  </a>
                </div>
              </section>
            )}

            {/* Response time */}
            <section>
              <p
                className="text-[12px] font-bold uppercase tracking-wider mb-2"
                style={{ color: 'var(--ek-text-muted)' }}
              >
                {tx.hoursKicker}
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: '#6B7280' }}>
                {tx.hoursLine}
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer lang={lang} />
    </>
  )
}

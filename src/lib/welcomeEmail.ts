// Welcome email sent after a successful signup — from the email/password `signUp`
// action AND from the auth callback for a first-time Google OAuth signup. No
// confirmation link (autoconfirm is on); purely a greeting. Best-effort: never
// throws into the caller. Uses the shared branded template so it matches every
// other transactional email.
import { brandedEmail, escapeHtml, EMAIL_FROM, APP_URL } from '@/lib/email'

export async function sendWelcomeEmail(email: string, fullName: string, lang: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key || key === 're_placeholder' || !email) return

  const isEs = lang === 'es'
  const locale = isEs ? 'es' : 'en'
  const firstName = (fullName || '').trim().split(' ')[0]
  const suffix = firstName ? `, ${firstName}` : ''
  const htmlSuffix = firstName ? `, ${escapeHtml(firstName)}` : ''

  const html = brandedEmail({
    heading: isEs ? `¡Bienvenido a EnglishKolab${htmlSuffix}!` : `Welcome to EnglishKolab${htmlSuffix}!`,
    bodyHtml: isEs
      ? '<p>Tu cuenta ya está lista. 🎉</p><p>Aprende inglés en vivo, 1 a 1, con un maestro asignado a tu nivel — cuando quieras y a tu ritmo. Reserva tu primera clase cuando estés listo.</p>'
      : "<p>Your account is ready. 🎉</p><p>Learn English live, 1-on-1, with a teacher matched to your level — whenever you want, at your own pace. Book your first class when you're ready.</p>",
    ctaLabel: isEs ? 'Ir a mi panel' : 'Go to my dashboard',
    ctaUrl: `${APP_URL}/${locale}/dashboard`,
    footnote: isEs ? '¿Dudas? Escríbenos a hola@englishkolab.com' : 'Questions? Email us at hola@englishkolab.com',
    lang: locale,
  })
  const subject = isEs ? '¡Bienvenido a EnglishKolab!' : 'Welcome to EnglishKolab!'
  // Plain-text alternative — HTML-only emails are penalised harder by spam filters.
  const text = isEs
    ? `¡Bienvenido a EnglishKolab${suffix}!\n\nTu cuenta ya está lista. Aprende inglés en vivo, 1 a 1, cuando quieras y a tu ritmo.\n\nIr a mi panel: ${APP_URL}/${locale}/dashboard\n\n¿Dudas? Escríbenos a hola@englishkolab.com`
    : `Welcome to EnglishKolab${suffix}!\n\nYour account is ready. Learn English live, 1-on-1, whenever you want, at your own pace.\n\nGo to my dashboard: ${APP_URL}/${locale}/dashboard\n\nQuestions? Email us at hola@englishkolab.com`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: email, subject, html, text }),
    })
  } catch {
    // Best-effort — a Resend hiccup must never break signup.
  }
}

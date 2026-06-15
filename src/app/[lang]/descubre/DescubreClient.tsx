'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/lib/i18n/translations'

// Price-free plan shape passed from the SERVER page — no priceUsd reaches this
// 'use client' bundle (gated funnel). Only names + class counts cross the boundary.
type QuizPlan = { nameEn: string; nameEs: string; classes: number }

// Lowercase a phrase for natural mid-sentence use BUT keep all-caps tokens
// (acronyms) intact — otherwise "An exam (TOEFL, IELTS…)" became "...(toefl, ielts…)".
function naturalLower(s: string): string {
  return s
    .split(' ')
    .map((w) => (/[A-Z]{2,}/.test(w) ? w : w.toLowerCase()))
    .join(' ')
}

const T = {
  es: {
    kicker: '↳ Descubre tu plan',
    title: 'Tu plan ideal en 30 segundos.',
    sub: 'Responde 3 preguntas y te recomendamos un paquete según el ritmo que te imaginas.',
    step: (n: number, total: number) => `Paso ${n} de ${total}`,
    back: 'Atrás',
    langLabel: 'Idioma',
    questions: [
      { q: '¿Cuál es tu nivel de inglés hoy?', opts: ['Principiante', 'Intermedio', 'Avanzado', 'No estoy seguro/a'] },
      { q: '¿Para qué quieres el inglés?', opts: ['Mi trabajo o mi carrera', 'Viajar', 'Hablar con confianza', 'Un examen (TOEFL, IELTS…)'] },
      { q: '¿Cuántas clases por semana te imaginas?', opts: ['1–2 por semana', '3 por semana', '4 por semana', 'Casi todos los días'] },
    ],
    building: 'Armando tu plan ideal…',
    resultKicker: '↳ Tu plan recomendado',
    resultLead: (freq: string) => `Para ${naturalLower(freq)}, este es el paquete que mejor te queda:`,
    classes: 'clases',
    resultBody: '1 a 1 con tu propio maestro, en vivo por video. Las clases nunca caducan — avanzas a tu ritmo.',
    bullets: ['Tu propio maestro, solo para ti', 'Clases de 60 minutos en vivo', 'Las clases nunca caducan'],
    cta: 'Crea tu cuenta para empezar',
    ctaSub: 'Crea tu cuenta para ver el precio y reservar tu primera clase.',
    riskFree: 'Tu primera llamada de diagnóstico es gratis.',
    retake: 'Empezar de nuevo',
  },
  en: {
    kicker: '↳ Find your plan',
    title: 'Your ideal plan in 30 seconds.',
    sub: 'Answer 3 questions and we’ll recommend a pack based on the pace you picture.',
    step: (n: number, total: number) => `Step ${n} of ${total}`,
    back: 'Back',
    langLabel: 'Language',
    questions: [
      { q: 'What’s your English level today?', opts: ['Beginner', 'Intermediate', 'Advanced', 'Not sure'] },
      { q: 'What do you want English for?', opts: ['My job or career', 'Travel', 'Speaking with confidence', 'An exam (TOEFL, IELTS…)'] },
      { q: 'How many classes a week do you picture?', opts: ['1–2 a week', '3 a week', '4 a week', 'Almost every day'] },
    ],
    building: 'Building your ideal plan…',
    resultKicker: '↳ Your recommended plan',
    resultLead: (freq: string) => `For ${naturalLower(freq)}, this is the pack that fits you best:`,
    classes: 'classes',
    resultBody: '1-on-1 with your own teacher, live on video. Classes never expire — you move at your own pace.',
    bullets: ['Your own teacher, just for you', '60-minute live classes', 'Classes never expire'],
    cta: 'Create your account to start',
    ctaSub: 'Create your account to see the price and book your first class.',
    riskFree: 'Your first diagnostic call is free.',
    retake: 'Start over',
  },
}

export default function DescubreClient({ lang, plans }: { lang: Locale; plans: QuizPlan[] }) {
  const tx = T[lang === 'es' ? 'es' : 'en']
  const router = useRouter()
  const other: Locale = lang === 'en' ? 'es' : 'en'
  const [answers, setAnswers] = useState<number[]>([])
  const [phase, setPhase] = useState<'quiz' | 'building' | 'result'>('quiz')

  const step = answers.length // 0..3
  const total = tx.questions.length

  // ES/EN toggle — mirrors the Navbar pattern so a user who lands on the
  // wrong-locale quiz can switch without leaving. Persist locale prefs the
  // same way the Navbar does so the rest of the app stays in sync.
  function switchLocale() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ee-locale', other)
      document.cookie = `ee-locale=${other}; path=/; max-age=31536000; SameSite=Lax`
    }
    router.push(`/${other}/descubre`)
  }

  function pick(optIdx: number) {
    if (phase !== 'quiz') return            // ignore stray clicks once building/result
    const next = [...answers, optIdx]
    setAnswers(next)
    if (next.length === total) setPhase('building')
  }
  // "Labor illusion" beat — a brief, honest processing pause measurably raises the
  // perceived value of the result. Run it as an effect so the timer is cleaned up
  // on back()/retake()/unmount (no setState-after-unmount, no double-fire timer).
  useEffect(() => {
    if (phase !== 'building') return
    const id = setTimeout(() => setPhase('result'), 1600)
    return () => clearTimeout(id)
  }, [phase])
  function back() {
    if (phase === 'result' || phase === 'building') { setPhase('quiz'); setAnswers(a => a.slice(0, -1)); return }
    setAnswers(a => a.slice(0, -1))
  }
  function retake() { setAnswers([]); setPhase('quiz') }

  // Recommend a plan from the weekly-frequency answer (q3): 1-2→Partida, 3→Trayecto,
  // 4→Ascenso, daily→Cumbre. PRICING_PLANS is ordered small→large.
  const plan = plans[Math.min(answers[2] ?? 0, plans.length - 1)]
  const planName = lang === 'es' ? plan.nameEs : plan.nameEn
  const freqLabel = tx.questions[2].opts[answers[2] ?? 0] ?? ''

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--ek-paper)', fontFamily: 'var(--ek-font-sans)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes ek-fade { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes ek-spin { to { transform: rotate(360deg) } }
        .ek-q-fade { animation: ek-fade 0.28s ease both }
        .ek-opt {
          display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%;
          text-align:left; padding:16px 18px; border-radius:var(--ek-radius-md); cursor:pointer;
          background:var(--ek-card); border:1px solid var(--ek-border); color:var(--ek-text);
          font-size:15px; font-weight:600; font-family:var(--ek-font-sans);
          transition:border-color .15s ease, background .15s ease, transform .05s ease;
        }
        .ek-opt:hover { border-color:var(--ek-red-tint-3); background:var(--ek-red-tint) }
        .ek-opt:active { transform:scale(0.99) }
        .ek-opt .ek-arrow { color:var(--ek-text-faint); transition:color .15s ease }
        .ek-opt:hover .ek-arrow { color:var(--ek-red) }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', maxWidth: 620, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <Link href={`/${lang}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: 1, fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ek-text)' }}>
          English<span style={{ color: 'var(--ek-red)' }}>Kolab</span>
        </Link>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {step > 0 && phase === 'quiz' && (
            <button onClick={back} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--ek-text-muted)', fontSize: 13, fontWeight: 600, padding: '8px 10px', margin: '-8px 0', minHeight: 40, display: 'inline-flex', alignItems: 'center' }}>← {tx.back}</button>
          )}
          {/* ES/EN toggle — reuses the Navbar's pill pattern so a user on the
              wrong locale can switch without leaving the quiz. */}
          <button
            onClick={switchLocale}
            aria-label={`${tx.langLabel}: ${other.toUpperCase()}`}
            style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid var(--ek-border-mid)', overflow: 'hidden', background: 'transparent', cursor: 'pointer' }}
          >
            {(['es', 'en'] as const).map((l) => (
              <span
                key={l}
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: lang === l ? 'var(--ek-ink)' : 'transparent',
                  color: lang === l ? '#fff' : 'var(--ek-text-muted)',
                  fontFamily: 'var(--ek-font-mono)',
                }}
              >
                {l}
              </span>
            ))}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8px 22px 60px' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>

          {phase === 'quiz' && step === 0 && (
            <div className="ek-q-fade" style={{ marginBottom: 28 }}>
              <div className="ek-microlabel" style={{ color: 'var(--ek-red)' }}>{tx.kicker}</div>
              <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--ek-text)', margin: '10px 0 0' }}>{tx.title}</h1>
              <p style={{ fontSize: 16, color: 'var(--ek-text-soft)', lineHeight: 1.55, margin: '12px 0 0', maxWidth: 460 }}>{tx.sub}</p>
            </div>
          )}

          {phase === 'quiz' && (
            <div key={step} className="ek-q-fade">
              {/* progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--ek-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(step / total) * 100}%`, background: 'var(--ek-red)', borderRadius: 999, transition: 'width .3s ease' }} />
                </div>
                <span style={{ fontFamily: 'var(--ek-font-mono)', fontSize: 11, color: 'var(--ek-text-muted)', whiteSpace: 'nowrap' }}>{tx.step(step + 1, total)}</span>
              </div>
              <h2 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.7rem)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--ek-text)', margin: '0 0 18px' }}>
                {tx.questions[step].q}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tx.questions[step].opts.map((opt, i) => (
                  <button key={i} className="ek-opt" onClick={() => pick(i)}>
                    <span>{opt}</span>
                    <span className="ek-arrow" aria-hidden>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'building' && (
            <div className="ek-q-fade" style={{ textAlign: 'center', paddingTop: 80 }}>
              <div style={{ width: 34, height: 34, margin: '0 auto 18px', borderRadius: '50%', border: '3px solid var(--ek-border-mid)', borderTopColor: 'var(--ek-red)', animation: 'ek-spin 0.8s linear infinite' }} />
              <p style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--ek-text-soft)' }}>{tx.building}</p>
            </div>
          )}

          {phase === 'result' && (
            <div className="ek-q-fade">
              <div className="ek-microlabel" style={{ color: 'var(--ek-red)' }}>{tx.resultKicker}</div>
              <p style={{ fontSize: 15, color: 'var(--ek-text-soft)', lineHeight: 1.5, margin: '10px 0 14px' }}>{tx.resultLead(freqLabel)}</p>

              <div style={{ background: 'var(--ek-ink)', color: '#fff', borderRadius: 'var(--ek-radius-lg)', padding: '26px 26px 24px' }}>
                <div style={{ fontSize: 'clamp(2rem, 6vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{planName}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, fontFeatureSettings: '"tnum"', lineHeight: 1 }}>{plan.classes}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{tx.classes}</span>
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, margin: '14px 0 0' }}>{tx.resultBody}</p>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '20px 0' }} />
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {tx.bullets.map((b, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.92)' }}>
                      <span style={{ color: 'var(--ek-red)', fontWeight: 800 }}>✓</span>{b}
                    </li>
                  ))}
                </ul>
              </div>

              <Link href={`/${lang}/registro`} style={{ textDecoration: 'none', display: 'block', marginTop: 18 }}>
                <span style={{ display: 'block', width: '100%', textAlign: 'center', padding: '15px 0', background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 999 }}>{tx.cta}</span>
              </Link>
              <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ek-text-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
                {tx.ctaSub}<br /><span style={{ color: 'var(--ek-red)', fontWeight: 600 }}>{tx.riskFree}</span>
              </p>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button onClick={retake} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--ek-text-muted)', fontSize: 12.5, textDecoration: 'underline' }}>{tx.retake}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

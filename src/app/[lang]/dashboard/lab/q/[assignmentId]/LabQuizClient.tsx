'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import { Spinner } from '@/components/ui/Spinner'
import { submitQuizAttempt } from '@/app/actions/lab'

type QType = 'mcq_single' | 'mcq_multi' | 'true_false' | 'short_answer' | 'matching' | 'essay'
interface SOption { text: string; correct?: boolean; feedback?: string }
interface SQuestion {
  id: string
  type: QType
  prompt: string
  guidance?: string
  options?: SOption[]
  lefts?: string[]
  rights?: string[]
  pairs?: { left: string; right: string }[]
  answer?: boolean
  feedback?: string
  accepted?: string[]
}
type RQuestion = SQuestion & { outcome?: string }
interface ReviewData {
  questions: RQuestion[]
  answers: Record<string, unknown>
  autoScore: number
  maxScore: number
  teacherFeedback: string | null
  graded: boolean
}
interface Props {
  lang: Locale
  mode: 'play' | 'review' | 'closed'
  assignmentId: string
  title: string
  intro: string
  teacherName: string
  questions?: SQuestion[]
  review?: ReviewData
}

const t = {
  en: {
    flourish: 'practice quiz',
    sub: 'Take your time — nothing here is graded against you.',
    from: 'From',
    antiIa:
      'Answer in your own words. If you answer with AI you only fool yourself — getting things wrong is how your teacher knows where to help.',
    tf_true: 'True',
    tf_false: 'False',
    shortPh: 'Type your answer…',
    essayPh: 'Write your answer…',
    matchPick: 'Choose…',
    submit: 'Send my answers',
    submitting: 'Sending…',
    back: '← Back to The Lab',
    closedTitle: 'This quiz is no longer available',
    closedBody: 'Your teacher closed or removed it. Nothing to worry about.',
    reviewScore: (a: number, b: number) => `${a} of ${b} correct`,
    reviewNoAuto: 'Your teacher will review your answers',
    pending: (n: number) => `${n} answer${n !== 1 ? 's' : ''} with your teacher`,
    done: 'You finished this quiz',
    yourAnswer: 'Your answer',
    noAnswer: '— left blank —',
    correctAnswer: 'Correct answer',
    accepted: 'Accepted answers',
    oCorrect: '✓ Correct',
    oIncorrect: 'Review this',
    oPending: 'With your teacher',
    teacherNote: 'A note from your teacher',
  },
  es: {
    flourish: 'quiz de práctica',
    sub: 'Tómate tu tiempo — aquí nada se califica en tu contra.',
    from: 'De',
    antiIa:
      'Responde con tus propias palabras. Si respondes con IA solo te engañas a ti mismo — fallar es justo lo que le dice a tu maestro en qué ayudarte.',
    tf_true: 'Verdadero',
    tf_false: 'Falso',
    shortPh: 'Escribe tu respuesta…',
    essayPh: 'Escribe tu respuesta…',
    matchPick: 'Elige…',
    submit: 'Enviar mis respuestas',
    submitting: 'Enviando…',
    back: '← Volver a El Lab',
    closedTitle: 'Este quiz ya no está disponible',
    closedBody: 'Tu maestro lo cerró o lo quitó. No te preocupes.',
    reviewScore: (a: number, b: number) => `${a} de ${b} aciertos`,
    reviewNoAuto: 'Tu maestro revisará tus respuestas',
    pending: (n: number) => `${n} respuesta${n !== 1 ? 's' : ''} con tu maestro`,
    done: 'Terminaste este quiz',
    yourAnswer: 'Tu respuesta',
    noAnswer: '— en blanco —',
    correctAnswer: 'Respuesta correcta',
    accepted: 'Respuestas aceptadas',
    oCorrect: '✓ Correcto',
    oIncorrect: 'Para repasar',
    oPending: 'Con tu maestro',
    teacherNote: 'Una nota de tu maestro',
  },
}

const card: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--ek-border)',
  background: 'var(--ek-card)',
  padding: 'clamp(16px, 3vw, 22px)',
}
const promptStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--ek-text)',
  letterSpacing: '-0.01em',
  lineHeight: 1.4,
}
const numStyle: React.CSSProperties = {
  fontFamily: 'var(--ek-font-mono)',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--ek-text-muted)',
  letterSpacing: '0.1em',
}
const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--ek-border)',
  background: 'var(--ek-paper)',
  color: 'var(--ek-text)',
  fontSize: 14,
  fontFamily: 'var(--ek-font-sans)',
  minWidth: 160,
}
const textInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--ek-border)',
  background: 'var(--ek-paper)',
  color: 'var(--ek-text)',
  fontSize: 14,
  fontFamily: 'var(--ek-font-sans)',
}

function OutcomeBadge({ outcome, tx }: { outcome?: string; tx: (typeof t)['es'] }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    correct: { label: tx.oCorrect, bg: 'rgba(22,121,77,0.12)', color: '#16794d' },
    incorrect: { label: tx.oIncorrect, bg: 'rgba(193,39,45,0.10)', color: 'var(--ek-red)' },
    pending: { label: tx.oPending, bg: 'var(--ek-paper)', color: 'var(--ek-text-muted)' },
  }
  const m = map[outcome || 'pending'] || map.pending
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--ek-font-mono)',
        letterSpacing: '0.04em',
        background: m.bg,
        color: m.color,
        border: '1px solid var(--ek-border)',
        borderRadius: 999,
        padding: '3px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  )
}

export default function LabQuizClient({ lang, mode, assignmentId, title, intro, teacherName, questions, review }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState('')

  const setMatch = (qid: string, i: number, value: string, len: number) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[qid]) ? [...(prev[qid] as (string | null)[])] : Array(len).fill(null)
      cur[i] = value || null
      return { ...prev, [qid]: cur }
    })
  }
  const toggleMulti = (qid: string, idx: number) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[qid]) ? (prev[qid] as number[]) : []
      return { ...prev, [qid]: cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx] }
    })
  }

  const submit = () => {
    if (pending) return
    setError('')
    startTransition(async () => {
      const res = await submitQuizAttempt({ assignmentId, answers, lang })
      if (res && 'error' in res) setError(res.error ?? '')
      else router.refresh() // page re-renders in review mode (attempt now exists)
    })
  }

  const Header = (
    <DashTopBar
      title={<>{title} — <TitleFlourish>{tx.flourish}</TitleFlourish></>}
      sub={tx.sub}
    />
  )
  const backLink = (
    <Link
      href={`/${lang}/dashboard/lab`}
      style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-red)', textDecoration: 'none' }}
    >
      {tx.back}
    </Link>
  )

  // ── closed ────────────────────────────────────────────────────────────
  if (mode === 'closed') {
    return (
      <div style={{ background: 'var(--ek-paper)', minHeight: '100%' }}>
        {Header}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(20px, 4vw, 32px)' }}>
          <div style={card}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--ek-text)' }}>{tx.closedTitle}</h2>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ek-text-muted)', lineHeight: 1.5 }}>{tx.closedBody}</p>
            {backLink}
          </div>
        </div>
      </div>
    )
  }

  // ── review ────────────────────────────────────────────────────────────
  if (mode === 'review' && review) {
    const hasAuto = review.maxScore > 0
    return (
      <div style={{ background: 'var(--ek-paper)', minHeight: '100%' }}>
        {Header}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(20px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* score summary */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--ek-text-muted)' }}>{tx.from} {teacherName}</div>
            <div style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 800, color: 'var(--ek-text)', letterSpacing: '-0.02em' }}>
              {hasAuto ? tx.reviewScore(review.autoScore, review.maxScore) : tx.done}
            </div>
            {review.questions.some((q) => q.outcome === 'pending') && (
              <div style={{ fontSize: 13, color: 'var(--ek-text-muted)' }}>
                {hasAuto ? tx.pending(review.questions.filter((q) => q.outcome === 'pending').length) : tx.reviewNoAuto}
              </div>
            )}
            {review.graded && review.teacherFeedback && (
              <div style={{ marginTop: 8, borderTop: '1px solid var(--ek-border)', paddingTop: 12 }}>
                <div className="ek-microlabel" style={{ marginBottom: 4 }}>↳ {tx.teacherNote}</div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ek-text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{review.teacherFeedback}</p>
              </div>
            )}
          </div>

          {review.questions.map((q, i) => (
            <div key={q.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <span style={numStyle}>{String(i + 1).padStart(2, '0')}</span>
                <OutcomeBadge outcome={q.outcome} tx={tx} />
              </div>
              <div style={promptStyle}>{q.prompt}</div>
              <div style={{ marginTop: 12, fontSize: 14, color: 'var(--ek-text)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ReviewAnswer q={q} answer={review.answers[q.id]} tx={tx} />
              </div>
            </div>
          ))}

          <div>{backLink}</div>
        </div>
      </div>
    )
  }

  // ── play ──────────────────────────────────────────────────────────────
  const qs = questions || []
  return (
    <div style={{ background: 'var(--ek-paper)', minHeight: '100%' }}>
      {Header}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(20px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--ek-text-muted)' }}>{tx.from} {teacherName}</div>
        {intro && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ek-text)', lineHeight: 1.55 }}>{intro}</p>
        )}
        <div style={{ borderLeft: '3px solid var(--ek-border)', paddingLeft: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ek-text-muted)', fontStyle: 'italic', fontFamily: 'var(--ek-font-serif)', lineHeight: 1.55 }}>{tx.antiIa}</p>
        </div>

        {qs.map((q, i) => (
          <div key={q.id} style={card}>
            <div style={{ ...numStyle, marginBottom: 8 }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={promptStyle}>{q.prompt}</div>

            {/* mcq_single / mcq_multi */}
            {(q.type === 'mcq_single' || q.type === 'mcq_multi') && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(q.options || []).map((o, oi) => {
                  const checked = q.type === 'mcq_single'
                    ? answers[q.id] === oi
                    : Array.isArray(answers[q.id]) && (answers[q.id] as number[]).includes(oi)
                  return (
                    <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--ek-text)' }}>
                      <input
                        type={q.type === 'mcq_single' ? 'radio' : 'checkbox'}
                        name={q.id}
                        checked={!!checked}
                        onChange={() =>
                          q.type === 'mcq_single'
                            ? setAnswers((p) => ({ ...p, [q.id]: oi }))
                            : toggleMulti(q.id, oi)
                        }
                      />
                      <span>{o.text}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {/* true_false */}
            {q.type === 'true_false' && (
              <div style={{ marginTop: 12, display: 'flex', gap: 18 }}>
                {[true, false].map((val) => (
                  <label key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--ek-text)' }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === val} onChange={() => setAnswers((p) => ({ ...p, [q.id]: val }))} />
                    <span>{val ? tx.tf_true : tx.tf_false}</span>
                  </label>
                ))}
              </div>
            )}

            {/* short_answer */}
            {q.type === 'short_answer' && (
              <input
                style={{ ...textInputStyle, marginTop: 12 }}
                placeholder={tx.shortPh}
                value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                maxLength={200}
              />
            )}

            {/* essay */}
            {q.type === 'essay' && (
              <>
                {q.guidance && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--ek-text-muted)', lineHeight: 1.5 }}>{q.guidance}</p>}
                <textarea
                  style={{ ...textInputStyle, marginTop: 12, minHeight: 120, resize: 'vertical' }}
                  placeholder={tx.essayPh}
                  value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                  onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                  maxLength={5000}
                />
              </>
            )}

            {/* matching */}
            {q.type === 'matching' && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(q.lefts || []).map((left, li) => {
                  const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as (string | null)[]) : []
                  return (
                    <div key={li} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, color: 'var(--ek-text)', flex: 1, minWidth: 120 }}>{left}</span>
                      <select
                        style={selectStyle}
                        value={cur[li] || ''}
                        onChange={(e) => setMatch(q.id, li, e.target.value, (q.lefts || []).length)}
                      >
                        <option value="">{tx.matchPick}</option>
                        {(q.rights || []).map((r, ri) => (
                          <option key={ri} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}

        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--ek-red)' }}>{error}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={submit}
            disabled={pending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--ek-red)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '11px 22px',
              borderRadius: 8,
              border: 'none',
              cursor: pending ? 'default' : 'pointer',
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending && <Spinner size={14} />}
            {pending ? tx.submitting : tx.submit}
          </button>
          {backLink}
        </div>
      </div>
    </div>
  )
}

// Render the student's stored answer (+ the correct answer when the snapshot
// includes keys, i.e. the quiz allowed review-after).
function ReviewAnswer({ q, answer, tx }: { q: RQuestion; answer: unknown; tx: (typeof t)['es'] }) {
  const muted: React.CSSProperties = { color: 'var(--ek-text-muted)' }
  const label = (s: string) => <span style={{ ...muted, fontSize: 12, fontWeight: 700 }}>{s}: </span>

  if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
    const opts = q.options || []
    const picked = q.type === 'mcq_single'
      ? typeof answer === 'number' ? [answer] : []
      : Array.isArray(answer) ? (answer as number[]) : []
    const chosenText = picked.map((i) => opts[i]?.text).filter(Boolean)
    const correctText = opts.filter((o) => o.correct).map((o) => o.text)
    return (
      <>
        <div>{label(tx.yourAnswer)}{chosenText.length ? chosenText.join(', ') : <span style={muted}>{tx.noAnswer}</span>}</div>
        {correctText.length > 0 && q.outcome !== 'correct' && <div style={muted}>{label(tx.correctAnswer)}{correctText.join(', ')}</div>}
      </>
    )
  }
  if (q.type === 'true_false') {
    const given = typeof answer === 'boolean' ? (answer ? tx.tf_true : tx.tf_false) : null
    const correct = q.answer === undefined ? null : q.answer ? tx.tf_true : tx.tf_false
    return (
      <>
        <div>{label(tx.yourAnswer)}{given || <span style={muted}>{tx.noAnswer}</span>}</div>
        {correct && q.outcome !== 'correct' && <div style={muted}>{label(tx.correctAnswer)}{correct}</div>}
      </>
    )
  }
  if (q.type === 'short_answer') {
    const given = typeof answer === 'string' && answer.trim() ? answer : null
    return (
      <>
        <div>{label(tx.yourAnswer)}{given || <span style={muted}>{tx.noAnswer}</span>}</div>
        {Array.isArray(q.accepted) && q.accepted.length > 0 && q.outcome !== 'correct' && (
          <div style={muted}>{label(tx.accepted)}{q.accepted.join(', ')}</div>
        )}
      </>
    )
  }
  if (q.type === 'matching') {
    const given = Array.isArray(answer) ? (answer as (string | null)[]) : []
    const correctByLeft = new Map((q.pairs || []).map((p) => [p.left, p.right]))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(q.lefts || []).map((left, i) => {
          const correct = correctByLeft.get(left)
          const mine = given[i]
          const ok = correct !== undefined && mine === correct
          return (
            <div key={i} style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--ek-text)' }}>{left}</span>
              <span style={muted}> → {mine || tx.noAnswer}</span>
              {correct !== undefined && !ok && <span style={muted}> ({tx.correctAnswer}: {correct})</span>}
            </div>
          )
        })}
      </div>
    )
  }
  // essay
  const given = typeof answer === 'string' && answer.trim() ? answer : null
  return (
    <div>
      {label(tx.yourAnswer)}
      {given ? <span style={{ whiteSpace: 'pre-wrap' }}>{given}</span> : <span style={muted}>{tx.noAnswer}</span>}
    </div>
  )
}

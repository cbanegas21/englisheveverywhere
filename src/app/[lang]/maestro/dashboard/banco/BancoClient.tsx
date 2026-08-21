'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import Modal from '@/components/dashboard/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { createBankQuestion, updateBankQuestion, archiveBankQuestion } from '@/app/actions/lab'

type QType = 'mcq_single' | 'mcq_multi' | 'true_false' | 'short_answer' | 'matching' | 'essay'

interface BankQuestion {
  id: string
  type: string
  prompt: string
  payload: unknown
  generalFeedback: string
  tags: string[]
  archived: boolean
}
interface Props { lang: Locale; questions: BankQuestion[] }

// Local narrowing helpers (no `any` — the rule is build-fatal).
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const s = (v: unknown): string => (typeof v === 'string' ? v : '')

const t = {
  en: {
    title: 'Question bank',
    flourish: 'your Lab questions',
    sub: 'Build reusable questions, then assemble them into quizzes.',
    newQ: 'New question',
    empty: 'No questions yet.',
    emptySub: 'Create your first question — you can reuse it across quizzes.',
    archived: 'Archived',
    edit: 'Edit',
    archive: 'Archive',
    restore: 'Restore',
    type: 'Type',
    prompt: 'Question / prompt',
    promptPh: 'What are you asking?',
    options: 'Options',
    correct: 'Correct',
    addOption: 'Add option',
    remove: 'Remove',
    answer: 'Correct answer',
    true: 'True',
    false: 'False',
    accepted: 'Accepted answers',
    caseSensitive: 'Case-sensitive',
    addAccepted: 'Add accepted answer',
    pairs: 'Pairs to match',
    left: 'Left',
    right: 'Right',
    addPair: 'Add pair',
    guidance: 'Guidance for the student (optional)',
    generalFeedback: 'General feedback (optional)',
    feedbackPh: 'Shown after answering — encouraging, gentle.',
    optFeedbackPh: 'Why this option is right/wrong (optional)',
    answerFeedback: 'Feedback (optional)',
    answerFeedbackPh: 'Shown to the student after they answer.',
    tagsLabel: 'Tags (optional)',
    tagsPh: 'grammar, unit-3 …',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    types: {
      mcq_single: 'Multiple choice (one answer)',
      mcq_multi: 'Multiple choice (several answers)',
      true_false: 'True / False',
      short_answer: 'Short answer',
      matching: 'Matching',
      essay: 'Essay (teacher grades)',
    } as Record<QType, string>,
  },
  es: {
    title: 'Banco de preguntas',
    flourish: 'tus preguntas del Lab',
    sub: 'Crea preguntas reutilizables y arma quizzes con ellas.',
    newQ: 'Nueva pregunta',
    empty: 'Aún no tienes preguntas.',
    emptySub: 'Crea tu primera pregunta — la puedes reutilizar en varios quizzes.',
    archived: 'Archivada',
    edit: 'Editar',
    archive: 'Archivar',
    restore: 'Restaurar',
    type: 'Tipo',
    prompt: 'Pregunta / enunciado',
    promptPh: '¿Qué quieres preguntar?',
    options: 'Opciones',
    correct: 'Correcta',
    addOption: 'Agregar opción',
    remove: 'Quitar',
    answer: 'Respuesta correcta',
    true: 'Verdadero',
    false: 'Falso',
    accepted: 'Respuestas aceptadas',
    caseSensitive: 'Distingue mayúsculas',
    addAccepted: 'Agregar respuesta aceptada',
    pairs: 'Parejas para emparejar',
    left: 'Izquierda',
    right: 'Derecha',
    addPair: 'Agregar pareja',
    guidance: 'Guía para el estudiante (opcional)',
    generalFeedback: 'Retroalimentación general (opcional)',
    feedbackPh: 'Se muestra después de responder — gentil y motivadora.',
    optFeedbackPh: 'Por qué esta opción es correcta/incorrecta (opcional)',
    answerFeedback: 'Retroalimentación (opcional)',
    answerFeedbackPh: 'Se muestra al estudiante después de responder.',
    tagsLabel: 'Etiquetas (opcional)',
    tagsPh: 'gramática, unidad-3 …',
    cancel: 'Cancelar',
    save: 'Guardar',
    saving: 'Guardando…',
    types: {
      mcq_single: 'Opción múltiple (una respuesta)',
      mcq_multi: 'Opción múltiple (varias respuestas)',
      true_false: 'Verdadero / Falso',
      short_answer: 'Respuesta corta',
      matching: 'Emparejar',
      essay: 'Ensayo (califica el maestro)',
    } as Record<QType, string>,
  },
}

const ALL_TYPES: QType[] = ['mcq_single', 'mcq_multi', 'true_false', 'short_answer', 'matching', 'essay']

interface FormState {
  type: QType
  prompt: string
  options: { text: string; correct: boolean; feedback: string }[]
  tfAnswer: boolean
  tfFeedback: string
  accepted: { text: string; caseSensitive: boolean }[]
  shortFeedback: string
  pairs: { left: string; right: string }[]
  guidance: string
  generalFeedback: string
  tags: string[]
}

function blankForm(): FormState {
  return {
    type: 'mcq_single',
    prompt: '',
    options: [{ text: '', correct: true, feedback: '' }, { text: '', correct: false, feedback: '' }],
    tfAnswer: true,
    tfFeedback: '',
    accepted: [{ text: '', caseSensitive: false }],
    shortFeedback: '',
    pairs: [{ left: '', right: '' }, { left: '', right: '' }],
    guidance: '',
    generalFeedback: '',
    tags: [],
  }
}

function formFromQuestion(q: BankQuestion): FormState {
  const f = blankForm()
  f.type = (ALL_TYPES.includes(q.type as QType) ? q.type : 'mcq_single') as QType
  f.prompt = q.prompt
  f.generalFeedback = q.generalFeedback
  f.tags = Array.isArray(q.tags) ? q.tags : []
  const p = rec(q.payload)
  const opts = arr(p.options).map((o) => ({ text: s(rec(o).text), correct: rec(o).correct === true, feedback: s(rec(o).feedback) }))
  if (opts.length) f.options = opts
  if (typeof p.answer === 'boolean') f.tfAnswer = p.answer
  // tf + short_answer both store a single question-level `feedback` in payload;
  // seed both slots from it (only the one matching `type` is ever saved/shown).
  f.tfFeedback = s(p.feedback)
  f.shortFeedback = s(p.feedback)
  const acc = arr(p.accepted).map((a) => ({ text: s(rec(a).text), caseSensitive: rec(a).caseSensitive === true }))
  if (acc.length) f.accepted = acc
  const prs = arr(p.pairs).map((x) => ({ left: s(rec(x).left), right: s(rec(x).right) }))
  if (prs.length) f.pairs = prs
  f.guidance = s(p.guidance)
  return f
}

function buildPayload(f: FormState): unknown {
  switch (f.type) {
    case 'mcq_single':
    case 'mcq_multi':
      return { options: f.options.filter((o) => o.text.trim()).map((o) => ({ text: o.text, correct: o.correct, feedback: o.feedback })) }
    case 'true_false':
      return { answer: f.tfAnswer, feedback: f.tfFeedback }
    case 'short_answer':
      return { accepted: f.accepted.filter((a) => a.text.trim()).map((a) => ({ text: a.text, caseSensitive: a.caseSensitive })), feedback: f.shortFeedback }
    case 'matching':
      return { pairs: f.pairs.filter((x) => x.left.trim() && x.right.trim()) }
    case 'essay':
      return { guidance: f.guidance }
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--ek-border)',
  background: 'var(--ek-paper)', color: 'var(--ek-text)', fontSize: 14, fontFamily: 'var(--ek-font-sans)',
}
// A quieter input for the per-answer feedback fields (visually secondary to the answer itself).
const feedbackInputStyle: React.CSSProperties = { ...inputStyle, fontSize: 12.5, padding: '7px 10px' }
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', marginBottom: 6,
}

export default function BancoClient({ lang, questions }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm)
  const [error, setError] = useState('')

  function openNew() { setEditingId(null); setForm(blankForm()); setError(''); setOpen(true) }
  function openEdit(q: BankQuestion) { setEditingId(q.id); setForm(formFromQuestion(q)); setError(''); setOpen(true) }

  function save() {
    setError('')
    const payload = buildPayload(form)
    startTransition(async () => {
      // try/catch: a thrown rejection (offline, 500) must land in the visible
      // error slot, not the route error boundary (which loses the typed form).
      try {
        const res = editingId
          ? await updateBankQuestion({ id: editingId, type: form.type, prompt: form.prompt, payload, generalFeedback: form.generalFeedback, tags: form.tags, lang })
          : await createBankQuestion({ type: form.type, prompt: form.prompt, payload, generalFeedback: form.generalFeedback, tags: form.tags, lang })
        if (res && 'error' in res) { setError(res.error ?? ''); return }
        setOpen(false)
        router.refresh()
      } catch {
        setError(lang === 'en' ? 'Could not save. Check your connection and try again.' : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
      }
    })
  }

  function toggleArchive(q: BankQuestion) {
    setError('')
    startTransition(async () => {
      // Surface the {error} result — a silent no-op reads as a broken button.
      try {
        const res = await archiveBankQuestion({ id: q.id, archived: !q.archived, lang })
        if (res && 'error' in res) { setError(res.error ?? ''); return }
        router.refresh()
      } catch {
        setError(lang === 'en' ? 'Could not save. Check your connection and try again.' : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
      }
    })
  }

  const upd = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div style={{ background: 'var(--ek-paper)', minHeight: '100%' }}>
      <DashTopBar
        title={<>{tx.title} — <TitleFlourish>{tx.flourish}</TitleFlourish></>}
        sub={tx.sub}
        right={
          <button onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 18px', borderRadius: 8, border: 0, cursor: 'pointer' }}>
            <Plus size={16} /> {tx.newQ}
          </button>
        }
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(20px, 4vw, 32px)' }}>
        {questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ek-text)', margin: '0 0 6px' }}>{tx.empty}</p>
            <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', margin: 0 }}>{tx.emptySub}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {questions.map((q) => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderRadius: 12, border: '1px solid var(--ek-border)', background: 'var(--ek-card)', padding: '14px 18px', opacity: q.archived ? 0.6 : 1 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ek-red)', fontFamily: 'var(--ek-font-mono)' }}>
                      {tx.types[(ALL_TYPES.includes(q.type as QType) ? q.type : 'essay') as QType]}
                    </span>
                    {q.archived && <span style={{ fontSize: 10, color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)' }}>· {tx.archived}</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ek-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.prompt}</div>
                  {q.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {q.tags.map((tg) => (
                        <span key={tg} style={{ fontSize: 10, color: 'var(--ek-text-muted)', background: 'var(--ek-paper)', border: '1px solid var(--ek-border)', borderRadius: 999, padding: '1px 8px', fontFamily: 'var(--ek-font-mono)' }}>{tg}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(q)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ek-text)', background: 'transparent', border: '1px solid var(--ek-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>{tx.edit}</button>
                  <button onClick={() => toggleArchive(q)} disabled={pending} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ek-text-muted)', background: 'transparent', border: '1px solid var(--ek-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>{q.archived ? tx.restore : tx.archive}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        kicker={editingId ? tx.edit : tx.newQ}
        title={editingId ? tx.edit : tx.newQ}
        maxWidth={560}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
            {error && <span style={{ fontSize: 12.5, color: 'var(--ek-red)', marginRight: 'auto' }}>{error}</span>}
            <button onClick={() => setOpen(false)} style={{ fontSize: 14, fontWeight: 600, color: 'var(--ek-text-muted)', background: 'transparent', border: 0, cursor: 'pointer', padding: '10px 14px' }}>{tx.cancel}</button>
            <button onClick={save} disabled={pending} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 8, border: 0, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.7 : 1 }}>
              {pending && <Spinner size={14} stroke="#fff" />}{pending ? tx.saving : tx.save}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>{tx.type}</label>
            <select value={form.type} onChange={(e) => upd({ type: e.target.value as QType })} style={inputStyle}>
              {ALL_TYPES.map((ty) => <option key={ty} value={ty}>{tx.types[ty]}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>{tx.prompt}</label>
            <textarea value={form.prompt} onChange={(e) => upd({ prompt: e.target.value })} placeholder={tx.promptPh} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Per-type editor */}
          {(form.type === 'mcq_single' || form.type === 'mcq_multi') && (
            <div>
              <label style={labelStyle}>{tx.options}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {form.options.map((o, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type={form.type === 'mcq_single' ? 'radio' : 'checkbox'}
                        checked={o.correct}
                        onChange={() => {
                          if (form.type === 'mcq_single') upd({ options: form.options.map((x, j) => ({ ...x, correct: j === i })) })
                          else upd({ options: form.options.map((x, j) => (j === i ? { ...x, correct: !x.correct } : x)) })
                        }}
                        title={tx.correct}
                        style={{ accentColor: 'var(--ek-red)', width: 18, height: 18, flexShrink: 0 }}
                      />
                      <input value={o.text} onChange={(e) => upd({ options: form.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} style={inputStyle} />
                      {form.options.length > 2 && (
                        <button onClick={() => upd({ options: form.options.filter((_, j) => j !== i) })} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ek-text-muted)', flexShrink: 0 }} title={tx.remove} aria-label={tx.remove}><Trash2 size={16} /></button>
                      )}
                    </div>
                    <input value={o.feedback} onChange={(e) => upd({ options: form.options.map((x, j) => (j === i ? { ...x, feedback: e.target.value } : x)) })} placeholder={tx.optFeedbackPh} aria-label={tx.optFeedbackPh} style={{ ...feedbackInputStyle, marginLeft: 26 }} />
                  </div>
                ))}
              </div>
              <button onClick={() => upd({ options: [...form.options, { text: '', correct: false, feedback: '' }] })} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ek-red)', background: 'transparent', border: 0, cursor: 'pointer' }}><Plus size={14} /> {tx.addOption}</button>
            </div>
          )}

          {form.type === 'true_false' && (
            <div>
              <label style={labelStyle}>{tx.answer}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[true, false].map((val) => (
                  <button key={String(val)} onClick={() => upd({ tfAnswer: val })} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${form.tfAnswer === val ? 'var(--ek-red)' : 'var(--ek-border)'}`, background: form.tfAnswer === val ? 'var(--ek-red-tint, rgba(196,30,58,0.08))' : 'var(--ek-paper)', color: form.tfAnswer === val ? 'var(--ek-red)' : 'var(--ek-text)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {val ? tx.true : tx.false}
                  </button>
                ))}
              </div>
              <input value={form.tfFeedback} onChange={(e) => upd({ tfFeedback: e.target.value })} placeholder={tx.answerFeedbackPh} aria-label={tx.answerFeedback} style={{ ...feedbackInputStyle, marginTop: 8 }} />
            </div>
          )}

          {form.type === 'short_answer' && (
            <div>
              <label style={labelStyle}>{tx.accepted}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.accepted.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input value={a.text} onChange={(e) => upd({ accepted: form.accepted.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} style={inputStyle} />
                    <label title={tx.caseSensitive} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ek-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <input type="checkbox" aria-label={tx.caseSensitive} checked={a.caseSensitive} onChange={(e) => upd({ accepted: form.accepted.map((x, j) => (j === i ? { ...x, caseSensitive: e.target.checked } : x)) })} style={{ accentColor: 'var(--ek-red)' }} />
                      Aa
                    </label>
                    {form.accepted.length > 1 && (
                      <button onClick={() => upd({ accepted: form.accepted.filter((_, j) => j !== i) })} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ek-text-muted)', flexShrink: 0 }} title={tx.remove} aria-label={tx.remove}><Trash2 size={16} /></button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => upd({ accepted: [...form.accepted, { text: '', caseSensitive: false }] })} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ek-red)', background: 'transparent', border: 0, cursor: 'pointer' }}><Plus size={14} /> {tx.addAccepted}</button>
              <input value={form.shortFeedback} onChange={(e) => upd({ shortFeedback: e.target.value })} placeholder={tx.answerFeedbackPh} aria-label={tx.answerFeedback} style={{ ...feedbackInputStyle, marginTop: 10 }} />
            </div>
          )}

          {form.type === 'matching' && (
            <div>
              <label style={labelStyle}>{tx.pairs}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.pairs.map((pr, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input value={pr.left} placeholder={tx.left} onChange={(e) => upd({ pairs: form.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })} style={inputStyle} />
                    <span aria-hidden style={{ color: 'var(--ek-text-muted)', flexShrink: 0 }}>↔</span>
                    <input value={pr.right} placeholder={tx.right} onChange={(e) => upd({ pairs: form.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })} style={inputStyle} />
                    {form.pairs.length > 2 && (
                      <button onClick={() => upd({ pairs: form.pairs.filter((_, j) => j !== i) })} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ek-text-muted)', flexShrink: 0 }} title={tx.remove} aria-label={tx.remove}><Trash2 size={16} /></button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => upd({ pairs: [...form.pairs, { left: '', right: '' }] })} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ek-red)', background: 'transparent', border: 0, cursor: 'pointer' }}><Plus size={14} /> {tx.addPair}</button>
            </div>
          )}

          {form.type === 'essay' && (
            <div>
              <label style={labelStyle}>{tx.guidance}</label>
              <textarea value={form.guidance} onChange={(e) => upd({ guidance: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          )}

          <div>
            <label style={labelStyle}>{tx.generalFeedback}</label>
            <textarea value={form.generalFeedback} onChange={(e) => upd({ generalFeedback: e.target.value })} placeholder={tx.feedbackPh} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div>
            <label style={labelStyle}>{tx.tagsLabel}</label>
            <input
              value={form.tags.join(', ')}
              onChange={(e) => upd({ tags: e.target.value.split(',').map((tg) => tg.trimStart()).slice(0, 20) })}
              placeholder={tx.tagsPh}
              style={inputStyle}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import Modal from '@/components/dashboard/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { createQuiz, updateQuiz, publishQuiz, cancelQuiz, assignQuizToStudent } from '@/app/actions/lab'

type GradingMethod = 'greatest' | 'average' | 'first' | 'last'
interface BankItem { id: string; type: string; prompt: string }
interface Quiz {
  id: string
  title: string
  intro: string
  questionIds: string[]
  settings: unknown
  status: string
}
interface Props { lang: Locale; quizzes: Quiz[]; bank: BankItem[]; students: { id: string; name: string }[] }

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

const t = {
  en: {
    title: 'Quizzes', flourish: 'assemble & assign', sub: 'Compose quizzes from your question bank.',
    newQ: 'New quiz', empty: 'No quizzes yet.', emptySub: 'Build your first quiz from your question bank.',
    noBank: 'You have no questions yet.', noBankSub: 'Create questions first, then assemble them into a quiz.', goToBank: 'Go to the question bank →',
    draft: 'Draft', published: 'Published', edit: 'Edit', publish: 'Publish', cancel: 'Cancel', cancelQuiz: 'Archive', responses: 'Responses',
    qCount: (n: number) => `${n} question${n !== 1 ? 's' : ''}`,
    fTitle: 'Title', fTitlePh: 'e.g. Unit 3 — Past tense', fIntro: 'Intro (optional)', fIntroPh: 'A short note shown before the quiz.',
    fQuestions: 'Questions', pick: 'Pick from your bank', selected: (n: number) => `${n} selected`,
    settings: 'Settings', attempts: 'Attempts allowed', grading: 'Grade from', shuffleQ: 'Shuffle questions', shuffleA: 'Shuffle answers', review: 'Let student review answers after',
    gm: { greatest: 'Highest attempt', average: 'Average', first: 'First attempt', last: 'Last attempt' } as Record<GradingMethod, string>,
    save: 'Save', saving: 'Saving…', publishing: 'Publishing…',
    assign: 'Assign', assignTitle: 'Assign quiz', chooseStudent: 'Student', dueDate: 'Due date (optional)', noStudents: 'No booked students yet — you can assign once you have one.', send: 'Assign', sending: 'Assigning…',
    types: { mcq_single: 'MC (one)', mcq_multi: 'MC (multi)', true_false: 'T/F', short_answer: 'Short', matching: 'Match', essay: 'Essay' } as Record<string, string>,
  },
  es: {
    title: 'Quizzes', flourish: 'arma y asigna', sub: 'Crea quizzes con las preguntas de tu banco.',
    newQ: 'Nuevo quiz', empty: 'Aún no tienes quizzes.', emptySub: 'Arma tu primer quiz con tu banco de preguntas.',
    noBank: 'Aún no tienes preguntas.', noBankSub: 'Crea preguntas primero y luego ármalas en un quiz.', goToBank: 'Ir al banco de preguntas →',
    draft: 'Borrador', published: 'Publicado', edit: 'Editar', publish: 'Publicar', cancel: 'Cancelar', cancelQuiz: 'Archivar', responses: 'Respuestas',
    qCount: (n: number) => `${n} pregunta${n !== 1 ? 's' : ''}`,
    fTitle: 'Título', fTitlePh: 'ej. Unidad 3 — Pasado', fIntro: 'Introducción (opcional)', fIntroPh: 'Una nota corta antes del quiz.',
    fQuestions: 'Preguntas', pick: 'Elige de tu banco', selected: (n: number) => `${n} seleccionada${n !== 1 ? 's' : ''}`,
    settings: 'Ajustes', attempts: 'Intentos permitidos', grading: 'Calificar con', shuffleQ: 'Mezclar preguntas', shuffleA: 'Mezclar respuestas', review: 'Permitir al estudiante revisar respuestas después',
    gm: { greatest: 'Mejor intento', average: 'Promedio', first: 'Primer intento', last: 'Último intento' } as Record<GradingMethod, string>,
    save: 'Guardar', saving: 'Guardando…', publishing: 'Publicando…',
    assign: 'Asignar', assignTitle: 'Asignar quiz', chooseStudent: 'Estudiante', dueDate: 'Fecha límite (opcional)', noStudents: 'Aún no tienes estudiantes con reserva — podrás asignar cuando tengas uno.', send: 'Asignar', sending: 'Asignando…',
    types: { mcq_single: 'OM (una)', mcq_multi: 'OM (varias)', true_false: 'V/F', short_answer: 'Corta', matching: 'Empareja', essay: 'Ensayo' } as Record<string, string>,
  },
}

const GRADING: GradingMethod[] = ['greatest', 'average', 'first', 'last']

interface FormState {
  title: string; intro: string; selected: string[]
  attemptsAllowed: number; gradingMethod: GradingMethod
  shuffleQuestions: boolean; shuffleAnswers: boolean; reviewAfter: boolean
}
function blankForm(): FormState {
  return { title: '', intro: '', selected: [], attemptsAllowed: 1, gradingMethod: 'greatest', shuffleQuestions: false, shuffleAnswers: false, reviewAfter: true }
}
function formFromQuiz(q: Quiz): FormState {
  const s = rec(q.settings)
  const gm = typeof s.gradingMethod === 'string' && (GRADING as string[]).includes(s.gradingMethod) ? (s.gradingMethod as GradingMethod) : 'greatest'
  return {
    title: q.title, intro: q.intro, selected: q.questionIds,
    attemptsAllowed: typeof s.attemptsAllowed === 'number' ? s.attemptsAllowed : 1,
    gradingMethod: gm,
    shuffleQuestions: s.shuffleQuestions === true, shuffleAnswers: s.shuffleAnswers === true, reviewAfter: s.reviewAfter !== false,
  }
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--ek-border)', background: 'var(--ek-paper)', color: 'var(--ek-text)', fontSize: 14, fontFamily: 'var(--ek-font-sans)' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', marginBottom: 6 }

export default function QuizzesClient({ lang, quizzes, bank, students }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm)
  const [error, setError] = useState('')
  const [assignQuiz, setAssignQuiz] = useState<Quiz | null>(null)
  const [assignStudent, setAssignStudent] = useState('')
  const [assignDue, setAssignDue] = useState('')
  const [assignError, setAssignError] = useState('')

  const upd = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  function openNew() { setEditingId(null); setForm(blankForm()); setError(''); setOpen(true) }
  function openEdit(q: Quiz) { setEditingId(q.id); setForm(formFromQuiz(q)); setError(''); setOpen(true) }

  function save() {
    setError('')
    const payload = {
      title: form.title, intro: form.intro,
      questionIds: form.selected,
      settings: { shuffleQuestions: form.shuffleQuestions, shuffleAnswers: form.shuffleAnswers, attemptsAllowed: form.attemptsAllowed, gradingMethod: form.gradingMethod, reviewAfter: form.reviewAfter },
      lang,
    }
    startTransition(async () => {
      const res = editingId ? await updateQuiz({ id: editingId, ...payload }) : await createQuiz(payload)
      if (res && 'error' in res) { setError(res.error ?? ''); return }
      setOpen(false); router.refresh()
    })
  }
  function doPublish(q: Quiz) { startTransition(async () => { const r = await publishQuiz({ id: q.id, lang }); if (r && !('error' in r)) router.refresh() }) }
  function doCancel(q: Quiz) { startTransition(async () => { const r = await cancelQuiz({ id: q.id, lang }); if (r && !('error' in r)) router.refresh() }) }
  function openAssign(q: Quiz) { setAssignQuiz(q); setAssignStudent(students[0]?.id ?? ''); setAssignDue(''); setAssignError('') }
  function doAssign() {
    if (!assignQuiz || !assignStudent) return
    setAssignError('')
    startTransition(async () => {
      const r = await assignQuizToStudent({ quizId: assignQuiz.id, studentId: assignStudent, dueAt: assignDue || null, lang })
      if (r && 'error' in r) { setAssignError(r.error ?? ''); return }
      setAssignQuiz(null); router.refresh()
    })
  }

  const toggle = (id: string) => upd({ selected: form.selected.includes(id) ? form.selected.filter((x) => x !== id) : [...form.selected, id] })

  return (
    <div style={{ background: 'var(--ek-paper)', minHeight: '100%' }}>
      <DashTopBar
        title={<>{tx.title} — <TitleFlourish>{tx.flourish}</TitleFlourish></>}
        sub={tx.sub}
        right={bank.length > 0 ? (
          <button onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 18px', borderRadius: 8, border: 0, cursor: 'pointer' }}><Plus size={16} /> {tx.newQ}</button>
        ) : undefined}
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(20px, 4vw, 32px)' }}>
        {bank.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ek-text)', margin: '0 0 6px' }}>{tx.noBank}</p>
            <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', margin: '0 0 14px' }}>{tx.noBankSub}</p>
            <Link href={`/${lang}/maestro/dashboard/banco`} style={{ fontSize: 14, fontWeight: 700, color: 'var(--ek-red)', textDecoration: 'none' }}>{tx.goToBank}</Link>
          </div>
        ) : quizzes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ek-text)', margin: '0 0 6px' }}>{tx.empty}</p>
            <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', margin: 0 }}>{tx.emptySub}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {quizzes.map((q) => {
              const isPub = q.status === 'published'
              return (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderRadius: 12, border: '1px solid var(--ek-border)', background: 'var(--ek-card)', padding: '14px 18px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--ek-font-mono)', color: isPub ? 'var(--ek-red)' : 'var(--ek-text-muted)' }}>{isPub ? tx.published : tx.draft}</span>
                      <span style={{ fontSize: 11, color: 'var(--ek-text-muted)' }}>· {tx.qCount(q.questionIds.length)}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openEdit(q)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ek-text)', background: 'transparent', border: '1px solid var(--ek-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>{tx.edit}</button>
                    {isPub && <Link href={`/${lang}/maestro/dashboard/quizzes/${q.id}/respuestas`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ek-text)', background: 'transparent', border: '1px solid var(--ek-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', textDecoration: 'none' }}>{tx.responses}</Link>}
                    {!isPub && <button onClick={() => doPublish(q)} disabled={pending} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--ek-red)', border: 0, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>{tx.publish}</button>}
                    {isPub && <button onClick={() => openAssign(q)} disabled={pending} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--ek-red)', border: 0, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>{tx.assign}</button>}
                    <button onClick={() => doCancel(q)} disabled={pending} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ek-text-muted)', background: 'transparent', border: '1px solid var(--ek-border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>{tx.cancelQuiz}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={open} onClose={() => setOpen(false)}
        kicker={editingId ? tx.edit : tx.newQ} title={editingId ? tx.edit : tx.newQ} maxWidth={580}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
            {error && <span style={{ fontSize: 12.5, color: 'var(--ek-red)', marginRight: 'auto' }}>{error}</span>}
            <button onClick={() => setOpen(false)} style={{ fontSize: 14, fontWeight: 600, color: 'var(--ek-text-muted)', background: 'transparent', border: 0, cursor: 'pointer', padding: '10px 14px' }}>{tx.cancel}</button>
            <button onClick={save} disabled={pending} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 8, border: 0, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.7 : 1 }}>{pending && <Spinner size={14} stroke="#fff" />}{pending ? tx.saving : tx.save}</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>{tx.fTitle}</label>
            <input value={form.title} onChange={(e) => upd({ title: e.target.value })} placeholder={tx.fTitlePh} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{tx.fIntro}</label>
            <textarea value={form.intro} onChange={(e) => upd({ intro: e.target.value })} placeholder={tx.fIntroPh} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div>
            <label style={labelStyle}>{tx.fQuestions} · {tx.selected(form.selected.length)}</label>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--ek-border)', borderRadius: 8, padding: 6 }}>
              {bank.map((b) => {
                const on = form.selected.includes(b.id)
                return (
                  <button key={b.id} onClick={() => toggle(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6, border: 0, cursor: 'pointer', background: on ? 'var(--ek-red-tint, rgba(196,30,58,0.08))' : 'transparent' }}>
                    <input type="checkbox" readOnly checked={on} style={{ accentColor: 'var(--ek-red)', pointerEvents: 'none', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--ek-font-mono)', color: 'var(--ek-text-muted)', flexShrink: 0, width: 64 }}>{tx.types[b.type] || b.type}</span>
                    <span style={{ fontSize: 13, color: 'var(--ek-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.prompt}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>{tx.settings}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ flex: 1, minWidth: 120 }}>
                  <span style={{ fontSize: 12, color: 'var(--ek-text-muted)', display: 'block', marginBottom: 4 }}>{tx.attempts}</span>
                  <input type="number" min={1} max={20} value={form.attemptsAllowed} onChange={(e) => upd({ attemptsAllowed: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) })} style={inputStyle} />
                </label>
                <label style={{ flex: 1, minWidth: 160 }}>
                  <span style={{ fontSize: 12, color: 'var(--ek-text-muted)', display: 'block', marginBottom: 4 }}>{tx.grading}</span>
                  <select value={form.gradingMethod} onChange={(e) => upd({ gradingMethod: e.target.value as GradingMethod })} style={inputStyle}>
                    {GRADING.map((g) => <option key={g} value={g}>{tx.gm[g]}</option>)}
                  </select>
                </label>
              </div>
              {([['shuffleQuestions', tx.shuffleQ], ['shuffleAnswers', tx.shuffleA], ['reviewAfter', tx.review]] as const).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ek-text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form[key]} onChange={(e) => upd({ [key]: e.target.checked } as Partial<FormState>)} style={{ accentColor: 'var(--ek-red)' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!assignQuiz} onClose={() => setAssignQuiz(null)}
        kicker={tx.assign} title={assignQuiz?.title || tx.assignTitle} maxWidth={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
            {assignError && <span style={{ fontSize: 12.5, color: 'var(--ek-red)', marginRight: 'auto' }}>{assignError}</span>}
            <button onClick={() => setAssignQuiz(null)} style={{ fontSize: 14, fontWeight: 600, color: 'var(--ek-text-muted)', background: 'transparent', border: 0, cursor: 'pointer', padding: '10px 14px' }}>{tx.cancel}</button>
            <button onClick={doAssign} disabled={pending || !assignStudent} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 8, border: 0, cursor: pending || !assignStudent ? 'default' : 'pointer', opacity: pending || !assignStudent ? 0.6 : 1 }}>{pending && <Spinner size={14} stroke="#fff" />}{pending ? tx.sending : tx.send}</button>
          </div>
        }
      >
        {students.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', margin: 0 }}>{tx.noStudents}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>{tx.chooseStudent}</label>
              <select value={assignStudent} onChange={(e) => setAssignStudent(e.target.value)} style={inputStyle}>
                {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{tx.dueDate}</label>
              <input type="date" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} style={inputStyle} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

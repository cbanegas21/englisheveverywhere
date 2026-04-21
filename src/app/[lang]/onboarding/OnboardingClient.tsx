'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Globe, Clock, Check, Upload, FileText, X } from 'lucide-react'
import { completeStudentOnboarding, completeTeacherOnboarding } from '@/app/actions/onboarding'
import type { Locale } from '@/lib/i18n/translations'
import TimezoneSelect from '@/components/TimezoneSelect'

const BIO_MIN_CHARS = 20
const CV_MAX_BYTES = 10 * 1024 * 1024
const CV_ALLOWED_EXT = ['.pdf', '.doc', '.docx'] as const

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type Level = (typeof LEVELS)[number]

const LEVEL_LABELS: Record<Level, Record<Locale, string>> = {
  A1: { en: 'Beginner', es: 'Principiante' },
  A2: { en: 'Elementary', es: 'Elemental' },
  B1: { en: 'Intermediate', es: 'Intermedio' },
  B2: { en: 'Upper Intermediate', es: 'Intermedio Alto' },
  C1: { en: 'Advanced', es: 'Avanzado' },
  C2: { en: 'Proficient', es: 'Competente' },
}

const TEACHER_SPECS = {
  en: ['General English', 'Business English', 'IELTS / TOEFL', 'Pronunciation', 'Conversation', 'Kids & Teens', 'Grammar'],
  es: ['Inglés General', 'Inglés de Negocios', 'IELTS / TOEFL', 'Pronunciación', 'Conversación', 'Niños y Adolescentes', 'Gramática'],
}


const t = {
  en: {
    step1: {
      headline: "Let's set up your profile",
      sub: 'Just a few details to personalise your experience.',
      timezone: 'Your timezone',
      language: 'Preferred language',
      langEn: 'English',
      langEs: 'Español',
      next: 'Continue',
    },
    step2Student: {
      headline: "What's your English level?",
      sub: "We'll match you with the right teacher. Be honest — they'll adapt to you.",
      noTest: "I don't know — I'll take the placement test",
      next: 'Continue',
    },
    step2Teacher: {
      headline: 'What do you specialise in?',
      sub: 'Select all that apply.',
      next: 'Continue',
    },
    step3Teacher: {
      headline: 'Tell us about yourself',
      sub: 'Write a short bio. Our team uses this to match you with the right students.',
      bioLabel: 'About you',
      bioPlaceholder: 'I am a certified TESOL teacher with 5 years of experience helping Latin American professionals achieve their language goals...',
      bioMinHint: `At least ${BIO_MIN_CHARS} characters`,
      bioChars: (n: number) => `${n} / ${BIO_MIN_CHARS}+ characters`,
      certLabel: 'Certifications',
      certOptional: 'Optional — skip if you don\'t have any yet',
      certPlaceholder: 'TESOL, CELTA, IELTS Examiner…',
      certHint: 'Separate each with a comma',
      cvLabel: 'CV / résumé',
      cvSub: 'PDF or Word document — up to 10 MB. Our team reviews this before activating your account.',
      cvPick: 'Choose file',
      cvDrop: 'or drag & drop here',
      cvReplace: 'Replace',
      cvRemove: 'Remove',
      cvRequired: 'CV is required to complete your application',
      cvTooBig: 'File is larger than 10 MB',
      cvBadType: 'Only PDF or Word documents are accepted',
      next: 'Complete setup',
    },
    finishing: 'Setting up your account…',
    done: {
      headline: "You're all set!",
      sub: 'Your profile is ready.',
      cta: 'Go to dashboard',
    },
    donePending: {
      headline: 'Application submitted!',
      sub: "Our team will review your profile within 24–48 hours. You'll receive an email when your account is activated.",
      cta: 'Check status',
    },
    stepLabel: 'Step',
    of: 'of',
  },
  es: {
    step1: {
      headline: 'Configuremos tu perfil',
      sub: 'Solo unos detalles para personalizar tu experiencia.',
      timezone: 'Tu zona horaria',
      language: 'Idioma preferido',
      langEn: 'English',
      langEs: 'Español',
      next: 'Continuar',
    },
    step2Student: {
      headline: '¿Cuál es tu nivel de inglés?',
      sub: 'Te conectaremos con el maestro adecuado. Sé honesto — se adaptarán a ti.',
      noTest: 'No sé — haré el placement test',
      next: 'Continuar',
    },
    step2Teacher: {
      headline: '¿En qué te especializas?',
      sub: 'Selecciona todas las que apliquen.',
      next: 'Continuar',
    },
    step3Teacher: {
      headline: 'Cuéntanos sobre ti',
      sub: 'Escribe una bio corta. Nuestro equipo la usa para emparejarte con los estudiantes correctos.',
      bioLabel: 'Sobre ti',
      bioPlaceholder: 'Soy maestro certificado TESOL con 5 años de experiencia ayudando a profesionales latinoamericanos...',
      bioMinHint: `Mínimo ${BIO_MIN_CHARS} caracteres`,
      bioChars: (n: number) => `${n} / ${BIO_MIN_CHARS}+ caracteres`,
      certLabel: 'Certificaciones',
      certOptional: 'Opcional — puedes omitirlo si aún no tienes',
      certPlaceholder: 'TESOL, CELTA, Examinador IELTS…',
      certHint: 'Separa cada una con una coma',
      cvLabel: 'CV / currículum',
      cvSub: 'PDF o documento Word — máx. 10 MB. Nuestro equipo lo revisa antes de activar tu cuenta.',
      cvPick: 'Elegir archivo',
      cvDrop: 'o arrástralo aquí',
      cvReplace: 'Reemplazar',
      cvRemove: 'Quitar',
      cvRequired: 'El CV es obligatorio para completar tu solicitud',
      cvTooBig: 'El archivo supera los 10 MB',
      cvBadType: 'Solo se aceptan PDF o documentos de Word',
      next: 'Completar configuración',
    },
    finishing: 'Configurando tu cuenta…',
    done: {
      headline: '¡Todo listo!',
      sub: 'Tu perfil está listo.',
      cta: 'Ir al dashboard',
    },
    donePending: {
      headline: '¡Solicitud enviada!',
      sub: 'Nuestro equipo revisará tu perfil en 24–48 horas. Recibirás un correo cuando tu cuenta esté activada.',
      cta: 'Ver estado',
    },
    stepLabel: 'Paso',
    of: 'de',
  },
}

interface Props {
  lang: Locale
  role: 'student' | 'teacher'
  userId: string
  existingName: string
}

export default function OnboardingClient({ lang, role, userId }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const totalSteps = role === 'teacher' ? 3 : 1
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)

  const [timezone, setTimezone] = useState(() => {
    if (typeof window !== 'undefined') {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'
    }
    return 'America/Bogota'
  })
  const [preferredLang, setPreferredLang] = useState<'es' | 'en'>(lang)
  const [level, setLevel] = useState<Level | null>(null)
  const [specs, setSpecs] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [certifications, setCertifications] = useState('')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvError, setCvError] = useState<string | null>(null)
  const [cvDragging, setCvDragging] = useState(false)
  const cvInputRef = useRef<HTMLInputElement | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)

  const isTeacher = role === 'teacher'
  const bioChars = bio.trim().length
  const bioTooShort = bioChars > 0 && bioChars < BIO_MIN_CHARS

  function toggleSpec(s: string) {
    setSpecs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  function validateCv(file: File): string | null {
    const name = file.name.toLowerCase()
    const extOk = CV_ALLOWED_EXT.some((e) => name.endsWith(e))
    if (!extOk) return tx.step3Teacher.cvBadType
    if (file.size > CV_MAX_BYTES) return tx.step3Teacher.cvTooBig
    return null
  }

  function pickCv(file: File | null) {
    setCvError(null)
    if (!file) {
      setCvFile(null)
      return
    }
    const err = validateCv(file)
    if (err) {
      setCvError(err)
      setCvFile(null)
      return
    }
    setCvFile(file)
  }

  async function handleFinish() {
    setFinishError(null)
    startTransition(async () => {
      let result
      if (role === 'student') {
        result = await completeStudentOnboarding({ userId, timezone, preferredLanguage: preferredLang })
      } else {
        if (!cvFile) {
          setFinishError(tx.step3Teacher.cvRequired)
          return
        }
        const fd = new FormData()
        fd.set('userId', userId)
        fd.set('timezone', timezone)
        fd.set('preferredLanguage', preferredLang)
        fd.set('bio', bio)
        fd.set('specializations', JSON.stringify(specs))
        fd.set(
          'certifications',
          JSON.stringify(
            certifications.trim()
              ? certifications.split(',').map((s) => s.trim()).filter(Boolean)
              : [],
          ),
        )
        fd.set('cv', cvFile)
        result = await completeTeacherOnboarding(fd)
      }
      if (result.error) {
        setFinishError(result.error)
      } else {
        setDone(true)
      }
    })
  }

  function goToDashboard() {
    router.push(isTeacher ? `/${lang}/maestro/pending` : `/${lang}/dashboard`)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F9F9F9' }}>

      {/* Top nav */}
      <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded flex items-center justify-center text-[10px] font-black"
            style={{ background: '#C41E3A', color: '#fff' }}
          >
            EK
          </div>
          <span className="font-black text-[15px]" style={{ color: '#111111' }}>EnglishKolab</span>
        </div>
        {!done && (
          <span className="text-[12px] font-medium" style={{ color: '#9CA3AF' }}>
            {tx.stepLabel} {step} {tx.of} {totalSteps}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {!done && (
        <div className="h-0.5 w-full" style={{ background: '#E5E7EB' }}>
          <motion.div
            className="h-full"
            style={{ background: '#C41E3A' }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[480px]">
          <AnimatePresence mode="wait">

            {/* Done */}
            {done && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div
                  className="flex h-14 w-14 mx-auto items-center justify-center rounded-xl mb-6"
                  style={{ background: 'rgba(196,30,58,0.08)' }}
                >
                  <Check className="h-7 w-7" style={{ color: '#C41E3A' }} />
                </div>
                <h1 className="font-black mb-2" style={{ fontSize: '1.6rem', color: '#111111' }}>
                  {isTeacher ? tx.donePending.headline : tx.done.headline}
                </h1>
                <p className="text-[14px] mb-8 max-w-sm mx-auto leading-relaxed" style={{ color: '#4B5563' }}>
                  {isTeacher ? tx.donePending.sub : tx.done.sub}
                </p>
                <button
                  onClick={goToDashboard}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded font-semibold text-[14px] transition-all"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#9E1830')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#C41E3A')}
                >
                  {isTeacher ? tx.donePending.cta : tx.done.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}

            {/* Step 1: Timezone + language */}
            {!done && step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
              >
                <h1 className="font-black mb-1.5" style={{ fontSize: '1.6rem', color: '#111111' }}>{tx.step1.headline}</h1>
                <p className="text-[14px] mb-8" style={{ color: '#4B5563' }}>{tx.step1.sub}</p>

                <div className="flex flex-col gap-5">
                  {/* Timezone */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold mb-2" style={{ color: '#4B5563' }}>
                      <Clock className="h-3.5 w-3.5" />
                      {tx.step1.timezone}
                    </label>
                    <TimezoneSelect
                      value={timezone}
                      onChange={setTimezone}
                      lang={lang}
                      inputStyle={{ padding: '10px 16px', fontSize: '14px', borderRadius: '6px' }}
                    />
                  </div>

                  {/* Language */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold mb-2" style={{ color: '#4B5563' }}>
                      <Globe className="h-3.5 w-3.5" />
                      {tx.step1.language}
                    </label>
                    <div className="flex gap-3">
                      {(['es', 'en'] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setPreferredLang(l)}
                          className="flex-1 py-3 rounded text-[14px] font-medium transition-all"
                          style={
                            preferredLang === l
                              ? { border: '2px solid #111111', background: '#111111', color: '#F9F9F9' }
                              : { border: '2px solid #E5E7EB', background: '#fff', color: '#4B5563' }
                          }
                        >
                          {l === 'es' ? tx.step1.langEs : tx.step1.langEn}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {!isTeacher && finishError && (
                  <p className="mt-4 text-[13px] text-center" style={{ color: '#DC2626' }}>{finishError}</p>
                )}
                <button
                  onClick={isTeacher ? () => setStep(2) : handleFinish}
                  disabled={isPending}
                  className="mt-8 flex items-center justify-center gap-2 w-full py-3.5 rounded font-semibold text-[14px] transition-all disabled:opacity-60"
                  style={{ background: '#C41E3A', color: '#fff' }}
                  onMouseEnter={e => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = '#9E1830' }}
                  onMouseLeave={e => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.background = '#C41E3A' }}
                >
                  {isPending && !isTeacher ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {tx.finishing}
                    </span>
                  ) : (
                    <>
                      {tx.step1.next}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* Step 2 — Student: Level */}
            {!done && step === 2 && !isTeacher && (
              <motion.div
                key="step2student"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
              >
                <h1 className="font-black mb-1.5" style={{ fontSize: '1.6rem', color: '#111111' }}>{tx.step2Student.headline}</h1>
                <p className="text-[14px] mb-8" style={{ color: '#4B5563' }}>{tx.step2Student.sub}</p>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className="rounded py-4 text-center transition-all"
                      style={
                        level === l
                          ? { border: '2px solid #111111', background: '#111111' }
                          : { border: '2px solid #E5E7EB', background: '#fff' }
                      }
                    >
                      <div className="text-[17px] font-bold" style={{ color: level === l ? '#F9F9F9' : '#111111' }}>{l}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: level === l ? 'rgba(249,249,249,0.7)' : '#9CA3AF' }}>
                        {LEVEL_LABELS[l][lang]}
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setLevel(null)}
                  className="w-full rounded py-3 text-[13px] font-medium transition-all"
                  style={
                    level === null
                      ? { border: '2px solid #111111', background: '#111111', color: '#F9F9F9' }
                      : { border: '2px solid #E5E7EB', background: '#fff', color: '#4B5563' }
                  }
                >
                  {tx.step2Student.noTest}
                </button>

                {finishError && (
                  <p className="mt-4 text-[13px] text-center" style={{ color: '#DC2626' }}>{finishError}</p>
                )}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setStep(1)}
                    className="px-5 py-3.5 rounded text-[14px] transition-all"
                    style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#111111')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                  >
                    ←
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded font-semibold text-[14px] transition-all disabled:opacity-60"
                    style={{ background: '#C41E3A', color: '#fff' }}
                    onMouseEnter={e => { if (!isPending) e.currentTarget.style.background = '#9E1830' }}
                    onMouseLeave={e => { if (!isPending) e.currentTarget.style.background = '#C41E3A' }}
                  >
                    {isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        {tx.finishing}
                      </span>
                    ) : (
                      <>
                        {tx.step2Student.next}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2 — Teacher: Specializations */}
            {!done && step === 2 && isTeacher && (
              <motion.div
                key="step2teacher"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
              >
                <h1 className="font-black mb-1.5" style={{ fontSize: '1.6rem', color: '#111111' }}>{tx.step2Teacher.headline}</h1>
                <p className="text-[14px] mb-8" style={{ color: '#4B5563' }}>{tx.step2Teacher.sub}</p>

                <div className="flex flex-wrap gap-2.5 mb-8">
                  {TEACHER_SPECS[lang].map((s) => {
                    const selected = specs.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSpec(s)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded text-[13px] font-medium transition-all"
                        style={
                          selected
                            ? { border: '2px solid #111111', background: '#111111', color: '#F9F9F9' }
                            : { border: '2px solid #E5E7EB', background: '#fff', color: '#4B5563' }
                        }
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                        {s}
                      </button>
                    )
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-5 py-3.5 rounded text-[14px] transition-all"
                    style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#111111')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={specs.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded font-semibold text-[14px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#C41E3A', color: '#fff' }}
                    onMouseEnter={e => { if (specs.length > 0) e.currentTarget.style.background = '#9E1830' }}
                    onMouseLeave={e => { if (specs.length > 0) e.currentTarget.style.background = '#C41E3A' }}
                  >
                    {tx.step2Teacher.next}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3 — Teacher: Bio + certifications */}
            {!done && step === 3 && isTeacher && (
              <motion.div
                key="step3teacher"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
              >
                <h1 className="font-black mb-1.5" style={{ fontSize: '1.6rem', color: '#111111' }}>{tx.step3Teacher.headline}</h1>
                <p className="text-[14px] mb-8" style={{ color: '#4B5563' }}>{tx.step3Teacher.sub}</p>

                <div className="flex flex-col gap-5">
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <label className="block text-[12px] font-semibold" style={{ color: '#4B5563' }}>{tx.step3Teacher.bioLabel}</label>
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: bioTooShort ? '#DC2626' : bioChars >= BIO_MIN_CHARS ? '#059669' : '#9CA3AF' }}
                      >
                        {tx.step3Teacher.bioChars(bioChars)}
                      </span>
                    </div>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      placeholder={tx.step3Teacher.bioPlaceholder}
                      className="w-full rounded px-4 py-3 text-[14px] outline-none transition-all resize-none"
                      style={{
                        border: `1px solid ${bioTooShort ? '#FCA5A5' : '#E5E7EB'}`,
                        color: '#111111',
                        background: '#fff',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                      onBlur={e => (e.currentTarget.style.borderColor = bioTooShort ? '#FCA5A5' : '#E5E7EB')}
                    />
                    <p
                      className="mt-1.5 text-[11px]"
                      style={{ color: bioTooShort ? '#DC2626' : '#9CA3AF' }}
                    >
                      {tx.step3Teacher.bioMinHint}
                    </p>
                  </div>

                  {/* CV / résumé — Fathom bug #4 */}
                  <div>
                    <label className="block text-[12px] font-semibold mb-1" style={{ color: '#4B5563' }}>{tx.step3Teacher.cvLabel}</label>
                    <p className="text-[11px] mb-2" style={{ color: '#9CA3AF' }}>{tx.step3Teacher.cvSub}</p>
                    {cvFile ? (
                      <div
                        className="flex items-center gap-3 rounded p-3"
                        style={{ border: '1px solid #D1FAE5', background: '#F0FDF4' }}
                      >
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded"
                          style={{ background: '#fff', border: '1px solid #BBF7D0' }}
                        >
                          <FileText className="h-4 w-4" style={{ color: '#059669' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-[13px] font-medium" style={{ color: '#111111' }}>{cvFile.name}</p>
                          <p className="text-[11px]" style={{ color: '#6B7280' }}>
                            {(cvFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => cvInputRef.current?.click()}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded transition-all"
                          style={{ color: '#4B5563', border: '1px solid #E5E7EB', background: '#fff' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#111111')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                        >
                          {tx.step3Teacher.cvReplace}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCvFile(null); setCvError(null); if (cvInputRef.current) cvInputRef.current.value = '' }}
                          className="flex h-7 w-7 items-center justify-center rounded transition-all"
                          style={{ color: '#9CA3AF' }}
                          aria-label={tx.step3Teacher.cvRemove}
                          onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent' }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setCvDragging(true) }}
                        onDragLeave={() => setCvDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setCvDragging(false)
                          const f = e.dataTransfer.files?.[0]
                          if (f) pickCv(f)
                        }}
                        className="rounded p-5 text-center transition-all cursor-pointer"
                        style={{
                          border: `1.5px dashed ${cvDragging ? '#C41E3A' : '#D1D5DB'}`,
                          background: cvDragging ? 'rgba(196,30,58,0.04)' : '#fff',
                        }}
                        onClick={() => cvInputRef.current?.click()}
                      >
                        <div
                          className="flex h-10 w-10 mx-auto items-center justify-center rounded mb-2"
                          style={{ background: '#F3F4F6' }}
                        >
                          <Upload className="h-4.5 w-4.5" style={{ color: '#6B7280' }} />
                        </div>
                        <p className="text-[13px] font-semibold" style={{ color: '#111111' }}>{tx.step3Teacher.cvPick}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.step3Teacher.cvDrop}</p>
                      </div>
                    )}
                    <input
                      ref={cvInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => pickCv(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    {cvError && (
                      <p className="mt-1.5 text-[11px]" style={{ color: '#DC2626' }}>{cvError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold mb-1" style={{ color: '#4B5563' }}>{tx.step3Teacher.certLabel}</label>
                    <p className="text-[11px] mb-2 italic" style={{ color: '#9CA3AF' }}>{tx.step3Teacher.certOptional}</p>
                    <input
                      type="text"
                      value={certifications}
                      onChange={(e) => setCertifications(e.target.value)}
                      placeholder={tx.step3Teacher.certPlaceholder}
                      className="w-full rounded px-4 py-3 text-[14px] outline-none transition-all"
                      style={{
                        border: '1px solid #E5E7EB',
                        color: '#111111',
                        background: '#fff',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#C41E3A')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                    />
                    <p className="mt-1.5 text-[11px]" style={{ color: '#9CA3AF' }}>{tx.step3Teacher.certHint}</p>
                  </div>
                </div>

                {finishError && (
                  <p className="mt-4 text-[13px] text-center" style={{ color: '#DC2626' }}>{finishError}</p>
                )}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setStep(2)}
                    className="px-5 py-3.5 rounded text-[14px] transition-all"
                    style={{ border: '1px solid #E5E7EB', color: '#4B5563', background: '#fff' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#111111')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                  >
                    ←
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={isPending || bioChars < BIO_MIN_CHARS || !cvFile}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded font-semibold text-[14px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#C41E3A', color: '#fff' }}
                    onMouseEnter={e => { if (!isPending && bioChars >= BIO_MIN_CHARS && cvFile) e.currentTarget.style.background = '#9E1830' }}
                    onMouseLeave={e => { if (!isPending && bioChars >= BIO_MIN_CHARS && cvFile) e.currentTarget.style.background = '#C41E3A' }}
                  >
                    {isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        {tx.finishing}
                      </span>
                    ) : (
                      <>
                        {tx.step3Teacher.next}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

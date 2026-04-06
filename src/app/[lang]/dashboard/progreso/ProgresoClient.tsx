'use client'

import { TrendingUp, BookOpen, Clock, Award } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

const CEFR_LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type CefrLevel = (typeof CEFR_LEVELS)[number]

const t = {
  en: {
    title: 'My Progress',
    subtitle: 'Track your English learning journey.',
    levelTitle: 'Current Level',
    noLevel: 'Not set yet',
    noLevelSub: 'Complete the placement test to determine your level.',
    stats: {
      completed: 'Classes completed',
      remaining: 'Classes remaining',
      studied: 'Total time studied',
    },
    motivational: {
      A0: "Every journey starts with a single step. You're just getting started!",
      A1: "Great start! You're building the foundations of English.",
      A2: "You can hold basic conversations. Keep going!",
      B1: "Intermediate level — you can communicate in most everyday situations.",
      B2: "Upper intermediate! You can express yourself clearly and fluently.",
      C1: "Advanced level — near-native fluency. Almost there!",
      C2: "Congratulations! You've achieved mastery of English.",
    },
    motivationalEs: {
      A0: 'Todo gran viaje empieza con un primer paso. ¡Estás comenzando!',
      A1: '¡Excelente inicio! Estás construyendo las bases del inglés.',
      A2: 'Puedes mantener conversaciones básicas. ¡Sigue adelante!',
      B1: 'Nivel intermedio — puedes comunicarte en la mayoría de situaciones cotidianas.',
      B2: '¡Nivel intermedio alto! Puedes expresarte con claridad y fluidez.',
      C1: 'Nivel avanzado — casi como nativo. ¡Ya casi llegas!',
      C2: '¡Felicitaciones! Has alcanzado la maestría del inglés.',
    },
    levelLabel: 'CEFR Level progression',
    mins: 'min',
  },
  es: {
    title: 'Mi Progreso',
    subtitle: 'Sigue tu avance en el aprendizaje del inglés.',
    levelTitle: 'Nivel Actual',
    noLevel: 'Aún no establecido',
    noLevelSub: 'Completa el placement test para conocer tu nivel.',
    stats: {
      completed: 'Clases completadas',
      remaining: 'Clases disponibles',
      studied: 'Tiempo total estudiado',
    },
    motivational: {
      A0: 'Todo gran viaje empieza con un primer paso. ¡Estás comenzando!',
      A1: '¡Excelente inicio! Estás construyendo las bases del inglés.',
      A2: 'Puedes mantener conversaciones básicas. ¡Sigue adelante!',
      B1: 'Nivel intermedio — puedes comunicarte en la mayoría de situaciones cotidianas.',
      B2: '¡Nivel intermedio alto! Puedes expresarte con claridad y fluidez.',
      C1: 'Nivel avanzado — casi como nativo. ¡Ya casi llegas!',
      C2: '¡Felicitaciones! Has alcanzado la maestría del inglés.',
    },
    motivationalEs: {
      A0: 'Todo gran viaje empieza con un primer paso. ¡Estás comenzando!',
      A1: '¡Excelente inicio! Estás construyendo las bases del inglés.',
      A2: 'Puedes mantener conversaciones básicas. ¡Sigue adelante!',
      B1: 'Nivel intermedio — puedes comunicarte en la mayoría de situaciones cotidianas.',
      B2: '¡Nivel intermedio alto! Puedes expresarte con claridad y fluidez.',
      C1: 'Nivel avanzado — casi como nativo. ¡Ya casi llegas!',
      C2: '¡Felicitaciones! Has alcanzado la maestría del inglés.',
    },
    levelLabel: 'Progresión de nivel CEFR',
    mins: 'min',
  },
}

interface Props {
  lang: Locale
  level: string | null
  classesRemaining: number
  completedCount: number
}

export default function ProgresoClient({ lang, level, classesRemaining, completedCount }: Props) {
  const tx = t[lang]
  const activeIndex = level ? CEFR_LEVELS.indexOf(level as CefrLevel) : -1
  const totalTime = completedCount * 50 // assumed 50 min per session
  const motivationalMsg = level
    ? tx.motivational[level as CefrLevel] || ''
    : ''

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-3xl mx-auto space-y-5">

        {/* CEFR Level card */}
        <div className="rounded-xl p-6" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-2 mb-5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded"
              style={{ background: 'rgba(196,30,58,0.08)' }}
            >
              <TrendingUp className="h-4 w-4" style={{ color: '#C41E3A' }} />
            </div>
            <h2 className="text-[14px] font-bold" style={{ color: '#111111' }}>{tx.levelTitle}</h2>
          </div>

          {/* Level display */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded text-[26px] font-black flex-shrink-0"
              style={
                level
                  ? { background: '#C41E3A', color: '#fff' }
                  : { background: '#F3F4F6', color: '#9CA3AF' }
              }
            >
              {level || '?'}
            </div>
            <div>
              {level ? (
                <>
                  <div className="text-[15px] font-bold" style={{ color: '#111111' }}>{level}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: '#4B5563' }}>{motivationalMsg}</div>
                </>
              ) : (
                <>
                  <div className="text-[14px] font-semibold" style={{ color: '#111111' }}>{tx.noLevel}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.noLevelSub}</div>
                </>
              )}
            </div>
          </div>

          {/* CEFR progression dots */}
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-3" style={{ color: '#9CA3AF' }}>
              {tx.levelLabel}
            </div>
            <div className="flex items-center gap-2">
              {CEFR_LEVELS.map((lvl, idx) => {
                const isActive = idx === activeIndex
                const isPast = idx < activeIndex

                return (
                  <div key={lvl} className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded text-[11px] font-bold transition-all"
                        style={
                          isActive
                            ? { background: '#C41E3A', color: '#fff', boxShadow: '0 0 0 3px rgba(196,30,58,0.2)' }
                            : isPast
                            ? { background: '#C41E3A', color: '#fff', opacity: 0.4 }
                            : { background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E5E7EB' }
                        }
                      >
                        {lvl}
                      </div>
                    </div>
                    {idx < CEFR_LEVELS.length - 1 && (
                      <div
                        className="h-0.5 flex-1"
                        style={{
                          background: idx < activeIndex ? '#C41E3A' : '#E5E7EB',
                          opacity: idx < activeIndex ? 0.4 : 1,
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: tx.stats.completed, value: completedCount, icon: BookOpen },
            { label: tx.stats.remaining, value: classesRemaining, icon: Award },
            { label: tx.stats.studied, value: `${totalTime}m`, icon: Clock },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl p-5"
              style={{ background: '#fff', border: '1px solid #E5E7EB' }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded mb-3"
                style={{ background: 'rgba(196,30,58,0.08)' }}
              >
                <Icon className="h-4 w-4" style={{ color: '#C41E3A' }} />
              </div>
              <div className="text-[26px] font-black" style={{ color: '#111111' }}>{value}</div>
              <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

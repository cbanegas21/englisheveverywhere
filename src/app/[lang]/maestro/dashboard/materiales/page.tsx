import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, FileText, BarChart3, Package } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  params: Promise<{ lang: string }>
}

const resources = [
  {
    icon: BookOpen,
    titleEn: 'Interchange Series',
    titleEs: 'Serie Interchange',
    descEn: 'Main curriculum used across all levels. Audio, exercises, and supplementary materials.',
    descEs: 'Currículo principal usado en todos los niveles. Audio, ejercicios y materiales suplementarios.',
    tagEn: 'Main curriculum',
    tagEs: 'Currículo principal',
  },
  {
    icon: FileText,
    titleEn: 'Lesson Plan Templates',
    titleEs: 'Plantillas de Planes de Clase',
    descEn: 'Downloadable templates to structure your sessions by level and skill focus.',
    descEs: 'Plantillas descargables para estructurar tus sesiones por nivel y habilidad.',
    tagEn: 'Templates',
    tagEs: 'Plantillas',
  },
  {
    icon: BarChart3,
    titleEn: 'CEFR Level Guide',
    titleEs: 'Guía de Niveles CEFR',
    descEn: 'Assessment guide for evaluating and placing students at the correct CEFR level.',
    descEs: 'Guía de evaluación para calificar y ubicar estudiantes en el nivel CEFR correcto.',
    tagEn: 'Assessment guide',
    tagEs: 'Guía de evaluación',
  },
]

export default async function MaterialesPage({ params }: Props) {
  const { lang } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${lang}/login`)

  const isEs = lang === 'es'

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>
          {isEs ? 'Materiales' : 'Materials'}
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>
          {isEs ? 'Recursos y currículo para tus clases.' : 'Resources and curriculum for your classes.'}
        </p>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-5">

        {/* Coming soon banner */}
        <div
          className="rounded-xl p-5 flex items-start gap-4"
          style={{ background: '#fff', border: '1px solid #E5E7EB' }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded mt-0.5"
            style={{ background: 'rgba(196,30,58,0.08)' }}
          >
            <Package className="h-5 w-5" style={{ color: '#C41E3A' }} />
          </div>
          <div>
            <div className="text-[14px] font-bold mb-1" style={{ color: '#111111' }}>
              {isEs
                ? 'Recursos y materiales en organización'
                : 'Resources & curriculum being organized'}
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: '#4B5563' }}>
              {isEs
                ? 'El equipo de English Everywhere está organizando todos los materiales de currículo, guías de nivel y plantillas. Aparecerán aquí cuando estén listos.'
                : "The English Everywhere team is organizing all curriculum materials, level guides, and templates. They'll appear here once ready."}
            </p>
          </div>
        </div>

        {/* Resource cards grid */}
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold mb-3" style={{ color: '#9CA3AF' }}>
            {isEs ? 'Recursos disponibles' : 'Available resources'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {resources.map(({ icon: Icon, titleEn, titleEs, descEn, descEs, tagEn, tagEs }) => (
              <div
                key={titleEn}
                className="rounded-xl p-5"
                style={{ background: '#fff', border: '1px solid #E5E7EB' }}
              >
                {/* Icon + tag */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded"
                    style={{ background: 'rgba(196,30,58,0.08)' }}
                  >
                    <Icon className="h-5 w-5" style={{ color: '#C41E3A' }} />
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-1 rounded"
                    style={{ background: '#F3F4F6', color: '#6B7280' }}
                  >
                    {isEs ? tagEs : tagEn}
                  </span>
                </div>

                {/* Title */}
                <div className="text-[14px] font-bold mb-1.5" style={{ color: '#111111' }}>
                  {isEs ? titleEs : titleEn}
                </div>

                {/* Description */}
                <p className="text-[12px] leading-relaxed" style={{ color: '#4B5563' }}>
                  {isEs ? descEs : descEn}
                </p>

                {/* Coming soon indicator */}
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid #E5E7EB' }}>
                  <span className="text-[11px] font-medium" style={{ color: '#9CA3AF' }}>
                    {isEs ? 'Próximamente disponible' : 'Coming soon'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

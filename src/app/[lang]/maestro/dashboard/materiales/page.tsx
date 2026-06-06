import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { SectionHeader } from '@/components/dashboard/SectionHeader'

interface Props {
  params: Promise<{ lang: string }>
}

const resources = [
  {
    titleEn: 'Interchange Series',
    titleEs: 'Serie Interchange',
    descEn: 'Main curriculum used across all levels. Audio, exercises, and supplementary materials.',
    descEs: 'Currículo principal usado en todos los niveles. Audio, ejercicios y materiales suplementarios.',
    tagEn: 'Main curriculum',
    tagEs: 'Currículo principal',
  },
  {
    titleEn: 'Lesson Plan Templates',
    titleEs: 'Plantillas de Planes de Clase',
    descEn: 'Downloadable templates to structure your sessions by level and skill focus.',
    descEs: 'Plantillas descargables para estructurar tus sesiones por nivel y habilidad.',
    tagEn: 'Templates',
    tagEs: 'Plantillas',
  },
  {
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
    <div className="min-h-full" style={{ background: 'var(--ek-paper)' }}>

      <DashTopBar
        title={isEs ? 'Materiales' : 'Materials'}
        sub={isEs ? 'Recursos y currículo para tus clases.' : 'Resources and curriculum for your classes.'}
      />

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-7">

        {/* Coming soon banner — editorial accent rule + type, no glyph tile */}
        <div
          style={{
            background: 'var(--ek-card)',
            border: '1px solid var(--ek-border)',
            borderRadius: 'var(--ek-radius-lg)',
            padding: '20px 22px',
            display: 'flex',
            gap: 18,
            alignItems: 'stretch',
          }}
        >
          <div
            aria-hidden
            style={{
              width: 3,
              alignSelf: 'stretch',
              minHeight: 40,
              borderRadius: 2,
              background: 'var(--ek-red)',
              flexShrink: 0,
            }}
          />
          <div>
            <div className="ek-microlabel" style={{ marginBottom: 6 }}>
              {isEs ? 'En preparación' : 'In preparation'}
            </div>
            <div
              style={{
                fontFamily: 'var(--ek-font-serif)',
                fontStyle: 'italic',
                fontSize: 22,
                lineHeight: 1.15,
                color: 'var(--ek-text)',
                marginBottom: 8,
              }}
            >
              {isEs
                ? 'Recursos y materiales en organización'
                : 'Resources & curriculum being organized'}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ek-text-soft)', margin: 0 }}>
              {isEs
                ? 'El equipo de EnglishKolab está organizando todos los materiales de currículo, guías de nivel y plantillas. Aparecerán aquí cuando estén listos.'
                : "The EnglishKolab team is organizing all curriculum materials, level guides, and templates. They'll appear here once ready."}
            </p>
          </div>
        </div>

        {/* Available resources — hairline-ruled editorial ledger, no card grid */}
        <section>
          <SectionHeader
            kicker={isEs ? 'Recursos disponibles' : 'Available resources'}
            title={isEs ? 'Currículo y guías' : 'Curriculum & guides'}
          />

          <div style={{ borderTop: '1px solid var(--ek-border-soft)' }}>
            {resources.map(({ titleEn, titleEs, descEn, descEs, tagEn, tagEs }, i) => (
              <div
                key={titleEn}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr auto',
                  gap: 20,
                  alignItems: 'baseline',
                  padding: '22px 4px',
                  borderBottom: '1px solid var(--ek-border-soft)',
                }}
              >
                {/* Index numeral */}
                <div
                  aria-hidden
                  style={{
                    fontFamily: 'var(--ek-font-serif)',
                    fontStyle: 'italic',
                    fontSize: 32,
                    lineHeight: 1,
                    color: 'var(--ek-text-faint)',
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>

                {/* Title + tag eyebrow + body */}
                <div style={{ minWidth: 0 }}>
                  <div className="ek-microlabel" style={{ marginBottom: 6 }}>
                    {isEs ? tagEs : tagEn}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--ek-font-serif)',
                      fontSize: 19,
                      lineHeight: 1.2,
                      color: 'var(--ek-text)',
                      marginBottom: 6,
                    }}
                  >
                    {isEs ? titleEs : titleEn}
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ek-text-soft)', margin: 0, maxWidth: '52ch' }}>
                    {isEs ? descEs : descEn}
                  </p>
                </div>

                {/* Coming soon microlabel */}
                <div
                  className="ek-microlabel"
                  style={{ whiteSpace: 'nowrap', alignSelf: 'center' }}
                >
                  {isEs ? 'Próximamente' : 'Coming soon'}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

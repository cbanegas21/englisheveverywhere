'use client'

import Link from 'next/link'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { DarkHeroCard } from '@/components/ui/DarkHeroCard'
import { StatLedger } from '@/components/ui/StatLedger'

interface VocabItem { word: string; translation: string; example: string }
interface OpenAssignment { id: string; title: string; teacher_name: string }
interface LabQuiz { id: string; title: string; done: boolean }
interface Props {
  lang: Locale
  userName: string
  openAssignments: OpenAssignment[]
  labQuizzes: LabQuiz[]
  lastClassVocab: VocabItem[]
  stats: { completedClasses: number; classesRemaining: number; lastClassWords: number }
}

const t = {
  en: {
    title: 'The Lab',
    flourish: 'your practice space',
    sub: 'Practice from your classes, at your own pace.',
    heroKicker: '↳ Pick up where you left off',
    heroWithHomework: (n: number) => `You have ${n} thing${n !== 1 ? 's' : ''} from your teacher`,
    heroWithVocab: 'Review the words from your last class',
    heroEmpty: 'Your next class is where it starts',
    heroBodyHomework: 'Your teacher sent practice tailored to you. Do it when it suits you — nothing here is graded.',
    heroBodyVocab: 'Your AI notebook saved the new words from your last class. A quick review makes them stick.',
    heroBodyEmpty: 'Book a class and your practice — vocabulary, summaries and more — starts collecting here.',
    heroCtaHomework: 'See what your teacher sent',
    heroCtaVocab: 'Open my classes',
    heroCtaEmpty: 'Schedule a class',
    lastClass: 'From your last class',
    lastClassEmpty: 'After your next class, the new vocabulary from your AI notebook shows up here to review.',
    seeAll: 'See in my classes →',
    fromTeacher: 'From your teacher',
    fromTeacherEmpty: 'Your teacher has not sent anything yet — it will appear here when they do.',
    openHomework: 'Open my homework →',
    quizTag: 'Quiz',
    quizStart: 'Start',
    quizReview: 'Review',
    from: 'From',
    soon: 'Coming soon',
    reviewTitle: 'To review',
    reviewSoon: 'Spaced review of your vocabulary — a little every day, never punishing.',
    gamesTitle: 'Games',
    gamesSoon: 'Light practice: flashcards, matching, fill-the-gap. Learning that feels easy.',
    progress: 'Your progress',
    statClasses: 'Classes taken',
    statBalance: 'Class balance',
    statWords: 'Words last class',
    noteKicker: '↳ A note on practice',
    note: 'The Lab is yours to practice at your pace — no grades, no streaks to lose. If you answer with AI you only fool yourself; it is fine to get things wrong — that is how your teacher knows where to help.',
  },
  es: {
    title: 'El Lab',
    flourish: 'tu espacio para practicar',
    sub: 'Practica lo de tus clases, a tu propio ritmo.',
    heroKicker: '↳ Continúa donde lo dejaste',
    heroWithHomework: (n: number) => `Tienes ${n} cosa${n !== 1 ? 's' : ''} de tu maestro`,
    heroWithVocab: 'Repasa las palabras de tu última clase',
    heroEmpty: 'Todo empieza en tu próxima clase',
    heroBodyHomework: 'Tu maestro te envió práctica hecha para ti. Hazla cuando te acomode — aquí nada se califica.',
    heroBodyVocab: 'Tu cuaderno IA guardó las palabras nuevas de tu última clase. Un repaso rápido las fija.',
    heroBodyEmpty: 'Agenda una clase y tu práctica — vocabulario, resúmenes y más — empezará a juntarse aquí.',
    heroCtaHomework: 'Ver lo que te envió tu maestro',
    heroCtaVocab: 'Abrir mis clases',
    heroCtaEmpty: 'Agendar una clase',
    lastClass: 'De tu última clase',
    lastClassEmpty: 'Después de tu próxima clase, aquí verás el vocabulario nuevo de tu cuaderno IA para repasar.',
    seeAll: 'Ver en mis clases →',
    fromTeacher: 'De parte de tu maestro·a',
    fromTeacherEmpty: 'Tu maestro aún no te ha enviado nada — aparecerá aquí cuando lo haga.',
    openHomework: 'Abrir mis tareas →',
    quizTag: 'Quiz',
    quizStart: 'Empezar',
    quizReview: 'Revisar',
    from: 'De',
    soon: 'Próximamente',
    reviewTitle: 'Para repasar',
    reviewSoon: 'Repaso espaciado de tu vocabulario — un poco cada día, sin castigos.',
    gamesTitle: 'Juegos',
    gamesSoon: 'Práctica ligera: tarjetas, parejas, llena el espacio. Aprender que se siente fácil.',
    progress: 'Tu progreso',
    statClasses: 'Clases tomadas',
    statBalance: 'Saldo de clases',
    statWords: 'Palabras última clase',
    noteKicker: '↳ Una nota sobre la práctica',
    note: 'El Lab es tuyo para practicar a tu ritmo — sin calificaciones, sin rachas que perder. Si respondes con IA solo te engañas a ti mismo; no importa fallar — así tu maestro sabe en qué ayudarte.',
  },
}

function SoonCard({ title, body, soon }: { title: string; body: string; soon: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px dashed var(--ek-border)',
        background: 'var(--ek-card)',
        padding: '20px 22px',
        opacity: 0.92,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ek-text)', letterSpacing: '-0.01em' }}>{title}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--ek-text-muted)',
            fontFamily: 'var(--ek-font-mono)',
            border: '1px solid var(--ek-border)',
            borderRadius: 999,
            padding: '3px 9px',
            whiteSpace: 'nowrap',
          }}
        >
          {soon}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--ek-text-muted)' }}>{body}</p>
    </div>
  )
}

export default function LabFeedClient({ lang, userName, openAssignments, labQuizzes, lastClassVocab, stats }: Props) {
  const tx = t[lang]
  const firstName = userName.split(' ')[0]

  const firstPendingQuiz = labQuizzes.find((q) => !q.done)
  const pendingQuizzes = labQuizzes.filter((q) => !q.done).length
  const teacherItems = openAssignments.length + pendingQuizzes
  const hasFromTeacher = teacherItems > 0 || labQuizzes.length > 0
  const hasVocab = lastClassVocab.length > 0
  // Lead the hero to the most actionable thing: a pending quiz if there is one,
  // else legacy homework.
  const teacherHref = firstPendingQuiz
    ? `/${lang}/dashboard/lab/q/${firstPendingQuiz.id}`
    : `/${lang}/dashboard/tareas`

  const hero = teacherItems > 0
    ? { title: tx.heroWithHomework(teacherItems), body: tx.heroBodyHomework, cta: tx.heroCtaHomework, href: teacherHref }
    : hasVocab
      ? { title: tx.heroWithVocab, body: tx.heroBodyVocab, cta: tx.heroCtaVocab, href: `/${lang}/dashboard/clases` }
      : { title: tx.heroEmpty, body: tx.heroBodyEmpty, cta: tx.heroCtaEmpty, href: `/${lang}/dashboard/agendar` }

  return (
    <div style={{ background: 'var(--ek-paper)', minHeight: '100%' }}>
      <DashTopBar
        title={<>{tx.title} — <TitleFlourish>{tx.flourish}</TitleFlourish></>}
        sub={tx.sub}
      />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(20px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 'clamp(28px, 5vw, 40px)' }}>
        {/* Continuar hero */}
        <DarkHeroCard ghost="Lab">
          <div className="ek-microlabel" style={{ color: 'rgba(244,239,230,0.55)', marginBottom: 10 }}>{tx.heroKicker}</div>
          <h2 style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.12 }}>
            {firstName ? `${firstName}, ` : ''}{hero.title.charAt(0).toLowerCase() + hero.title.slice(1)}
          </h2>
          <p style={{ margin: '12px 0 22px', fontSize: 14, lineHeight: 1.55, color: 'rgba(244,239,230,0.78)', maxWidth: '52ch' }}>
            {hero.body}
          </p>
          <Link
            href={hero.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--ek-red)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              padding: '11px 20px',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            {hero.cta}
          </Link>
        </DarkHeroCard>

        {/* De tu última clase */}
        <section>
          <SectionHeader kicker="01" title={tx.lastClass} right={hasVocab ? <Link href={`/${lang}/dashboard/clases`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-red)', textDecoration: 'none' }}>{tx.seeAll}</Link> : undefined} />
          {hasVocab ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {lastClassVocab.map((v, i) => (
                <div key={`${v.word}-${i}`} style={{ borderRadius: 12, border: '1px solid var(--ek-border)', background: 'var(--ek-card)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ek-text)', letterSpacing: '-0.01em' }}>{v.word}</div>
                  {v.translation && <div style={{ fontSize: 12.5, color: 'var(--ek-ink-soft)', marginTop: 2 }}>{v.translation}</div>}
                  {v.example && (
                    <div style={{ fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ek-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                      &ldquo;{v.example}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic' }}>{tx.lastClassEmpty}</p>
          )}
        </section>

        {/* De parte de tu maestro·a */}
        <section>
          <SectionHeader kicker="02" title={tx.fromTeacher} right={openAssignments.length > 0 ? <Link href={`/${lang}/dashboard/tareas`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--ek-red)', textDecoration: 'none' }}>{tx.openHomework}</Link> : undefined} />
          {hasFromTeacher ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {labQuizzes.map((q) => (
                <Link
                  key={q.id}
                  href={`/${lang}/dashboard/lab/q/${q.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderRadius: 12, border: '1px solid var(--ek-border)', background: 'var(--ek-card)', padding: '14px 18px', textDecoration: 'none' }}
                >
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', border: '1px solid var(--ek-border)', borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>{tx.quizTag}</span>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</div>
                  </div>
                  <span style={{ color: 'var(--ek-red)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{q.done ? tx.quizReview : tx.quizStart} →</span>
                </Link>
              ))}
              {openAssignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/${lang}/dashboard/tareas`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderRadius: 12, border: '1px solid var(--ek-border)', background: 'var(--ek-card)', padding: '14px 18px', textDecoration: 'none' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ek-text-muted)', marginTop: 2 }}>{tx.from} {a.teacher_name}</div>
                  </div>
                  <span aria-hidden style={{ color: 'var(--ek-red)', fontWeight: 700, flexShrink: 0 }}>→</span>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-serif)', fontStyle: 'italic' }}>{tx.fromTeacherEmpty}</p>
          )}
        </section>

        {/* Próximamente: Para repasar + Juegos */}
        <section>
          <SectionHeader kicker="03" title={tx.soon} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <SoonCard title={tx.reviewTitle} body={tx.reviewSoon} soon={tx.soon} />
            <SoonCard title={tx.gamesTitle} body={tx.gamesSoon} soon={tx.soon} />
          </div>
        </section>

        {/* Tu progreso */}
        <section>
          <SectionHeader kicker="04" title={tx.progress} />
          <StatLedger
            items={[
              { kicker: tx.statClasses, value: stats.completedClasses },
              { kicker: tx.statBalance, value: stats.classesRemaining, accent: true },
              { kicker: tx.statWords, value: stats.lastClassWords },
            ]}
          />
        </section>

        {/* Anti-IA gentle note */}
        <div style={{ borderTop: '1px solid var(--ek-border)', paddingTop: 18 }}>
          <div className="ek-microlabel" style={{ marginBottom: 6 }}>{tx.noteKicker}</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--ek-text-muted)', maxWidth: '64ch' }}>{tx.note}</p>
        </div>
      </div>
    </div>
  )
}

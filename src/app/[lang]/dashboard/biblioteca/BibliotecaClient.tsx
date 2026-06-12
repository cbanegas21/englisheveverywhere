'use client'

import { useEffect, useState, useTransition, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { getBookSignedUrl } from '@/app/actions/library'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar } from '@/components/ui/DashTopBar'
import { StatLedger } from '@/components/ui/StatLedger'

interface Book {
  id: string
  title: string
  description: string | null
  level: string | null
  created_at: string
}

interface Props {
  lang: Locale
  books: Book[]
  variant?: 'student' | 'teacher'
  // Coming-soon mode: the library is not enabled yet (the plan is in-platform
  // interactive books, not downloads). Renders a placeholder, no book list.
  comingSoon?: boolean
}

const t = {
  en: {
    title: 'Library',
    subtitle: 'Curriculum books and reading materials · view-only',
    soonKicker: 'Coming soon',
    soonTitle: 'An interactive library, in the works',
    soonBody: 'We’re building our own books to read and work through right inside the platform — interactive, not downloads. It’ll open up here soon.',
    empty: 'No books available yet.',
    emptySub: 'The EnglishKolab team is curating the library. Books will appear here.',
    read: 'Open →',
    loading: 'Opening…',
    viewerError: 'Could not open this book. Please try again.',
    levelAll: 'All levels',
    closeLabel: 'Close viewer',
    noDownloadNote: 'Viewing only. Downloads are disabled.',
    stats: {
      total: 'Books',
      totalSub: 'in your library',
      levels: 'Levels',
      levelsSub: 'covered',
      latest: 'Latest',
      latestSub: 'added',
    },
    filterAll: 'All',
  },
  es: {
    title: 'Biblioteca',
    subtitle: 'Libros y materiales de lectura · solo lectura',
    soonKicker: 'Próximamente',
    soonTitle: 'Una biblioteca interactiva, en camino',
    soonBody: 'Estamos creando nuestros propios libros para leer y trabajar dentro de la plataforma — interactivos, no para descargar. Se abrirá aquí muy pronto.',
    empty: 'Todavía no hay libros disponibles.',
    emptySub: 'El equipo de EnglishKolab está organizando la biblioteca. Los libros aparecerán aquí.',
    read: 'Abrir →',
    loading: 'Abriendo…',
    viewerError: 'No se pudo abrir este libro. Inténtalo de nuevo.',
    levelAll: 'Todos los niveles',
    closeLabel: 'Cerrar visor',
    noDownloadNote: 'Solo lectura. La descarga está desactivada.',
    stats: {
      total: 'Libros',
      totalSub: 'en tu biblioteca',
      levels: 'Niveles',
      levelsSub: 'cubiertos',
      latest: 'Más reciente',
      latestSub: 'añadido',
    },
    filterAll: 'Todos',
  },
}

// Sentinel for the "show everything" filter tab. A CEFR level value can never be
// this string, so it never collides with a real level key — including a book whose
// level is the literal 'all' (suitable for all levels), which now gets its own
// working filter tab instead of a dead duplicate-key tab (LIB-02).
const ALL_FILTER = '__all__'

function fmtDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-HN' : 'en-US', {
    timeZone: 'America/Tegucigalpa',
    month: 'short',
    day: 'numeric',
  })
}

export default function BibliotecaClient({ lang, books, comingSoon }: Props) {
  const tx = t[lang]
  const accent = 'var(--ek-red)'
  const [openBook, setOpenBook] = useState<Book | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<string>(ALL_FILTER)

  const levels = useMemo(() => {
    const set = new Set<string>()
    for (const b of books) if (b.level) set.add(b.level)
    return Array.from(set).sort()
  }, [books])

  const filtered = useMemo(() => {
    if (filter === ALL_FILTER) return books
    return books.filter((b) => b.level === filter)
  }, [books, filter])

  const latest = useMemo(() => {
    if (books.length === 0) return null
    return books.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b))
  }, [books])

  function handleOpen(book: Book) {
    setError('')
    setSignedUrl(null)
    setOpenBook(book)
    startTransition(async () => {
      const res = await getBookSignedUrl(book.id)
      if ('error' in res && res.error) {
        setError(res.error)
        return
      }
      if ('success' in res && res.success && res.url) {
        setSignedUrl(res.url)
      }
    })
  }

  function handleClose() {
    setOpenBook(null)
    setSignedUrl(null)
    setError('')
  }

  // Coming-soon placeholder — no book list, no open/download. Editorial card
  // (red left-rule + mono kicker), matching the house style.
  if (comingSoon) {
    return (
      <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
        <DashTopBar title={tx.title} sub={tx.subtitle} />
        <div style={{ padding: '28px 36px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 18, maxWidth: 560, background: 'var(--ek-card)', border: '1px solid var(--ek-border)', borderRadius: 'var(--ek-radius-lg)', padding: '28px 30px' }}>
            <div style={{ width: 3, background: 'var(--ek-red)', borderRadius: 2, flexShrink: 0 }} />
            <div>
              <div className="ek-microlabel" style={{ color: 'var(--ek-red)' }}>{tx.soonKicker}</div>
              <h2 style={{ fontFamily: 'var(--ek-font-sans)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ek-text)', margin: '8px 0 0' }}>{tx.soonTitle}</h2>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ek-text-soft)', margin: '10px 0 0', maxWidth: 460 }}>{tx.soonBody}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--ek-paper)' }}>
      <style>{`
        .lk-bib-rule {
          align-self: stretch;
          width: 3px;
          border-radius: 2px;
          background: transparent;
          transition: background 0.16s ease;
        }
        .lk-bib-row { transition: background 0.16s ease; }
        .lk-bib-row:hover { background: var(--ek-paper-warm); }
        .lk-bib-row:hover .lk-bib-rule { background: var(--ek-red); }
        .lk-bib-open { transition: color 0.16s ease; }
        .lk-bib-row:hover .lk-bib-open { color: var(--ek-red); }
        .lk-bib-tab { transition: color 0.16s ease; }
        .lk-bib-tab:not(.lk-bib-tab--active):hover { color: var(--ek-text-soft); }
      `}</style>
      <DashTopBar title={tx.title} sub={tx.subtitle} />

      <div style={{ padding: '28px 36px', maxWidth: 1280, margin: '0 auto' }}>
        {books.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <StatLedger
              items={[
                { kicker: tx.stats.total, value: books.length, sub: tx.stats.totalSub, accent: true },
                { kicker: tx.stats.levels, value: levels.length || '—', sub: tx.stats.levelsSub },
                {
                  kicker: tx.stats.latest,
                  value: latest ? fmtDate(latest.created_at, lang) : '—',
                  sub: tx.stats.latestSub,
                },
              ]}
            />
          </div>
        )}

        {/* Level filter tabs */}
        {levels.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 4,
              marginBottom: 20,
              borderBottom: '1px solid var(--ek-border)',
              flexWrap: 'wrap',
            }}
          >
            {([{ key: ALL_FILTER, label: tx.filterAll }, ...levels.map((l) => ({ key: l, label: l === 'all' ? tx.levelAll : l }))]).map(
              (tab) => {
                const active = filter === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`lk-bib-tab${active ? ' lk-bib-tab--active' : ''}`}
                    style={{
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: 'transparent',
                      border: 0,
                      color: active ? 'var(--ek-text)' : 'var(--ek-text-muted)',
                      borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
                      marginBottom: -1,
                      fontFamily: 'var(--ek-font-sans)',
                    }}
                  >
                    {tab.label}
                  </button>
                )
              }
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <div
            style={{
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border)',
              borderRadius: 14,
              padding: 60,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ek-text)' }}>{tx.empty}</p>
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--ek-text-muted)' }}>{tx.emptySub}</p>
          </div>
        ) : (
          <section
            style={{
              background: 'var(--ek-card)',
              border: '1px solid var(--ek-border)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            {filtered.map((book, i) => (
              <button
                key={book.id}
                onClick={() => handleOpen(book)}
                className="lk-bib-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '3px 1fr auto auto',
                  gap: 18,
                  alignItems: 'center',
                  width: '100%',
                  padding: '18px 22px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--ek-border-soft)' : 'none',
                  background: 'transparent',
                  border: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'var(--ek-font-sans)',
                }}
              >
                <span aria-hidden className="lk-bib-rule" />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--ek-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {book.title}
                  </div>
                  {book.description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--ek-text-muted)',
                        marginTop: 3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.4,
                      }}
                    >
                      {book.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {book.level && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--ek-text-soft)',
                        fontFamily: 'var(--ek-font-mono)',
                      }}
                    >
                      {book.level === 'all' ? tx.levelAll : book.level}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--ek-text-muted)',
                      fontFamily: 'var(--ek-font-mono)',
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {fmtDate(book.created_at, lang)}
                  </span>
                </div>
                <span
                  className="lk-bib-open"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: 'var(--ek-text)',
                  }}
                >
                  {tx.read}
                </span>
              </button>
            ))}
          </section>
        )}
      </div>

      <AnimatePresence>
        {openBook && (
          <BookViewer
            lang={lang}
            book={openBook}
            signedUrl={signedUrl}
            loading={isPending}
            error={error}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function BookViewer({
  lang,
  book,
  signedUrl,
  loading,
  error,
  onClose,
}: {
  lang: Locale
  book: Book
  signedUrl: string | null
  loading: boolean
  error: string
  onClose: () => void
}) {
  const tx = t[lang]

  useEffect(() => {
    function handleContextMenu(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-book-viewer]')) e.preventDefault()
    }
    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 40 }}
      />
      <motion.div
        data-book-viewer
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        style={{
          position: 'fixed',
          inset: 16,
          zIndex: 50,
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--ek-ink)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
          fontFamily: 'var(--ek-font-sans)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: 'var(--ek-ink)',
            borderBottom: '1px solid rgba(244,239,230,0.10)',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--ek-on-dark)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {book.title}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--ek-on-dark-muted)' }}>
              {tx.noDownloadNote}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={tx.closeLabel}
            style={{
              marginLeft: 12,
              padding: 6,
              borderRadius: 6,
              color: 'var(--ek-on-dark-muted)',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            position: 'relative',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            background: 'var(--ek-ink-soft)',
          }}
        >
          {loading && !signedUrl && !error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ek-red)' }} />
                <p style={{ fontSize: 12, color: 'var(--ek-on-dark-muted)' }}>{tx.loading}</p>
              </div>
            </div>
          )}
          {error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 13, color: 'var(--ek-red-light)' }}>{error || tx.viewerError}</p>
            </div>
          )}
          {signedUrl && (
            <iframe
              src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
              style={{ width: '100%', height: '100%', border: 'none', background: 'var(--ek-ink-soft)' }}
              title={book.title}
            />
          )}
        </div>
      </motion.div>
    </>
  )
}

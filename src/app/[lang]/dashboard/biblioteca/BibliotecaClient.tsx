'use client'

import { useEffect, useState, useTransition } from 'react'
import { BookOpen, X, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { getBookSignedUrl } from '@/app/actions/library'
import type { Locale } from '@/lib/i18n/translations'

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
}

const t = {
  en: {
    title: 'Library',
    subtitle: 'Curriculum books and reading materials.',
    empty: 'No books available yet.',
    emptySub: 'The EnglishKolab team is curating the library. Books will appear here.',
    read: 'Open book',
    loading: 'Opening…',
    viewerError: 'Could not open this book. Please try again.',
    levelAll: 'All levels',
    closeLabel: 'Close viewer',
    noDownloadNote: 'Viewing only. Downloads are disabled.',
  },
  es: {
    title: 'Biblioteca',
    subtitle: 'Libros y materiales de lectura.',
    empty: 'Todavía no hay libros disponibles.',
    emptySub: 'El equipo de EnglishKolab está organizando la biblioteca. Los libros aparecerán aquí.',
    read: 'Abrir libro',
    loading: 'Abriendo…',
    viewerError: 'No se pudo abrir este libro. Inténtalo de nuevo.',
    levelAll: 'Todos los niveles',
    closeLabel: 'Cerrar visor',
    noDownloadNote: 'Solo lectura. La descarga está desactivada.',
  },
}

export default function BibliotecaClient({ lang, books }: Props) {
  const tx = t[lang]
  const [openBook, setOpenBook] = useState<Book | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

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

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto">
        {books.length === 0 ? (
          <div
            className="rounded-xl p-10 flex flex-col items-center text-center"
            style={{ background: '#fff', border: '1px solid #E5E7EB' }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
              style={{ background: 'rgba(196,30,58,0.08)' }}
            >
              <BookOpen className="h-6 w-6" style={{ color: '#C41E3A' }} />
            </div>
            <p className="text-[13px] font-semibold mb-1" style={{ color: '#111111' }}>{tx.empty}</p>
            <p className="text-[12px]" style={{ color: '#9CA3AF' }}>{tx.emptySub}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map(book => (
              <button
                key={book.id}
                onClick={() => handleOpen(book)}
                className="text-left rounded-xl p-5 transition-all cursor-pointer"
                style={{ background: '#fff', border: '1px solid #E5E7EB' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#C41E3A'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(196,30,58,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded"
                    style={{ background: 'rgba(196,30,58,0.08)' }}
                  >
                    <BookOpen className="h-5 w-5" style={{ color: '#C41E3A' }} />
                  </div>
                  {book.level && (
                    <span
                      className="text-[10px] font-semibold px-2 py-1 rounded"
                      style={{ background: '#F3F4F6', color: '#6B7280' }}
                    >
                      {book.level === 'all' ? tx.levelAll : book.level}
                    </span>
                  )}
                </div>
                <div className="text-[14px] font-bold mb-1.5" style={{ color: '#111111' }}>{book.title}</div>
                {book.description && (
                  <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: '#4B5563' }}>
                    {book.description}
                  </p>
                )}
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid #E5E7EB' }}>
                  <span className="text-[11px] font-semibold" style={{ color: '#C41E3A' }}>
                    {tx.read} →
                  </span>
                </div>
              </button>
            ))}
          </div>
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
  lang, book, signedUrl, loading, error, onClose,
}: {
  lang: Locale
  book: Book
  signedUrl: string | null
  loading: boolean
  error: string
  onClose: () => void
}) {
  const tx = t[lang]

  // Block the right-click context menu on the wrapper so the student can't
  // save the embedded PDF. The <iframe#toolbar=0> param hides Chrome's
  // built-in PDF download button; wrapper intercepts right-click to
  // block "Save as". Not airtight but a meaningful deterrent for MVP.
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
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.75)' }}
      />
      <motion.div
        data-book-viewer
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-4 md:inset-10 z-50 rounded-xl overflow-hidden flex flex-col"
        style={{ background: '#111111', boxShadow: '0 40px 80px rgba(0,0,0,0.4)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold truncate" style={{ color: '#fff' }}>{book.title}</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{tx.noDownloadNote}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={tx.closeLabel}
            className="ml-3 p-1.5 rounded transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'transparent' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="flex-1 relative select-none"
          style={{ background: '#2A2A2A', userSelect: 'none', WebkitUserSelect: 'none' }}
        >
          {loading && !signedUrl && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#C41E3A' }} />
                <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{tx.loading}</p>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
              <p className="text-[13px]" style={{ color: '#FCA5A5' }}>{error || tx.viewerError}</p>
            </div>
          )}
          {signedUrl && (
            <iframe
              src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
              className="w-full h-full"
              style={{ border: 'none', background: '#2A2A2A' }}
              title={book.title}
            />
          )}
        </div>
      </motion.div>
    </>
  )
}

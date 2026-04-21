'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, BookOpen, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { uploadBook, setBookActive, deleteBook } from '@/app/actions/library'
import type { Locale } from '@/lib/i18n/translations'

const LEVELS = ['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

interface Book {
  id: string
  title: string
  description: string | null
  level: string | null
  is_active: boolean
  storage_path: string
  created_at: string
}

interface Props { lang: Locale; books: Book[] }

const t = {
  en: {
    title: 'Library',
    subtitle: 'Upload and manage the book catalog.',
    upload: 'Upload book',
    uploading: 'Uploading…',
    fileLabel: 'PDF file',
    chooseFile: 'Choose PDF…',
    titleLabel: 'Title',
    descLabel: 'Description',
    levelLabel: 'CEFR level',
    levelAny: 'Any level',
    levelAll: 'All levels',
    active: 'Active',
    hidden: 'Hidden',
    deactivate: 'Hide',
    activate: 'Show',
    delete: 'Delete',
    deleteConfirm: 'Delete this book and its file? This cannot be undone.',
    empty: 'No books uploaded yet.',
    fileHint: 'PDF only, 40 MB max.',
  },
  es: {
    title: 'Biblioteca',
    subtitle: 'Sube y gestiona el catálogo de libros.',
    upload: 'Subir libro',
    uploading: 'Subiendo…',
    fileLabel: 'Archivo PDF',
    chooseFile: 'Elegir PDF…',
    titleLabel: 'Título',
    descLabel: 'Descripción',
    levelLabel: 'Nivel CEFR',
    levelAny: 'Cualquier nivel',
    levelAll: 'Todos los niveles',
    active: 'Activo',
    hidden: 'Oculto',
    deactivate: 'Ocultar',
    activate: 'Mostrar',
    delete: 'Eliminar',
    deleteConfirm: '¿Eliminar este libro y su archivo? Esto no se puede deshacer.',
    empty: 'Todavía no hay libros subidos.',
    fileHint: 'Solo PDF, máximo 40 MB.',
  },
}

function formatDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function AdminLibraryClient({ lang, books }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [titleVal, setTitleVal] = useState('')
  const [desc, setDesc] = useState('')
  const [level, setLevel] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [rowPendingId, setRowPendingId] = useState<string | null>(null)
  const [rowTransition, startRowTransition] = useTransition()

  function handleUpload() {
    if (!file || !titleVal.trim()) {
      setError(lang === 'es' ? 'Archivo y título son requeridos' : 'File and title are required')
      return
    }
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', titleVal.trim())
    fd.append('description', desc.trim())
    if (level) fd.append('level', level)
    startTransition(async () => {
      const res = await uploadBook(fd)
      if ('error' in res && res.error) {
        setError(res.error)
        return
      }
      setFile(null)
      setTitleVal('')
      setDesc('')
      setLevel('')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    })
  }

  function handleToggleActive(book: Book) {
    setRowPendingId(book.id)
    startRowTransition(async () => {
      await setBookActive(book.id, !book.is_active)
      setRowPendingId(null)
      router.refresh()
    })
  }

  function handleDelete(book: Book) {
    if (!confirm(tx.deleteConfirm)) return
    setRowPendingId(book.id)
    startRowTransition(async () => {
      await deleteBook(book.id)
      setRowPendingId(null)
      router.refresh()
    })
  }

  return (
    <div className="min-h-full" style={{ background: '#F9F9F9' }}>

      <div className="px-8 py-6" style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <h1 className="text-[20px] font-black" style={{ color: '#111111' }}>{tx.title}</h1>
        <p className="text-[13px] mt-0.5" style={{ color: '#9CA3AF' }}>{tx.subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-5">

        {/* Upload card */}
        <div className="rounded-xl p-5 space-y-4" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" style={{ color: '#C41E3A' }} />
            <h3 className="text-[13px] font-bold" style={{ color: '#111111' }}>{tx.upload}</h3>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: '#9CA3AF' }}>
              {tx.fileLabel}
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              disabled={isPending}
              className="w-full rounded px-3 py-2 text-[13px] outline-none file:mr-3 file:rounded file:border-0 file:bg-[rgba(196,30,58,0.08)] file:text-[#C41E3A] file:font-semibold file:px-3 file:py-1 file:text-[12px]"
              style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
            />
            <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>{tx.fileHint}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: '#9CA3AF' }}>
                {tx.titleLabel}
              </label>
              <input
                type="text"
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                disabled={isPending}
                maxLength={120}
                className="w-full rounded px-3 py-2 text-[13px] outline-none"
                style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: '#9CA3AF' }}>
                {tx.levelLabel}
              </label>
              <select
                value={level}
                onChange={e => setLevel(e.target.value)}
                disabled={isPending}
                className="w-full rounded px-3 py-2 text-[13px] outline-none"
                style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
              >
                <option value="">{tx.levelAny}</option>
                {LEVELS.map(l => (
                  <option key={l} value={l}>{l === 'all' ? tx.levelAll : l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: '#9CA3AF' }}>
              {tx.descLabel}
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              disabled={isPending}
              rows={2}
              className="w-full rounded px-3 py-2 text-[13px] outline-none resize-none"
              style={{ border: '1px solid #E5E7EB', background: '#fff', color: '#111111' }}
            />
          </div>

          {error && <p className="text-[12px]" style={{ color: '#DC2626' }}>{error}</p>}

          <button
            onClick={handleUpload}
            disabled={isPending || !file || !titleVal.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-[12px] font-semibold disabled:opacity-50"
            style={{ background: '#C41E3A', color: '#fff' }}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {isPending ? tx.uploading : tx.upload}
          </button>
        </div>

        {/* Books list */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          {books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                style={{ background: 'rgba(196,30,58,0.08)' }}
              >
                <BookOpen className="h-6 w-6" style={{ color: '#C41E3A' }} />
              </div>
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>{tx.empty}</p>
            </div>
          ) : (
            <ul>
              {books.map((book, idx) => {
                const busy = rowPendingId === book.id && rowTransition
                return (
                  <li
                    key={book.id}
                    className="flex items-center gap-4 px-5 py-4"
                    style={{ borderBottom: idx < books.length - 1 ? '1px solid #E5E7EB' : 'none' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold truncate" style={{ color: '#111111' }}>{book.title}</span>
                        {book.level && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0"
                            style={{ background: '#F3F4F6', color: '#6B7280' }}
                          >
                            {book.level === 'all' ? tx.levelAll : book.level}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0"
                          style={{
                            background: book.is_active ? 'rgba(5,150,105,0.1)' : '#F3F4F6',
                            color: book.is_active ? '#059669' : '#6B7280',
                          }}
                        >
                          {book.is_active ? tx.active : tx.hidden}
                        </span>
                      </div>
                      {book.description && (
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: '#9CA3AF' }}>
                          {book.description}
                        </p>
                      )}
                      <p className="text-[10px] mt-0.5" style={{ color: '#D1D5DB' }}>
                        {formatDate(book.created_at, lang)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleActive(book)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium disabled:opacity-50"
                      style={{ color: '#6B7280', border: '1px solid #E5E7EB' }}
                    >
                      {book.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {book.is_active ? tx.deactivate : tx.activate}
                    </button>
                    <button
                      onClick={() => handleDelete(book)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium transition-all disabled:opacity-50"
                      style={{ color: '#DC2626' }}
                      onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'rgba(220,38,38,0.08)' }}
                      onMouseLeave={e => { if (!busy) e.currentTarget.style.background = 'transparent' }}
                    >
                      <Trash2 className="h-3 w-3" />
                      {tx.delete}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

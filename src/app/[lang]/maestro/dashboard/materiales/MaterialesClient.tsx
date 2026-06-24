'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Share2, ExternalLink, X } from 'lucide-react'
import type { Locale } from '@/lib/i18n/translations'
import { DashTopBar, TitleFlourish } from '@/components/ui/DashTopBar'
import Modal from '@/components/dashboard/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { uploadLabFile, deleteLabFile, shareLabFile, unshareLabFile, getLabFileSignedUrl } from '@/app/actions/lab'

interface ShareTarget { studentId: string; name: string }
interface LabFile {
  id: string
  fileName: string
  description: string
  mimeType: string
  sizeBytes: number
  sharedWith: ShareTarget[]
}
interface Props { lang: Locale; files: LabFile[]; students: { id: string; name: string }[] }

const t = {
  en: {
    title: 'Materials', flourish: 'your files', sub: 'Upload files and share them with your students.',
    upload: 'Upload a file', file: 'File', choose: 'Choose a file…', name: 'Display name (optional)', namePh: 'e.g. Unit 3 — listening',
    desc: 'Note (optional)', descPh: 'A short note for your student.', uploadBtn: 'Upload', uploading: 'Uploading…',
    empty: 'No files yet.', emptySub: 'Upload your first file to share it with a student.',
    sharedWith: 'Shared with', notShared: 'Not shared yet', share: 'Share', view: 'Open', remove: 'Remove',
    shareTitle: 'Share file', chooseStudent: 'Student', noStudents: 'No booked students yet.', send: 'Share', sending: 'Sharing…',
    confirmDelete: 'Delete this file? This cannot be undone.', maxNote: 'Up to 25 MB. PDF, images, audio, video, Office docs.',
  },
  es: {
    title: 'Materiales', flourish: 'tus archivos', sub: 'Sube archivos y compártelos con tus estudiantes.',
    upload: 'Subir un archivo', file: 'Archivo', choose: 'Elige un archivo…', name: 'Nombre visible (opcional)', namePh: 'ej. Unidad 3 — listening',
    desc: 'Nota (opcional)', descPh: 'Una nota corta para tu estudiante.', uploadBtn: 'Subir', uploading: 'Subiendo…',
    empty: 'Aún no tienes archivos.', emptySub: 'Sube tu primer archivo para compartirlo con un estudiante.',
    sharedWith: 'Compartido con', notShared: 'Aún no compartido', share: 'Compartir', view: 'Abrir', remove: 'Quitar',
    shareTitle: 'Compartir archivo', chooseStudent: 'Estudiante', noStudents: 'Aún no tienes estudiantes con reserva.', send: 'Compartir', sending: 'Compartiendo…',
    confirmDelete: '¿Eliminar este archivo? No se puede deshacer.', maxNote: 'Hasta 25 MB. PDF, imágenes, audio, video, documentos Office.',
  },
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--ek-border)', background: 'var(--ek-paper)', color: 'var(--ek-text)', fontSize: 14, fontFamily: 'var(--ek-font-sans)' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)', marginBottom: 6 }

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}
function fmtType(mime: string): string {
  if (mime === 'application/pdf') return 'PDF'
  if (mime.startsWith('image/')) return mime.replace('image/', '').toUpperCase()
  if (mime.startsWith('audio/')) return 'Audio'
  if (mime.startsWith('video/')) return 'Video'
  if (mime.includes('word')) return 'DOCX'
  if (mime.includes('presentation')) return 'PPTX'
  if (mime.includes('spreadsheet')) return 'XLSX'
  if (mime === 'text/plain') return 'TXT'
  return 'Archivo'
}

export default function MaterialesClient({ lang, files, students }: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [shareFile, setShareFile] = useState<LabFile | null>(null)
  const [shareStudent, setShareStudent] = useState('')
  const [shareError, setShareError] = useState('')

  function doUpload() {
    if (!selected || pending) return
    setError('')
    const fd = new FormData()
    fd.set('file', selected)
    fd.set('fileName', name || selected.name)
    fd.set('description', description)
    fd.set('lang', lang)
    startTransition(async () => {
      const res = await uploadLabFile(fd)
      if (res && 'error' in res) { setError(res.error ?? ''); return }
      setSelected(null); setName(''); setDescription('')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    })
  }

  function doDelete(id: string) {
    if (pending || !window.confirm(tx.confirmDelete)) return
    startTransition(async () => {
      const res = await deleteLabFile({ id, lang })
      if (!(res && 'error' in res)) router.refresh()
      else setError(res.error ?? '')
    })
  }

  function openShare(f: LabFile) { setShareFile(f); setShareStudent(students[0]?.id ?? ''); setShareError('') }
  function doShare() {
    if (!shareFile || !shareStudent) return
    setShareError('')
    startTransition(async () => {
      const res = await shareLabFile({ fileId: shareFile.id, studentId: shareStudent, lang })
      if (res && 'error' in res) { setShareError(res.error ?? ''); return }
      setShareFile(null); router.refresh()
    })
  }
  function doUnshare(fileId: string, studentId: string) {
    startTransition(async () => {
      const res = await unshareLabFile({ fileId, studentId, lang })
      if (!(res && 'error' in res)) router.refresh()
    })
  }

  // Open a blank tab synchronously on click (preserves the user gesture), then
  // point it at the signed URL once the gated action returns.
  function doView(fileId: string) {
    const w = window.open('', '_blank')
    startTransition(async () => {
      const res = await getLabFileSignedUrl({ fileId, lang })
      if (res && 'url' in res && res.url) {
        if (w) w.location.href = res.url
        else window.location.href = res.url
      } else {
        w?.close()
        setError((res && 'error' in res ? res.error : '') ?? '')
      }
    })
  }

  return (
    <div style={{ background: 'var(--ek-paper)', minHeight: '100%' }}>
      <DashTopBar title={<>{tx.title} — <TitleFlourish>{tx.flourish}</TitleFlourish></>} sub={tx.sub} />

      <div style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(20px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Upload */}
        <div style={{ borderRadius: 14, border: '1px solid var(--ek-border)', background: 'var(--ek-card)', padding: 'clamp(16px, 3vw, 22px)' }}>
          <label style={labelStyle}>{tx.upload}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setSelected(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13, color: 'var(--ek-text)' }}
            />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tx.namePh} style={inputStyle} maxLength={200} />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tx.descPh} style={inputStyle} maxLength={1000} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button
                onClick={doUpload}
                disabled={pending || !selected}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 18px', borderRadius: 8, border: 0, cursor: pending || !selected ? 'default' : 'pointer', opacity: pending || !selected ? 0.6 : 1 }}
              >
                {pending ? <Spinner size={14} stroke="#fff" /> : <Plus size={16} />}
                {pending ? tx.uploading : tx.uploadBtn}
              </button>
              <span style={{ fontSize: 12, color: 'var(--ek-text-muted)' }}>{tx.maxNote}</span>
            </div>
            {error && <span role="alert" style={{ fontSize: 13, color: 'var(--ek-red)' }}>{error}</span>}
          </div>
        </div>

        {/* File list */}
        {files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ek-text)', margin: '0 0 6px' }}>{tx.empty}</p>
            <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', margin: 0 }}>{tx.emptySub}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {files.map((f) => (
              <div key={f.id} style={{ borderRadius: 12, border: '1px solid var(--ek-border)', background: 'var(--ek-card)', padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--ek-font-mono)', color: 'var(--ek-text-muted)', border: '1px solid var(--ek-border)', borderRadius: 999, padding: '2px 8px' }}>{fmtType(f.mimeType)}</span>
                      <span style={{ fontSize: 11, color: 'var(--ek-text-muted)' }}>{fmtSize(f.sizeBytes)}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ek-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</div>
                    {f.description && <div style={{ fontSize: 13, color: 'var(--ek-text-muted)', marginTop: 2 }}>{f.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => doView(f.id)} disabled={pending} title={tx.view} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ek-text)', background: 'transparent', border: '1px solid var(--ek-border)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}><ExternalLink size={13} /> {tx.view}</button>
                    <button onClick={() => openShare(f)} disabled={pending} title={tx.share} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--ek-red)', border: 0, borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}><Share2 size={13} /> {tx.share}</button>
                    <button onClick={() => doDelete(f.id)} disabled={pending} title={tx.remove} aria-label={tx.remove} style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ek-text-muted)', background: 'transparent', border: '1px solid var(--ek-border)', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}><Trash2 size={13} /></button>
                  </div>
                </div>
                {/* Shared-with chips */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ek-text-muted)', fontFamily: 'var(--ek-font-mono)' }}>{f.sharedWith.length ? `${tx.sharedWith}:` : tx.notShared}</span>
                  {f.sharedWith.map((s) => (
                    <span key={s.studentId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ek-text)', background: 'var(--ek-paper)', border: '1px solid var(--ek-border)', borderRadius: 999, padding: '3px 6px 3px 10px' }}>
                      {s.name}
                      <button onClick={() => doUnshare(f.id, s.studentId)} disabled={pending} aria-label={`${tx.remove} ${s.name}`} style={{ display: 'inline-flex', background: 'transparent', border: 0, color: 'var(--ek-text-muted)', cursor: 'pointer', padding: 0 }}><X size={13} /></button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!shareFile} onClose={() => setShareFile(null)}
        kicker={tx.share} title={shareFile?.fileName || tx.shareTitle} maxWidth={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
            {shareError && <span style={{ fontSize: 12.5, color: 'var(--ek-red)', marginRight: 'auto' }}>{shareError}</span>}
            <button onClick={() => setShareFile(null)} style={{ fontSize: 14, fontWeight: 600, color: 'var(--ek-text-muted)', background: 'transparent', border: 0, cursor: 'pointer', padding: '10px 14px' }}>{lang === 'es' ? 'Cancelar' : 'Cancel'}</button>
            <button onClick={doShare} disabled={pending || !shareStudent} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ek-red)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 8, border: 0, cursor: pending || !shareStudent ? 'default' : 'pointer', opacity: pending || !shareStudent ? 0.6 : 1 }}>{pending && <Spinner size={14} stroke="#fff" />}{pending ? tx.sending : tx.send}</button>
          </div>
        }
      >
        {students.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ek-text-muted)', margin: 0 }}>{tx.noStudents}</p>
        ) : (
          <div>
            <label style={labelStyle}>{tx.chooseStudent}</label>
            <select value={shareStudent} onChange={(e) => setShareStudent(e.target.value)} style={inputStyle}>
              {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>
        )}
      </Modal>
    </div>
  )
}

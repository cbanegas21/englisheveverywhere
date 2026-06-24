'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Paperclip, X } from 'lucide-react'
import { attachAssignmentFile, removeAssignmentFile, getAssignmentFileSignedUrl } from '@/app/actions/assignments'
import { Spinner } from '@/components/ui/Spinner'
import type { Locale } from '@/lib/i18n/translations'

type FileKind = 'assignment' | 'submission' | 'audio'

interface Props {
  lang: Locale
  kind: FileKind
  assignmentId: string
  fileName: string | null // current attached file's display name, or null
  canEdit: boolean // show attach/replace/remove controls
  label: string
  attachCta?: string // e.g. "Attach a file" / "Attach audio"
  accept?: string
}

const T = {
  en: { open: 'Open', replace: 'Replace', attach: 'Attach', remove: 'Remove', uploading: 'Uploading…', none: 'No file', failed: 'Could not open the file.' },
  es: { open: 'Abrir', replace: 'Reemplazar', attach: 'Adjuntar', remove: 'Quitar', uploading: 'Subiendo…', none: 'Sin archivo', failed: 'No se pudo abrir el archivo.' },
}

const microlabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--ek-text-muted)',
  marginBottom: 8,
}

export default function AssignmentFileControl({ lang, kind, assignmentId, fileName, canEdit, label, attachCta, accept }: Props) {
  const tx = T[lang]
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const [error, setError] = useState('')

  function openFile() {
    setError('')
    const w = window.open('', '_blank')
    start(async () => {
      const res = await getAssignmentFileSignedUrl({ assignmentId, kind, lang })
      if (res && 'url' in res && res.url) {
        if (w) w.location.href = res.url
        else window.location.href = res.url
      } else {
        w?.close()
        setError((res && 'error' in res ? res.error : '') || tx.failed)
      }
    })
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    setError('')
    const fd = new FormData()
    fd.set('kind', kind)
    fd.set('assignmentId', assignmentId)
    fd.set('lang', lang)
    fd.set('file', file)
    start(async () => {
      const res = await attachAssignmentFile(fd)
      if (res && 'error' in res) setError(res.error ?? '')
      else router.refresh()
    })
  }

  function remove() {
    setError('')
    start(async () => {
      const res = await removeAssignmentFile({ assignmentId, kind, lang })
      if (res && 'error' in res) setError(res.error ?? '')
      else router.refresh()
    })
  }

  return (
    <div>
      <div style={microlabel}>{label}</div>
      {fileName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--ek-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{fileName}</span>
          <button onClick={openFile} disabled={pending} style={btn}><ExternalLink size={13} /> {tx.open}</button>
          {canEdit && (
            <>
              <button onClick={() => inputRef.current?.click()} disabled={pending} style={btn}>{tx.replace}</button>
              <button onClick={remove} disabled={pending} aria-label={tx.remove} style={{ ...btn, padding: '5px 8px' }}><X size={13} /></button>
            </>
          )}
          {pending && <Spinner size={13} />}
        </div>
      ) : canEdit ? (
        <button onClick={() => inputRef.current?.click()} disabled={pending} style={{ ...btn, padding: '7px 12px' }}>
          {pending ? <Spinner size={13} /> : <Paperclip size={13} />} {pending ? tx.uploading : (attachCta || tx.attach)}
        </button>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--ek-text-muted)' }}>{tx.none}</span>
      )}
      <input ref={inputRef} type="file" accept={accept} onChange={onPick} style={{ display: 'none' }} />
      {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ek-red)' }}>{error}</p>}
    </div>
  )
}

const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--ek-text)',
  background: 'transparent',
  border: '1px solid var(--ek-border)',
  borderRadius: 6,
  padding: '5px 10px',
  cursor: 'pointer',
}

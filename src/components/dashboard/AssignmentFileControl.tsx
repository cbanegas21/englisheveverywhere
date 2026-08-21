'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Paperclip, X, Mic, Square } from 'lucide-react'
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
  en: { open: 'Open', replace: 'Replace', attach: 'Attach', remove: 'Remove', uploading: 'Uploading…', none: 'No file', failed: 'Could not open the file.', record: 'Record', stop: 'Stop', micDenied: 'Could not access the microphone.' },
  es: { open: 'Abrir', replace: 'Reemplazar', attach: 'Adjuntar', remove: 'Quitar', uploading: 'Subiendo…', none: 'Sin archivo', failed: 'No se pudo abrir el archivo.', record: 'Grabar', stop: 'Detener', micDenied: 'No se pudo acceder al micrófono.' },
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
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Shared upload path — used by both the file picker and the audio recorder, so
  // the recorded blob goes through exactly the same validated attach flow.
  function uploadFile(file: File) {
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
    uploadFile(file)
  }

  async function startRec() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(tx.micDenied)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      // Prefer a mime the server allowlist accepts (files.ts: audio/webm, audio/mp4).
      const preferred = ['audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m))
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data) }
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        // Strip any ";codecs=…" so the File's type matches the allowlist exactly.
        const baseMime = (recorder.mimeType || preferred || 'audio/webm').split(';')[0]
        const ext = baseMime.includes('mp4') ? 'm4a' : 'webm'
        const blob = new Blob(chunksRef.current, { type: baseMime })
        chunksRef.current = []
        if (blob.size === 0) return
        const name = lang === 'es' ? `nota-de-voz.${ext}` : `voice-note.${ext}`
        uploadFile(new File([blob], name, { type: baseMime }))
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      setError(tx.micDenied)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  function stopRec() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  function remove() {
    setError('')
    start(async () => {
      const res = await removeAssignmentFile({ assignmentId, kind, lang })
      if (res && 'error' in res) setError(res.error ?? '')
      else router.refresh()
    })
  }

  // The record/stop control — only for teacher audio feedback.
  const recordCtl = kind === 'audio' && canEdit
    ? (recording ? (
        <button onClick={stopRec} style={{ ...btn, color: 'var(--ek-red)', borderColor: 'var(--ek-red)' }}>
          <Square size={12} /> {tx.stop}
        </button>
      ) : (
        <button onClick={startRec} disabled={pending} style={btn}>
          <Mic size={13} /> {tx.record}
        </button>
      ))
    : null

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
              {recordCtl}
              <button onClick={remove} disabled={pending} aria-label={tx.remove} style={{ ...btn, padding: '5px 8px' }}><X size={13} /></button>
            </>
          )}
          {pending && <Spinner size={13} />}
        </div>
      ) : canEdit ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => inputRef.current?.click()} disabled={pending} style={{ ...btn, padding: '7px 12px' }}>
            {pending ? <Spinner size={13} /> : <Paperclip size={13} />} {pending ? tx.uploading : (attachCta || tx.attach)}
          </button>
          {recordCtl}
        </div>
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

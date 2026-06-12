'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDataChannel, useLocalParticipant } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { transcribeAudioChunk } from '@/app/actions/video'

export interface TranscriptLine {
  id: string
  identity: string
  name: string
  text: string
  timestamp: number
  isFinal: boolean
}

// Browser Web Speech API is untyped in lib.dom. Minimal local shim so the
// fallback path avoids pulling in an external dep just for event shapes.
type SR = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean; length: number }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
}
type SRCtor = { new(): SR }

declare global {
  interface Window {
    SpeechRecognition?: SRCtor
    webkitSpeechRecognition?: SRCtor
  }
}

interface Args {
  enabled: boolean
  /** Booking id — used to authorize transcription against the call participants. */
  bookingId: string
  /** BCP-47 lang for the browser fallback recognizer only (Deepgram uses
   *  multilingual auto-detect). Defaults to en-US. */
  lang?: string
}

// How long each recorded slice is before it's sent for transcription. Each
// slice is a standalone WebM, so we stop+restart the recorder per slice.
const CHUNK_MS = 6000

// Bounds on transcript data (CALL-03). Per-line cap stops a malicious/runaway
// payload from bloating one entry; total cap bounds memory + the persisted
// snapshot over a long (or flooded) session. 2000 lines ≈ 200 min of 6s chunks,
// well past the 150-min max room window.
const MAX_LINE_CHARS = 500
const MAX_FINALS = 2000

// Live transcript. Primary engine: record the local mic in short slices and
// transcribe each server-side via Deepgram nova-3 multilingual (key stays on
// the server). Each participant captions themselves; finals are broadcast over
// LiveKit's 'transcript' data channel so the peer sees both speakers. Falls
// back to the browser Web Speech API when Deepgram isn't configured.
export function useLiveTranscript({ enabled, bookingId, lang = 'en-US' }: Args) {
  const { localParticipant } = useLocalParticipant()

  const [finals, setFinals] = useState<TranscriptLine[]>([])
  const [interims, setInterims] = useState<Record<string, TranscriptLine>>({})
  const [supported, setSupported] = useState(true)
  const [listening, setListening] = useState(false)

  const sendRef = useRef<((payload: Uint8Array, opts: { topic: string; reliable: boolean }) => Promise<void>) | null>(null)
  const lpRef = useRef(localParticipant)
  lpRef.current = localParticipant
  const meRef = useRef({ identity: localParticipant.identity, name: localParticipant.name || 'Speaker' })
  meRef.current = { identity: localParticipant.identity, name: localParticipant.name || 'Speaker' }
  // Monotonic counter so every line gets a locally-generated unique id — never
  // trust a peer-supplied id (React-key collisions) (video-4).
  const lineSeqRef = useRef(0)

  const applyLine = useCallback((line: TranscriptLine) => {
    if (line.isFinal) {
      // Keep only the most recent MAX_FINALS to bound memory (CALL-03).
      setFinals(prev => [...prev, line].slice(-MAX_FINALS))
      setInterims(prev => {
        if (!prev[line.identity]) return prev
        const next = { ...prev }
        delete next[line.identity]
        return next
      })
    } else {
      setInterims(prev => ({ ...prev, [line.identity]: line }))
    }
  }, [])
  const applyLineRef = useRef(applyLine)
  applyLineRef.current = applyLine

  // Always subscribe to 'transcript' so peer captions arrive even when our own
  // engine isn't running.
  const { send } = useDataChannel('transcript', msg => {
    try {
      const text = new TextDecoder().decode(msg.payload)
      const raw = JSON.parse(text) as Partial<TranscriptLine>
      if (!raw || typeof raw.text !== 'string') return
      // Build the line from VALIDATED primitives only — a peer controls the whole
      // payload. Attribute to the AUTHENTICATED sender (msg.from), not the claimed
      // identity/name (anti-spoof). Never trust raw.id (React-key collisions),
      // raw.timestamp (a NaN/string makes `new Date(ts).toISOString()` throw in
      // snapshot()), or raw.isFinal — regenerate/coerce all three (CALL-03 / video-4).
      const identity = msg.from?.identity ?? (typeof raw.identity === 'string' ? raw.identity : 'peer')
      const ts = typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp) ? raw.timestamp : Date.now()
      const line: TranscriptLine = {
        id: `${identity}-${ts}-${lineSeqRef.current++}`,
        identity,
        name: msg.from?.name || (typeof raw.name === 'string' ? raw.name : '') || 'Speaker',
        text: raw.text.slice(0, MAX_LINE_CHARS),
        timestamp: ts,
        isFinal: Boolean(raw.isFinal),
      }
      applyLineRef.current(line)
    } catch { /* ignore malformed */ }
  })
  sendRef.current = send as typeof sendRef.current

  const broadcast = useCallback((line: TranscriptLine) => {
    applyLineRef.current(line)
    const payload = new TextEncoder().encode(JSON.stringify(line))
    const fn = sendRef.current
    // Best-effort fan-out — swallow rejections (e.g. publishing to a room with
    // no remote participant yet) so they never surface as unhandled errors.
    if (fn) void fn(payload, { topic: 'transcript', reliable: true }).catch(() => {})
  }, [])
  const broadcastRef = useRef(broadcast)
  broadcastRef.current = broadcast

  useEffect(() => {
    if (!enabled) { setListening(false); return }

    let cancelled = false
    let usingFallback = false
    let recorder: MediaRecorder | null = null
    let stopTimer: ReturnType<typeof setTimeout> | null = null
    let micWait = 0
    let sr: SR | null = null

    const lineFrom = (text: string, isFinal: boolean): TranscriptLine => ({
      id: `${meRef.current.identity}-${Date.now()}-${lineSeqRef.current++}`,
      identity: meRef.current.identity,
      name: meRef.current.name,
      text: text.slice(0, MAX_LINE_CHARS),
      timestamp: Date.now(),
      isFinal,
    })

    const getMicTrack = () =>
      lpRef.current.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack ?? null

    function pickMime(): string {
      if (typeof MediaRecorder === 'undefined') return ''
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
      if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
      return ''
    }

    function startBrowserFallback() {
      if (cancelled) return
      usingFallback = true
      const Ctor = typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : undefined
      if (!Ctor) { setSupported(false); setListening(false); return }
      const rec = new Ctor()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = lang
      rec.onresult = evt => {
        for (let i = evt.resultIndex; i < evt.results.length; i += 1) {
          const res = evt.results[i]
          const text = res[0]?.transcript?.trim() || ''
          if (!text) continue
          const line = lineFrom(text, Boolean(res.isFinal))
          if (line.isFinal) broadcastRef.current(line)
          else applyLineRef.current(line)
        }
      }
      rec.onend = () => { if (cancelled || sr !== rec) return; try { rec.start() } catch { /* running */ } }
      rec.onerror = e => { if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') setSupported(false) }
      try { rec.start(); sr = rec; setListening(true); setSupported(true) } catch { setListening(false) }
    }

    async function handleBlob(blob: Blob) {
      if (cancelled || blob.size < 1200) return
      try {
        const fd = new FormData()
        fd.append('bookingId', bookingId)
        fd.append('audio', blob, 'chunk.webm')
        const res = await transcribeAudioChunk(fd)
        if (cancelled) return
        if ('error' in res) {
          if (res.error === 'not-configured' && !usingFallback) {
            cleanupDeepgram()
            startBrowserFallback()
          }
          return
        }
        const text = res.text?.trim()
        if (text) broadcastRef.current(lineFrom(text, true))
      } catch { /* transient — skip this chunk */ }
    }

    function cleanupDeepgram() {
      if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
      try { if (recorder && recorder.state !== 'inactive') recorder.stop() } catch { /* ignore */ }
      recorder = null
    }

    function cycle(mime: string) {
      if (cancelled || usingFallback) return
      const micTrack = getMicTrack()
      if (!micTrack) { stopTimer = setTimeout(() => cycle(mime), 500); return }
      let rec: MediaRecorder
      try {
        rec = new MediaRecorder(new MediaStream([micTrack]), { mimeType: mime })
      } catch { stopTimer = setTimeout(() => cycle(mime), 800); return }
      const parts: Blob[] = []
      rec.ondataavailable = e => { if (e.data.size > 0) parts.push(e.data) }
      rec.onstop = () => {
        void handleBlob(new Blob(parts, { type: mime }))
        if (!cancelled && !usingFallback) cycle(mime)
      }
      try { rec.start() } catch { stopTimer = setTimeout(() => cycle(mime), 800); return }
      recorder = rec
      // NB: only stop the recorder — never micTrack.stop(); it's LiveKit's
      // published mic and stopping it would kill the call audio.
      stopTimer = setTimeout(() => { try { if (rec.state !== 'inactive') rec.stop() } catch { /* ignore */ } }, CHUNK_MS)
    }

    function start() {
      if (cancelled) return
      const mime = pickMime()
      if (!mime) { startBrowserFallback(); return } // no MediaRecorder support
      const micTrack = getMicTrack()
      if (!micTrack) {
        micWait += 1
        if (micWait > 30) { startBrowserFallback(); return } // ~15s, no mic → fallback
        stopTimer = setTimeout(start, 500)
        return
      }
      setSupported(true)
      setListening(true)
      cycle(mime)
    }

    start()

    return () => {
      cancelled = true
      cleanupDeepgram()
      if (sr) { try { sr.stop() } catch { /* ignore */ } sr = null }
      setListening(false)
    }
  }, [enabled, lang, bookingId, localParticipant.identity])

  const clear = useCallback(() => {
    setFinals([])
    setInterims({})
  }, [])

  // Serialize finals for persistence. Sorted by timestamp so teacher + student
  // captions interleave correctly.
  const snapshot = useCallback(() => {
    const sorted = [...finals].sort((a, b) => a.timestamp - b.timestamp)
    return sorted
      .map(l => {
        // Defensive: a non-finite timestamp would make new Date(...).toISOString() throw.
        const t = Number.isFinite(l.timestamp) ? new Date(l.timestamp) : new Date()
        return `[${t.toISOString()}] ${l.name}: ${l.text.trim()}`
      })
      .join('\n')
  }, [finals])

  return { finals, interims, supported, listening, clear, snapshot }
}

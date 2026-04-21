'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDataChannel, useLocalParticipant } from '@livekit/components-react'

export interface TranscriptLine {
  id: string
  identity: string
  name: string
  text: string
  timestamp: number
  isFinal: boolean
}

// Browser Web Speech API is untyped in lib.dom. Minimal local shim so we
// avoid pulling in an external dep just for event shapes.
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
}

// Live transcript via browser SpeechRecognition. Each participant captions
// themselves; the result is broadcast over LiveKit's 'transcript' data
// channel so the peer sees captions for both speakers. Recognition restarts
// on `onend` (Chrome caps ~30s of silence) for the life of the call.
export function useLiveTranscript({ enabled }: Args) {
  const { localParticipant } = useLocalParticipant()

  const [finals, setFinals] = useState<TranscriptLine[]>([])
  const [interims, setInterims] = useState<Record<string, TranscriptLine>>({})
  const [supported, setSupported] = useState(true)
  const [listening, setListening] = useState(false)

  const recognitionRef = useRef<SR | null>(null)
  const sendRef = useRef<((payload: Uint8Array, opts: { topic: string; reliable: boolean }) => Promise<void>) | null>(null)

  const applyLine = useCallback((line: TranscriptLine) => {
    if (line.isFinal) {
      setFinals(prev => [...prev, line])
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

  // Always subscribe to the 'transcript' topic so peer captions arrive even
  // when we're not speaking or our recognition engine isn't supported.
  const { send } = useDataChannel('transcript', msg => {
    try {
      const text = new TextDecoder().decode(msg.payload)
      const line = JSON.parse(text) as TranscriptLine
      if (line && typeof line.text === 'string') applyLine(line)
    } catch { /* ignore malformed */ }
  })
  sendRef.current = send as typeof sendRef.current

  const broadcast = useCallback((line: TranscriptLine) => {
    applyLine(line)
    const payload = new TextEncoder().encode(JSON.stringify(line))
    const fn = sendRef.current
    if (fn) void fn(payload, { topic: 'transcript', reliable: true })
  }, [applyLine])

  const broadcastRef = useRef(broadcast)
  broadcastRef.current = broadcast

  useEffect(() => {
    if (!enabled) {
      const rec = recognitionRef.current
      if (rec) {
        try { rec.stop() } catch { /* ignore */ }
      }
      recognitionRef.current = null
      setListening(false)
      return
    }

    const Ctor = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : undefined
    if (!Ctor) {
      setSupported(false)
      return
    }

    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    let stopped = false

    rec.onresult = evt => {
      for (let i = evt.resultIndex; i < evt.results.length; i += 1) {
        const res = evt.results[i]
        const alt = res[0]
        const text = alt?.transcript?.trim() || ''
        if (!text) continue
        broadcastRef.current({
          id: `${localParticipant.identity}-${Date.now()}-${i}`,
          identity: localParticipant.identity,
          name: localParticipant.name || 'Speaker',
          text,
          timestamp: Date.now(),
          isFinal: Boolean(res.isFinal),
        })
      }
    }

    rec.onend = () => {
      // Chrome stops recognition after silence or tab backgrounding. Restart
      // for the life of this effect so captions continue for the whole class.
      if (stopped || recognitionRef.current !== rec) return
      try { rec.start() } catch { /* already running */ }
    }

    rec.onerror = e => {
      // Ignore routine errors (no-speech, aborted). onend will restart.
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        setSupported(false)
      }
    }

    try {
      rec.start()
      recognitionRef.current = rec
      setListening(true)
    } catch {
      setListening(false)
    }

    return () => {
      stopped = true
      recognitionRef.current = null
      try { rec.stop() } catch { /* ignore */ }
      setListening(false)
    }
  }, [enabled, localParticipant.identity, localParticipant.name])

  const clear = useCallback(() => {
    setFinals([])
    setInterims({})
  }, [])

  // Serialize finals for persistence. Sorted by timestamp so teacher +
  // student captions interleave correctly.
  const snapshot = useCallback(() => {
    const sorted = [...finals].sort((a, b) => a.timestamp - b.timestamp)
    return sorted
      .map(l => {
        const when = new Date(l.timestamp).toISOString()
        return `[${when}] ${l.name}: ${l.text.trim()}`
      })
      .join('\n')
  }, [finals])

  return { finals, interims, supported, listening, clear, snapshot }
}

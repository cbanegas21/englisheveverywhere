'use client'

import { useEffect, useRef, useState } from 'react'
import { extractLiveVocab, type CuadernoVocabItem } from '@/app/actions/video'
import type { TranscriptLine } from './useLiveTranscript'

export interface CuadernoEntry extends CuadernoVocabItem {
  id: string
  timestamp: number
}

interface Args {
  /** Booking id for this room — forwarded to extractLiveVocab so the server
   *  action can enforce participant-only access (anti cost-abuse). */
  bookingId: string
  /** Live transcript finals (in order, may be appended to). Stream from
   *  useLiveTranscript. The hook tracks which lines it has already sent. */
  finals: TranscriptLine[]
  /** UI language for translation target. 'es' (default) returns Spanish
   *  translations for the Spanish-speaking learner. */
  uiLang?: 'es' | 'en'
  /** How often to send a batch (ms). Default 30s. Lower = more chatty +
   *  costly, higher = staler cuaderno. */
  intervalMs?: number
  /** Disable extraction (e.g. while connecting). */
  enabled?: boolean
}

// useLiveVocab — accumulates teaching-worthy vocab items extracted from the
// running transcript. Runs a timer; every `intervalMs` it grabs the newest
// finals since the last batch, sends to extractLiveVocab(), and appends any
// returned items.
//
// Cost guardrails are in the server action: skips short chunks, missing key.
// Dedup is done client-side via lowercased word string so the same word
// from two consecutive batches doesn't double up.
export function useLiveVocab({
  bookingId,
  finals,
  uiLang = 'es',
  intervalMs = 30_000,
  enabled = true,
}: Args) {
  const [entries, setEntries] = useState<CuadernoEntry[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const cursorRef = useRef(0)
  const finalsRef = useRef(finals)
  finalsRef.current = finals
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function tick() {
      const cur = finalsRef.current
      if (cur.length <= cursorRef.current) return
      const chunk = cur.slice(cursorRef.current)
      cursorRef.current = cur.length
      const text = chunk.map((l) => `${l.name}: ${l.text}`).join('\n')
      if (text.trim().length < 60) return

      const known = entriesRef.current.map((e) => e.word.toLowerCase())
      setIsExtracting(true)
      try {
        const items = await extractLiveVocab(bookingId, text, { lang: uiLang, alreadyKnown: known })
        if (cancelled || items.length === 0) return
        const ts = Date.now()
        const fresh: CuadernoEntry[] = items
          .filter((it) => !entriesRef.current.some((e) => e.word.toLowerCase() === it.word.toLowerCase()))
          .map((it, i) => ({
            ...it,
            id: `${ts}-${i}`,
            timestamp: ts,
          }))
        if (fresh.length > 0) setEntries((prev) => [...prev, ...fresh])
      } catch {
        // Silent failure — vocab is best-effort enrichment, never blocks UX.
      } finally {
        if (!cancelled) setIsExtracting(false)
      }
    }

    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, intervalMs, uiLang, bookingId])

  return { entries, isExtracting }
}

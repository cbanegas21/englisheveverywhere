'use client'

import { useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n/translations'
import type { TranscriptLine } from '../hooks/useLiveTranscript'
import type { CuadernoEntry } from '../hooks/useLiveVocab'

interface Props {
  lang: Locale
  /** Live captions from useLiveTranscript. */
  finals: TranscriptLine[]
  interims: Record<string, TranscriptLine>
  supported: boolean
  listening: boolean
  /** Live vocab from useLiveVocab. */
  vocab: CuadernoEntry[]
  isExtractingVocab: boolean
  /** Toggle in the ControlBar to hide/show the cuaderno on smaller screens. */
  show: boolean
  /** Recognizer language toggle (es-ES / en-US). */
  recognizerLang: 'es-ES' | 'en-US'
  onChangeRecognizerLang: (lang: 'es-ES' | 'en-US') => void
}

type Tab = 'vocab' | 'transcript'

export function CuadernoPanel({
  lang,
  finals,
  interims,
  supported,
  listening,
  vocab,
  isExtractingVocab,
  show,
  recognizerLang,
  onChangeRecognizerLang,
}: Props) {
  const tx = lang === 'es' ? T.es : T.en
  const [tab, setTab] = useState<Tab>('vocab')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll transcript to bottom on new line
  useEffect(() => {
    if (tab !== 'transcript') return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [tab, finals.length])

  if (!show) return null

  const interimLines = Object.values(interims)
  const isJustNow = (ts: number) => Date.now() - ts < 60_000

  return (
    <aside
      style={{
        width: 360,
        flexShrink: 0,
        background: 'var(--ek-notebook-bg)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--ek-font-sans)',
        color: 'var(--ek-notebook-ink)',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '16px 20px',
          borderBottom: '1px dashed var(--ek-notebook-line)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ek-notebook-muted)',
              fontWeight: 700,
            }}
          >
            {tx.kicker}
          </div>
          {supported && listening && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--ek-font-mono)',
                fontSize: 10,
                color: 'var(--ek-red)',
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(196,30,58,0.08)',
                border: '1px solid rgba(196,30,58,0.20)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--ek-red)',
                  animation: 'pulse-dot 1.4s ease-in-out infinite',
                }}
              />
              {isExtractingVocab ? tx.extracting : tx.listening}
            </span>
          )}
        </div>

        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--ek-font-serif)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 24,
            color: 'var(--ek-notebook-ink)',
            letterSpacing: '-0.015em',
            lineHeight: 1.1,
          }}
        >
          {tab === 'vocab' ? tx.titleVocab(vocab.length) : tx.titleTranscript}
        </h3>

        {/* Recognizer language pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 9.5,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--ek-notebook-muted)',
            }}
          >
            {tx.recognizing}
          </span>
          <button
            onClick={() => onChangeRecognizerLang(recognizerLang === 'es-ES' ? 'en-US' : 'es-ES')}
            style={{
              fontFamily: 'var(--ek-font-mono)',
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 4,
              background: 'var(--ek-notebook-ink)',
              color: 'var(--ek-notebook-bg)',
              border: 0,
              cursor: 'pointer',
              letterSpacing: '0.08em',
            }}
          >
            {recognizerLang === 'es-ES' ? 'ES' : 'EN'} ⇄
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '0 20px',
          borderBottom: '1px solid var(--ek-notebook-line)',
          flexShrink: 0,
        }}
      >
        {([
          { key: 'vocab' as const, label: tx.tabVocab },
          { key: 'transcript' as const, label: tx.tabTranscript },
        ]).map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 4px',
                background: 'transparent',
                border: 0,
                fontSize: 12,
                fontWeight: 700,
                color: active ? 'var(--ek-red)' : 'var(--ek-notebook-muted)',
                borderBottom: active ? '2px solid var(--ek-red)' : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--ek-font-sans)',
                letterSpacing: '0.02em',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 20px 20px',
          // Subtle red margin line + binding holes like the dashboard cuaderno
          position: 'relative',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 38,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'rgba(196,30,58,0.20)',
            pointerEvents: 'none',
          }}
        />

        {tab === 'vocab' && (
          <>
            {!supported && (
              <p
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: 32,
                  color: 'var(--ek-notebook-muted)',
                  paddingLeft: 30,
                  lineHeight: 1.5,
                }}
              >
                {tx.unsupported}
              </p>
            )}
            {supported && vocab.length === 0 && (
              <p
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: 32,
                  color: 'var(--ek-notebook-muted)',
                  paddingLeft: 30,
                  lineHeight: 1.5,
                  fontFamily: 'var(--ek-font-serif)',
                  fontStyle: 'italic',
                }}
              >
                {tx.vocabEmpty}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingLeft: 30 }}>
              {[...vocab].reverse().map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    paddingBottom: 12,
                    borderBottom: '1px dashed var(--ek-notebook-dash)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span
                      style={{
                        fontFamily: 'var(--ek-font-serif)',
                        fontSize: 18,
                        fontWeight: 400,
                        color: 'var(--ek-notebook-ink)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {entry.word}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--ek-font-mono)',
                        fontSize: 9,
                        color: isJustNow(entry.timestamp)
                          ? 'var(--ek-red)'
                          : 'var(--ek-notebook-faint)',
                        fontWeight: isJustNow(entry.timestamp) ? 700 : 500,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isJustNow(entry.timestamp)
                        ? tx.justNow
                        : new Date(entry.timestamp).toLocaleTimeString(
                            lang === 'es' ? 'es-HN' : 'en-US',
                            { hour: '2-digit', minute: '2-digit' }
                          )}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--ek-notebook-soft)',
                      marginTop: 3,
                    }}
                  >
                    {entry.translation}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--ek-font-serif)',
                      fontStyle: 'italic',
                      fontSize: 12.5,
                      color: 'var(--ek-notebook-muted)',
                      marginTop: 5,
                      lineHeight: 1.45,
                    }}
                  >
                    &ldquo;{entry.example}&rdquo;
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'transcript' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 30 }}>
            {!supported ? (
              <p
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: 32,
                  color: 'var(--ek-notebook-muted)',
                }}
              >
                {tx.unsupported}
              </p>
            ) : finals.length === 0 && interimLines.length === 0 ? (
              <p
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: 32,
                  color: 'var(--ek-notebook-muted)',
                  fontFamily: 'var(--ek-font-serif)',
                  fontStyle: 'italic',
                }}
              >
                {tx.transcriptEmpty}
              </p>
            ) : (
              <>
                {finals.map((line) => (
                  <TranscriptRow key={line.id} line={line} lang={lang} isFinal />
                ))}
                {interimLines.map((line) => (
                  <TranscriptRow key={`interim-${line.identity}`} line={line} lang={lang} isFinal={false} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer
        style={{
          padding: '12px 20px',
          borderTop: '1px dashed var(--ek-notebook-line)',
          fontSize: 11,
          fontFamily: 'var(--ek-font-serif)',
          fontStyle: 'italic',
          color: 'var(--ek-notebook-soft)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {tx.footer}
      </footer>
    </aside>
  )
}

function TranscriptRow({
  line,
  lang,
  isFinal,
}: {
  line: TranscriptLine
  lang: Locale
  isFinal: boolean
}) {
  const time = new Date(line.timestamp).toLocaleTimeString(
    lang === 'es' ? 'es-HN' : 'en-US',
    { hour: '2-digit', minute: '2-digit' }
  )
  return (
    <div style={{ opacity: isFinal ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--ek-red)',
            fontFamily: 'var(--ek-font-mono)',
            letterSpacing: '0.04em',
          }}
        >
          {line.name}
        </span>
        <span
          style={{
            fontFamily: 'var(--ek-font-mono)',
            fontSize: 9.5,
            color: 'var(--ek-notebook-faint)',
          }}
        >
          {time}
        </span>
      </div>
      <p
        style={{
          margin: '2px 0 0',
          fontSize: 13,
          lineHeight: 1.45,
          color: isFinal ? 'var(--ek-notebook-ink)' : 'var(--ek-notebook-muted)',
          fontStyle: isFinal ? 'normal' : 'italic',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {line.text}
      </p>
    </div>
  )
}

const T = {
  en: {
    kicker: '↳ EK listening',
    listening: 'live',
    extracting: 'extracting',
    recognizing: 'recognizing',
    titleVocab: (n: number) => `${n} ${n === 1 ? 'word' : 'words'} today`,
    titleTranscript: 'Transcript',
    tabVocab: 'Vocabulary',
    tabTranscript: 'Transcript',
    vocabEmpty: 'New words will appear here as you speak.',
    transcriptEmpty: 'Captions will appear here as the class continues.',
    unsupported:
      "Live captions don't work in this browser. Use Chrome or Edge to enable the cuaderno.",
    justNow: 'just now',
    footer: 'Saved automatically when the class ends.',
  },
  es: {
    kicker: '↳ EK escuchando',
    listening: 'en vivo',
    extracting: 'extrayendo',
    recognizing: 'reconociendo',
    titleVocab: (n: number) => `${n} ${n === 1 ? 'palabra' : 'palabras'} hoy`,
    titleTranscript: 'Transcripción',
    tabVocab: 'Vocabulario',
    tabTranscript: 'Transcripción',
    vocabEmpty: 'Las palabras nuevas aparecerán aquí mientras hablan.',
    transcriptEmpty: 'Las frases aparecerán aquí mientras avanza la clase.',
    unsupported:
      'Los subtítulos en vivo no funcionan en este navegador. Usa Chrome o Edge para activar el cuaderno.',
    justNow: 'justo ahora',
    footer: 'Se guarda automáticamente al terminar la clase.',
  },
} as const

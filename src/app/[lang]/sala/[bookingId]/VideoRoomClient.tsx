'use client'

import { useEffect, useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useLocalParticipant,
  RoomAudioRenderer,
  useRoomContext,
  useConnectionState,
  isTrackReference,
} from '@livekit/components-react'
import type { TrackReference } from '@livekit/components-react'
import { Track, ConnectionState } from 'livekit-client'
import type { Dispatch, SetStateAction } from 'react'
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Clock,
  CheckCircle2, AlertCircle, FileText, X, Sparkles, ChevronRight, LogOut,
} from 'lucide-react'
import { getRoomAccess, completeSession, saveSessionNotes } from '@/app/actions/video'
import type { SessionSummary } from '@/app/actions/video'
import type { Locale } from '@/lib/i18n/translations'

interface Props {
  lang: Locale
  bookingId: string
  scheduledAt: string
  durationMinutes: number
  isTeacher: boolean
  myName: string
  otherName: string
  status: string
}

interface RoomData {
  url: string
  token: string
  sessionId: string
  isDevMode: boolean
}

const t = {
  en: {
    connecting: 'Connecting to your session...',
    joining: 'Joining room...',
    waitingOther: 'Waiting for the other participant...',
    sessionWith: 'Session with',
    timeRemaining: 'remaining',
    mute: 'Mute', unmute: 'Unmute',
    stopVideo: 'Stop video', startVideo: 'Start video',
    endClass: 'End Class', leave: 'Leave', endingSession: 'Ending...',
    sessionEnded: 'Class Complete',
    sessionEndedSub: 'Great work! Your session has been recorded.',
    studentEndedSub: 'The session has ended. Check your classes for the summary.',
    returnDashboard: 'Return to dashboard',
    devMode: 'Development mode — LiveKit credentials not configured',
    errorTitle: 'Could not connect', retry: 'Retry',
    you: 'You', teacher: 'Teacher', student: 'Student',
    notes: 'Class Notes',
    notesPlaceholder: 'Type your class notes here...\n\nTip: Note topics covered, vocabulary introduced, corrections made, and areas to focus on next.',
    notesHint: 'Notes are auto-saved and shared with the student after class.',
    saved: 'Saved', saving: 'Saving...',
    aiSummary: 'AI Class Summary',
    generatingSummary: 'Generating class summary with AI...',
    covered: 'Topics Covered',
    nextTopics: 'Next Session Suggestions',
    progressNote: 'Progress Note',
    noSummary: 'Summary not available for this session.',
  },
  es: {
    connecting: 'Conectando a tu sesión...',
    joining: 'Entrando a la sala...',
    waitingOther: 'Esperando al otro participante...',
    sessionWith: 'Sesión con',
    timeRemaining: 'restante',
    mute: 'Silenciar', unmute: 'Activar mic',
    stopVideo: 'Detener video', startVideo: 'Iniciar video',
    endClass: 'Terminar Clase', leave: 'Salir', endingSession: 'Terminando...',
    sessionEnded: 'Clase Completada',
    sessionEndedSub: '¡Buen trabajo! Tu sesión ha sido registrada.',
    studentEndedSub: 'La sesión ha terminado. Revisa tus clases para ver el resumen.',
    returnDashboard: 'Volver al inicio',
    devMode: 'Modo desarrollo — credenciales de LiveKit no configuradas',
    errorTitle: 'No se pudo conectar', retry: 'Reintentar',
    you: 'Tú', teacher: 'Maestro', student: 'Estudiante',
    notes: 'Notas de Clase',
    notesPlaceholder: 'Escribe tus notas de clase aquí...\n\nConsejo: Anota temas cubiertos, vocabulario introducido, correcciones y áreas a trabajar la próxima sesión.',
    notesHint: 'Las notas se guardan automáticamente y se comparten con el estudiante al finalizar.',
    saved: 'Guardado', saving: 'Guardando...',
    aiSummary: 'Resumen IA de la Clase',
    generatingSummary: 'Generando resumen con IA...',
    covered: 'Temas Cubiertos',
    nextTopics: 'Sugerencias para la Próxima Sesión',
    progressNote: 'Nota de Progreso',
    noSummary: 'Resumen no disponible para esta sesión.',
  },
}

function useTimer(scheduledAt: string, durationMinutes: number) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    const endTime = new Date(scheduledAt).getTime() + durationMinutes * 60 * 1000
    const update = () => setTimeLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [scheduledAt, durationMinutes])

  if (timeLeft === null) return null
  const m = Math.floor(timeLeft / 60)
  const s = timeLeft % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Inner component — must be inside <LiveKitRoom> ───────────────────────────

interface RoomContentProps {
  lang: Locale
  isTeacher: boolean
  myName: string
  otherName: string
  bookingId: string
  sessionId: string
  showNotes: boolean
  setShowNotes: Dispatch<SetStateAction<boolean>>
  onComplete: (summary?: SessionSummary) => void
}

function RoomContent({
  lang, isTeacher, myName, otherName,
  bookingId, sessionId,
  showNotes, setShowNotes, onComplete,
}: RoomContentProps) {
  const tx = t[lang]
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const connectionState = useConnectionState()
  const [isPending, startTransition] = useTransition()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(true)

  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  )

  const remoteTrack = cameraTracks.find(t => !t.participant.isLocal && isTrackReference(t)) as TrackReference | undefined
  const localTrack = cameraTracks.find(t => t.participant.isLocal && isTrackReference(t)) as TrackReference | undefined

  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current)
  }, [])

  function toggleMute() {
    localParticipant.setMicrophoneEnabled(isMuted)
    setIsMuted(p => !p)
  }

  function toggleCamera() {
    localParticipant.setCameraEnabled(isCameraOff)
    setIsCameraOff(p => !p)
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesSaved(false)
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      await saveSessionNotes(sessionId, value)
      setNotesSaved(true)
    }, 1500)
  }

  function handleLeave() {
    room.disconnect()
    onComplete()
  }

  function handleEndClass() {
    room.disconnect()
    startTransition(async () => {
      const result = await completeSession(bookingId, sessionId, lang)
      onComplete('summary' in result ? result.summary : undefined)
    })
  }

  // Connection loading overlay
  if (connectionState !== ConnectionState.Connected) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A1628] z-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0FA989] to-[#0CC495] shadow-2xl shadow-[#0FA989]/25 mb-4">
          <span className="h-8 w-8 rounded-full border-4 border-white/30 border-t-white animate-spin" />
        </div>
        <p className="text-white/70 text-sm">{tx.joining}</p>
      </div>
    )
  }

  return (
    <>
      {/* Video tiles */}
      <div className="absolute inset-0">
        {/* Remote — full screen */}
        <div className="absolute inset-0 bg-[#0A1628]">
          {remoteTrack ? (
            <VideoTrack
              trackRef={remoteTrack}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A84C] to-[#E8CC80] text-[#0A1628] font-black text-2xl mb-3">
                {otherName[0]}
              </div>
              <p className="text-white/40 text-sm">{tx.waitingOther}</p>
            </div>
          )}
        </div>

        {/* Local — picture-in-picture corner */}
        <div className="absolute bottom-4 right-4 w-36 h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl z-10">
          {localTrack ? (
            <VideoTrack
              trackRef={localTrack}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#0A1628] flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#0FA989] to-[#0CC495] text-white font-black text-sm">
                {myName[0]}
              </div>
            </div>
          )}
          {isCameraOff && (
            <div className="absolute inset-0 bg-[#0A1628] flex items-center justify-center">
              <VideoOff className="h-5 w-5 text-white/30" />
            </div>
          )}
        </div>
      </div>

      {/* Notes panel (teacher only) */}
      <AnimatePresence>
        {isTeacher && showNotes && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="fixed right-0 top-0 h-full w-80 z-30 flex flex-col"
            style={{ background: 'rgba(10,22,40,0.97)', backdropFilter: 'blur(12px)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0FA989]" />
                <span className="text-[13px] font-bold text-white">{tx.notes}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px]" style={{ color: notesSaved ? '#0FA989' : 'rgba(255,255,255,0.3)' }}>
                  {notesSaved ? tx.saved : tx.saving}
                </span>
                <button onClick={() => setShowNotes(false)} className="text-white/30 hover:text-white/70 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder={tx.notesPlaceholder}
              className="flex-1 resize-none bg-transparent px-5 py-4 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none leading-relaxed"
            />
            <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-white/25 leading-relaxed">{tx.notesHint}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 py-5 bg-black/60 backdrop-blur-sm border-t border-white/5 z-20">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={toggleMute}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          <span className="text-[9px] font-medium">{isMuted ? tx.unmute : tx.mute}</span>
        </motion.button>

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={toggleCamera}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${isCameraOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          <span className="text-[9px] font-medium">{isCameraOff ? tx.startVideo : tx.stopVideo}</span>
        </motion.button>

        {isTeacher && (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotes(p => !p)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${showNotes ? 'bg-[#0FA989]/20 text-[#0FA989] border border-[#0FA989]/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <FileText className="h-5 w-5" />
            <span className="text-[9px] font-medium">{tx.notes}</span>
          </motion.button>
        )}

        {isTeacher ? (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleEndClass} disabled={isPending}
            className="flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-60"
          >
            {isPending ? <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <PhoneOff className="h-5 w-5" />}
            <span className="text-[9px] font-medium">{isPending ? tx.endingSession : tx.endClass}</span>
          </motion.button>
        ) : (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleLeave}
            className="flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-[9px] font-medium">{tx.leave}</span>
          </motion.button>
        )}
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VideoRoomClient({
  lang, bookingId, scheduledAt, durationMinutes,
  isTeacher, myName, otherName, status,
}: Props) {
  const tx = t[lang]
  const router = useRouter()
  const [isPendingDev, startDevTransition] = useTransition()

  const [phase, setPhase] = useState<'init' | 'room' | 'dev' | 'ended' | 'error'>('init')
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [summaryData, setSummaryData] = useState<SessionSummary | null>(null)
  const [showNotes, setShowNotes] = useState(false)

  // Dev-mode state (no LiveKit context available)
  const [devIsMuted, setDevIsMuted] = useState(false)
  const [devIsCameraOff, setDevIsCameraOff] = useState(false)

  const timeRemaining = useTimer(scheduledAt, durationMinutes)
  const dashboardPath = isTeacher ? `/${lang}/maestro/dashboard` : `/${lang}/dashboard`

  const init = useCallback(async () => {
    setPhase('init')
    setErrorMsg(null)
    const result = await getRoomAccess(bookingId)
    if ('error' in result) {
      setErrorMsg(result.error)
      setPhase('error')
      return
    }
    setRoomData(result)
    setPhase(result.isDevMode ? 'dev' : 'room')
  }, [bookingId])

  useEffect(() => { init() }, [init])

  function handleComplete(summary?: SessionSummary) {
    if (summary) setSummaryData(summary)
    setPhase('ended')
  }

  function handleDevEndClass() {
    startDevTransition(async () => {
      const result = await completeSession(bookingId, roomData?.sessionId || null, lang)
      handleComplete('summary' in result ? result.summary : undefined)
    })
  }

  // ── Completion screen ──────────────────────────────────────────────────────
  if (status === 'completed' || phase === 'ended') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="max-w-lg w-full bg-white rounded-3xl p-8 shadow-2xl"
        >
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
              className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0FA989] to-[#0CC495] shadow-2xl shadow-[#0FA989]/25 mx-auto mb-5"
            >
              <CheckCircle2 className="h-10 w-10 text-white" />
            </motion.div>
            <h2 className="text-2xl font-black text-[#0A1628] mb-1">{tx.sessionEnded}</h2>
            <p className="text-sm text-[#0A1628]/50">
              {isTeacher ? tx.sessionEndedSub : tx.studentEndedSub}
            </p>
          </div>

          {isTeacher && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-[#0FA989]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#0A1628]/40">{tx.aiSummary}</span>
              </div>

              {isPendingDev && !summaryData ? (
                <div className="flex items-center gap-3 rounded-xl bg-[#0A1628]/5 p-4">
                  <span className="h-5 w-5 rounded-full border-2 border-[#0FA989]/30 border-t-[#0FA989] animate-spin flex-shrink-0" />
                  <p className="text-sm text-[#0A1628]/50">{tx.generatingSummary}</p>
                </div>
              ) : summaryData ? (
                <div className="space-y-4">
                  {summaryData.covered.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#0A1628]/40 mb-2">{tx.covered}</p>
                      <ul className="space-y-1.5">
                        {summaryData.covered.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#0A1628]/80">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#0FA989] flex-shrink-0" />{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {summaryData.nextTopics.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#0A1628]/40 mb-2">{tx.nextTopics}</p>
                      <ul className="space-y-1.5">
                        {summaryData.nextTopics.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#0A1628]/80">
                            <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-[#C9A84C] flex-shrink-0" />{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {summaryData.progressNote && (
                    <div className="rounded-xl bg-[#0A1628]/5 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#0A1628]/40 mb-1.5">{tx.progressNote}</p>
                      <p className="text-sm text-[#0A1628]/70 leading-relaxed">{summaryData.progressNote}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-[#0A1628]/5 p-4 text-center">
                  <p className="text-sm text-[#0A1628]/40">{tx.noSummary}</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => router.push(dashboardPath)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0FA989] to-[#0CC495] text-white font-bold shadow-lg shadow-[#0FA989]/25 hover:shadow-xl transition-all"
          >
            {tx.returnDashboard}
          </button>
        </motion.div>
      </div>
    )
  }

  // ── Main room layout ───────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-[#0A1628]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/30 backdrop-blur-sm border-b border-white/5 z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0FA989] to-[#0CC495] shadow-md shadow-[#0FA989]/30">
            <span className="text-[10px] font-black text-white">EE</span>
          </div>
          <div>
            <div className="text-xs font-bold text-white">{tx.sessionWith} {otherName}</div>
            <div className="text-[10px] text-white/40">{isTeacher ? tx.teacher : tx.student}: {myName}</div>
          </div>
        </div>

        {timeRemaining && (
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-[#0FA989]" />
            <span className="text-sm font-mono font-bold text-white">{timeRemaining}</span>
            <span className="text-[10px] text-white/40">{tx.timeRemaining}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-white/40 text-xs">
          <Users className="h-3.5 w-3.5" />
          <span>2</span>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 relative">

        {/* Loading */}
        {phase === 'init' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A1628]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0FA989] to-[#0CC495] shadow-2xl shadow-[#0FA989]/25 mb-4">
              <span className="h-8 w-8 rounded-full border-4 border-white/30 border-t-white animate-spin" />
            </div>
            <p className="text-white/70 text-sm">{tx.connecting}</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A1628]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 mb-4">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <p className="text-white font-bold mb-2">{tx.errorTitle}</p>
            <p className="text-white/40 text-xs mb-6 text-center max-w-xs px-4">{errorMsg}</p>
            <button onClick={init} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0FA989] to-[#0CC495] text-white font-bold text-sm">
              {tx.retry}
            </button>
          </div>
        )}

        {/* Dev mode */}
        {phase === 'dev' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0A1628] to-[#0A1628]/80">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md px-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0FA989] to-[#0CC495] shadow-2xl shadow-[#0FA989]/25 mx-auto mb-6">
                <Video className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{tx.sessionWith} {otherName}</h2>
              <p className="text-white/50 text-sm mb-2">{tx.waitingOther}</p>
              <div className="flex items-center justify-center gap-2 mb-6">
                <AlertCircle className="h-4 w-4 text-[#C9A84C]" />
                <p className="text-[#C9A84C] text-xs font-medium">{tx.devMode}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                <div className="aspect-video bg-white/5 rounded-xl flex flex-col items-center justify-center border border-white/10">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#0FA989] to-[#0CC495] text-white font-black text-sm mb-1">{myName[0]}</div>
                  <span className="text-white/50 text-[10px]">{tx.you}</span>
                </div>
                <div className="aspect-video bg-white/5 rounded-xl flex flex-col items-center justify-center border border-white/10">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A84C] to-[#E8CC80] text-[#0A1628] font-black text-sm mb-1">{otherName[0]}</div>
                  <span className="text-white/50 text-[10px]">{otherName}</span>
                </div>
              </div>
            </motion.div>

            {/* Dev notes panel */}
            <AnimatePresence>
              {isTeacher && showNotes && roomData && (
                <motion.div
                  initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                  className="fixed right-0 top-0 h-full w-80 z-30 flex flex-col"
                  style={{ background: 'rgba(10,22,40,0.97)', backdropFilter: 'blur(12px)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#0FA989]" />
                      <span className="text-[13px] font-bold text-white">{tx.notes}</span>
                    </div>
                    <button onClick={() => setShowNotes(false)} className="text-white/30 hover:text-white/70 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    placeholder={tx.notesPlaceholder}
                    className="flex-1 resize-none bg-transparent px-5 py-4 text-[13px] text-white/80 placeholder:text-white/20 focus:outline-none leading-relaxed"
                  />
                  <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] text-white/25 leading-relaxed">{tx.notesHint}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Live room */}
        {phase === 'room' && roomData && (
          <LiveKitRoom
            serverUrl={roomData.url}
            token={roomData.token}
            connect={true}
            audio={true}
            video={true}
            className="absolute inset-0"
            onDisconnected={() => { if (!isTeacher) setPhase('ended') }}
          >
            <RoomAudioRenderer />
            <RoomContent
              lang={lang}
              isTeacher={isTeacher}
              myName={myName}
              otherName={otherName}
              bookingId={bookingId}
              sessionId={roomData.sessionId}
              showNotes={showNotes}
              setShowNotes={setShowNotes}
              onComplete={handleComplete}
            />
          </LiveKitRoom>
        )}
      </div>

      {/* Dev mode controls (outside LiveKitRoom context) */}
      {phase === 'dev' && (
        <div className="flex items-center justify-center gap-4 py-5 bg-black/40 backdrop-blur-sm border-t border-white/5">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setDevIsMuted(p => !p)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${devIsMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {devIsMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            <span className="text-[9px] font-medium">{devIsMuted ? tx.unmute : tx.mute}</span>
          </motion.button>

          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setDevIsCameraOff(p => !p)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${devIsCameraOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {devIsCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            <span className="text-[9px] font-medium">{devIsCameraOff ? tx.startVideo : tx.stopVideo}</span>
          </motion.button>

          {isTeacher && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowNotes(p => !p)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${showNotes ? 'bg-[#0FA989]/20 text-[#0FA989] border border-[#0FA989]/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              <FileText className="h-5 w-5" />
              <span className="text-[9px] font-medium">{tx.notes}</span>
            </motion.button>
          )}

          {isTeacher ? (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleDevEndClass} disabled={isPendingDev}
              className="flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-60"
            >
              {isPendingDev ? <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <PhoneOff className="h-5 w-5" />}
              <span className="text-[9px] font-medium">{isPendingDev ? tx.endingSession : tx.endClass}</span>
            </motion.button>
          ) : (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setPhase('ended')}
              className="flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-[9px] font-medium">{tx.leave}</span>
            </motion.button>
          )}
        </div>
      )}
    </div>
  )
}

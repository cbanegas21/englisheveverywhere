import type { Locale } from '@/lib/i18n/translations'

type Strings = {
  connecting: string; joining: string; reconnecting: string; leaving: string
  waitingOther: string; sessionWith: string; timeRemaining: string
  lobbyTitle: string; lobbyStartsIn: string; lobbyEnterNow: string; lobbyHint: string; lobbyLive: string
  mute: string; unmute: string; stopVideo: string; startVideo: string
  endClass: string; leave: string; endingSession: string
  sessionEnded: string; sessionEndedSub: string; studentEndedSub: string; returnDashboard: string
  devMode: string; errorTitle: string; retry: string
  you: string; teacher: string; student: string
  notes: string; notesPlaceholder: string; notesHint: string; saved: string; saving: string
  aiSummary: string; generatingSummary: string; covered: string; nextTopics: string; progressNote: string; noSummary: string
  layoutSpeaker: string; layoutGrid: string; hideSelf: string; showSelf: string
}

export const VIDEO_T: Record<Locale, Strings> = {
  en: {
    connecting: 'Connecting to your session...',
    joining: 'Joining room...',
    reconnecting: 'Reconnecting...',
    leaving: 'Ending class...',
    waitingOther: 'Waiting for the other participant...',
    sessionWith: 'Session with',
    timeRemaining: 'remaining',

    lobbyTitle: 'Your session is ready',
    lobbyStartsIn: 'Starts in',
    lobbyEnterNow: 'Enter call now',
    lobbyHint: "You can enter early. We'll notify the other party when they join.",
    lobbyLive: 'Your session is live — join now',

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
    notesPlaceholder:
      'Type your class notes here...\n\nTip: Note topics covered, vocabulary introduced, corrections made, and areas to focus on next.',
    notesHint: 'Notes are auto-saved and shared with the student after class.',
    saved: 'Saved', saving: 'Saving...',

    aiSummary: 'AI Class Summary',
    generatingSummary: 'Generating class summary with AI...',
    covered: 'Topics Covered',
    nextTopics: 'Next Session Suggestions',
    progressNote: 'Progress Note',
    noSummary: 'Summary not available for this session.',

    layoutSpeaker: 'Speaker view', layoutGrid: 'Side by side',
    hideSelf: 'Hide self', showSelf: 'Show self',
  },
  es: {
    connecting: 'Conectando a tu sesión...',
    joining: 'Entrando a la sala...',
    reconnecting: 'Reconectando...',
    leaving: 'Finalizando clase...',
    waitingOther: 'Esperando al otro participante...',
    sessionWith: 'Sesión con',
    timeRemaining: 'restante',

    lobbyTitle: 'Tu sesión está lista',
    lobbyStartsIn: 'Empieza en',
    lobbyEnterNow: 'Entrar ahora',
    lobbyHint: 'Puedes entrar antes. Se notificará al otro participante cuando ingrese.',
    lobbyLive: 'Tu sesión está en vivo — entra ahora',

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
    notesPlaceholder:
      'Escribe tus notas de clase aquí...\n\nConsejo: Anota temas cubiertos, vocabulario introducido, correcciones y áreas a trabajar la próxima sesión.',
    notesHint: 'Las notas se guardan automáticamente y se comparten con el estudiante al finalizar.',
    saved: 'Guardado', saving: 'Guardando...',

    aiSummary: 'Resumen IA de la Clase',
    generatingSummary: 'Generando resumen con IA...',
    covered: 'Temas Cubiertos',
    nextTopics: 'Sugerencias para la Próxima Sesión',
    progressNote: 'Nota de Progreso',
    noSummary: 'Resumen no disponible para esta sesión.',

    layoutSpeaker: 'Vista presentador', layoutGrid: 'Lado a lado',
    hideSelf: 'Ocultar mi video', showSelf: 'Mostrar mi video',
  },
}

export type VideoStrings = Strings

export function videoStrings(lang: Locale): VideoStrings {
  return VIDEO_T[lang]
}

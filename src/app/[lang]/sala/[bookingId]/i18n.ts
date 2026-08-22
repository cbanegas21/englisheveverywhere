import type { Locale } from '@/lib/i18n/translations'

// Stable error codes returned by getRoomAccess (actions/video.ts). Kept in sync
// with the RoomAccessError union there. `errorFallback` covers any unmapped or
// connection-layer error so the Spanish UI never falls back to raw English prose.
export type RoomErrorCode =
  | 'not-authenticated'
  | 'not-found'
  | 'not-authorized'
  | 'cancelled'
  | 'completed'
  | 'invalid-time'
  | 'expired'
  | 'init-failed'
  | 'token-failed'
  | 'connection'
  // Not from getRoomAccess: raised client-side when LiveKit evicts this tab
  // because the same identity joined elsewhere (DisconnectReason.DUPLICATE_IDENTITY).
  | 'duplicate'

type ErrorMessages = Record<RoomErrorCode, string> & { errorFallback: string }

type Strings = {
  connecting: string; joining: string; reconnecting: string; leaving: string
  waitingOther: string; sessionWith: string; timeRemaining: string
  lobbyTitle: string; lobbyStartsIn: string; lobbyEnterNow: string; lobbyHint: string; lobbyLive: string
  mute: string; unmute: string; stopVideo: string; startVideo: string
  endClass: string; leave: string; endingSession: string
  leaveConfirmTitle: string; leaveConfirmYes: string; leaveConfirmNo: string
  sessionEnded: string; sessionEndedSub: string; studentEndedSub: string; returnDashboard: string
  devMode: string; errorTitle: string; retry: string
  you: string; teacher: string; student: string; close: string
  notes: string; notesPlaceholder: string; notesHint: string; saved: string; saving: string
  aiSummary: string; generatingSummary: string; covered: string; nextTopics: string; progressNote: string; noSummary: string
  layoutSpeaker: string; layoutGrid: string; hideSelf: string; showSelf: string; shrinkSelf: string; enlargeSelf: string; hideTheirs: string; showTheirs: string
  reactions: string; raiseHand: string; lowerHand: string; more: string
  chat: string; chatTitle: string; chatClose: string; chatEmpty: string; chatPlaceholder: string; chatSend: string
  shareScreen: string; stopSharing: string; sharingPrefix: string; sharingSuffix: string; youSharing: string
  shareScreenTitle: string; shareAudioLabel: string; shareAudioDesc: string
  shareOptimize: string; shareOptimizeSlides: string; shareOptimizeMotion: string
  sharePickerTip: string; shareStart: string; shareCancel: string
  shareAudioBadge: string; shareAudioBadgeTitle: string; shareNoAudioWarning: string; shareError: string
  deviceSettings: string; microphone: string; camera: string; speaker: string; noDevices: string
  whiteboard: string; whiteboardTitle: string; whiteboardClose: string; whiteboardLoading: string
  whiteboardZoomIn: string; whiteboardZoomOut: string; whiteboardRecenter: string
  whiteboardPen: string; whiteboardEraser: string; whiteboardClear: string
  transcript: string; transcriptTitle: string; transcriptClose: string; transcriptEmpty: string; transcriptUnsupported: string; transcriptListening: string
  errorMessages: ErrorMessages
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
    leaveConfirmTitle: 'Leave class?', leaveConfirmYes: 'Leave', leaveConfirmNo: 'Stay',

    sessionEnded: 'Class Complete',
    sessionEndedSub: 'Great work! Your session summary is on the way.',
    studentEndedSub: 'The session has ended. Check your classes for the summary.',
    returnDashboard: 'Return to dashboard',

    devMode: 'Development mode — LiveKit credentials not configured',
    errorTitle: 'Could not connect', retry: 'Retry',

    you: 'You', teacher: 'Teacher', student: 'Student', close: 'Close',

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
    hideSelf: 'Hide self', showSelf: 'Show self', shrinkSelf: 'Smaller', enlargeSelf: 'Bigger', hideTheirs: 'Hide their camera', showTheirs: 'Show their camera',
    reactions: 'Reactions', raiseHand: 'Raise hand', lowerHand: 'Lower hand', more: 'More',

    chat: 'Chat', chatTitle: 'Class chat', chatClose: 'Close chat',
    chatEmpty: 'No messages yet. Say hi!',
    chatPlaceholder: 'Message…',
    chatSend: 'Send',

    shareScreen: 'Share screen', stopSharing: 'Stop sharing',
    sharingPrefix: '', sharingSuffix: 'is sharing their screen',
    youSharing: "You're sharing your screen",
    shareScreenTitle: 'Share your screen',
    shareAudioLabel: 'Share audio',
    shareAudioDesc: 'Sound from your computer — a video, PowerPoint, or song',
    shareOptimize: 'Optimize for',
    shareOptimizeSlides: 'Slides & text',
    shareOptimizeMotion: 'Video & motion',
    sharePickerTip: 'In the next pop-up, choose Entire Screen and tick “Also share system audio” to share your slides’ sound.',
    shareStart: 'Start sharing',
    shareCancel: 'Cancel',
    shareAudioBadge: 'Audio',
    shareAudioBadgeTitle: 'Computer sound is being shared',
    shareNoAudioWarning: 'No sound was shared. To include audio, stop and share again, then pick your Entire Screen (or a browser tab) and turn on “share audio” in the pop-up. Note: Safari and Firefox can’t share computer sound.',
    shareError: "We couldn't start screen sharing. Please try again.",

    deviceSettings: 'Audio & video settings',
    microphone: 'Microphone', camera: 'Camera', speaker: 'Speaker',
    noDevices: 'No devices found.',

    whiteboard: 'Whiteboard',
    whiteboardTitle: 'Shared whiteboard',
    whiteboardClose: 'Close whiteboard',
    whiteboardLoading: 'Loading…',
    whiteboardZoomIn: 'Zoom in',
    whiteboardZoomOut: 'Zoom out',
    whiteboardRecenter: 'Fit to content',
    whiteboardPen: 'Pen',
    whiteboardEraser: 'Eraser',
    whiteboardClear: 'Clear board',

    transcript: 'Transcript',
    transcriptTitle: 'Live transcript',
    transcriptClose: 'Close transcript',
    transcriptEmpty: 'No speech detected yet. Start talking to see captions.',
    transcriptUnsupported: "Live transcript doesn't work in this browser. Use Chrome or Edge.",
    transcriptListening: 'Listening…',

    errorMessages: {
      'not-authenticated': 'Please sign in to join this class.',
      'not-found': "We couldn't find this session.",
      'not-authorized': "You don't have access to this session.",
      'cancelled': 'This session has been cancelled.',
      'completed': 'This session has already ended.',
      'invalid-time': 'This session has an invalid scheduled time. Contact support.',
      'expired': 'This session has expired and can no longer be joined.',
      'init-failed': "We couldn't start the session. Please try again.",
      'token-failed': "We couldn't connect you to the room. Please try again.",
      'connection': 'Your connection to the class dropped. Check your internet and rejoin.',
      'duplicate': 'You opened this class in another tab or on another device. Close the other one, then press Rejoin to use the class here.',
      errorFallback: "We couldn't connect to your session. Please try again.",
    },
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
    leaveConfirmTitle: '¿Salir de la clase?', leaveConfirmYes: 'Salir', leaveConfirmNo: 'Quedarme',

    sessionEnded: 'Clase Completada',
    sessionEndedSub: '¡Buen trabajo! El resumen de tu sesión estará listo pronto.',
    studentEndedSub: 'La sesión ha terminado. Revisa tus clases para ver el resumen.',
    returnDashboard: 'Volver al inicio',

    devMode: 'Modo desarrollo — credenciales de LiveKit no configuradas',
    errorTitle: 'No se pudo conectar', retry: 'Reintentar',

    you: 'Tú', teacher: 'Maestro', student: 'Estudiante', close: 'Cerrar',

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
    hideSelf: 'Ocultar mi video', showSelf: 'Mostrar mi video', shrinkSelf: 'Más pequeño', enlargeSelf: 'Más grande', hideTheirs: 'Ocultar su cámara', showTheirs: 'Mostrar su cámara',
    reactions: 'Reacciones', raiseHand: 'Levantar la mano', lowerHand: 'Bajar la mano', more: 'Más',

    chat: 'Chat', chatTitle: 'Chat del aula', chatClose: 'Cerrar chat',
    chatEmpty: 'Aún no hay mensajes. ¡Saluda!',
    chatPlaceholder: 'Mensaje…',
    chatSend: 'Enviar',

    shareScreen: 'Compartir pantalla', stopSharing: 'Dejar de compartir',
    sharingPrefix: '', sharingSuffix: 'está compartiendo la pantalla',
    youSharing: 'Estás compartiendo tu pantalla',
    shareScreenTitle: 'Compartir tu pantalla',
    shareAudioLabel: 'Compartir audio',
    shareAudioDesc: 'El sonido de tu computadora — un video, PowerPoint o canción',
    shareOptimize: 'Optimizar para',
    shareOptimizeSlides: 'Diapositivas y texto',
    shareOptimizeMotion: 'Video y movimiento',
    sharePickerTip: 'En la ventana que aparece, elige Toda la pantalla y marca «Compartir también el audio del sistema» para compartir el sonido de tus diapositivas.',
    shareStart: 'Comenzar a compartir',
    shareCancel: 'Cancelar',
    shareAudioBadge: 'Audio',
    shareAudioBadgeTitle: 'Se está compartiendo el sonido de la computadora',
    shareNoAudioWarning: 'No se compartió sonido. Para incluir el audio, deja de compartir y vuelve a empezar; elige Toda la pantalla (o una pestaña del navegador) y activa «compartir audio» en la ventana. Nota: Safari y Firefox no pueden compartir el sonido de la computadora.',
    shareError: 'No pudimos iniciar la pantalla compartida. Inténtalo de nuevo.',

    deviceSettings: 'Ajustes de audio y video',
    microphone: 'Micrófono', camera: 'Cámara', speaker: 'Altavoz',
    noDevices: 'No se encontraron dispositivos.',

    whiteboard: 'Pizarra',
    whiteboardTitle: 'Pizarra compartida',
    whiteboardClose: 'Cerrar pizarra',
    whiteboardLoading: 'Cargando…',
    whiteboardZoomIn: 'Acercar',
    whiteboardZoomOut: 'Alejar',
    whiteboardRecenter: 'Ajustar al contenido',
    whiteboardPen: 'Lápiz',
    whiteboardEraser: 'Borrador',
    whiteboardClear: 'Borrar pizarra',

    transcript: 'Transcripción',
    transcriptTitle: 'Transcripción en vivo',
    transcriptClose: 'Cerrar transcripción',
    transcriptEmpty: 'Aún no se detecta voz. Comienza a hablar para ver los subtítulos.',
    transcriptUnsupported: 'La transcripción en vivo no está disponible en este navegador. Usa Chrome o Edge.',
    transcriptListening: 'Escuchando…',

    errorMessages: {
      'not-authenticated': 'Inicia sesión para entrar a esta clase.',
      'not-found': 'No encontramos esta sesión.',
      'not-authorized': 'No tienes acceso a esta sesión.',
      'cancelled': 'Esta sesión fue cancelada.',
      'completed': 'Esta sesión ya finalizó.',
      'invalid-time': 'Esta sesión tiene una hora inválida. Contacta a soporte.',
      'expired': 'Esta sesión expiró y ya no se puede ingresar.',
      'init-failed': 'No pudimos iniciar la sesión. Inténtalo de nuevo.',
      'token-failed': 'No pudimos conectarte a la sala. Inténtalo de nuevo.',
      'connection': 'Se perdió la conexión con la clase. Revisa tu internet y vuelve a entrar.',
      'duplicate': 'Abriste esta clase en otra pestaña o en otro dispositivo. Cierra la otra y pulsa Reintentar para usarla aquí.',
      errorFallback: 'No pudimos conectarte a tu sesión. Inténtalo de nuevo.',
    },
  },
}

export type VideoStrings = Strings

export function videoStrings(lang: Locale): VideoStrings {
  return VIDEO_T[lang]
}

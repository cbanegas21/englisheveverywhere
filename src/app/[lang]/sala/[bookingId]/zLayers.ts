// Central z-index scale for the call-stage overlays. One source of truth so the
// PiP self-view reliably floats above the side panels (CALL-01) while the
// whiteboard + device popover stay above the PiP. Keep these in sync with the
// Tailwind `z-*` classes still used by the chat/notes panels (z-30 == panel).
export const Z = {
  topBar: 10, // == TopBar `z-10`
  controlBar: 20, // == ControlBar `z-20`
  panel: 30, // == ChatPanel / NotesPanel `z-30`
  selfView: 35, // PiP self-view — above side panels, below the whiteboard
  whiteboard: 40, // full-stage focus surface — above the PiP
  deviceMenu: 50, // popover backdrop + menu — topmost interactive layer
  lifecycle: 60, // leaving / connecting overlays
} as const

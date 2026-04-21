// Client-side availability check mirroring the server's isTeacherAvailable.
// Used by admin assignment UIs to annotate teachers as available/off-hours
// BEFORE the user clicks assign — reduces failed assignment round-trips.
//
// availability_slots is stored in Honduras local time (America/Tegucigalpa),
// day_of_week 0=Sunday per JS convention. Keep this in sync with the server
// version in src/app/[lang]/admin/actions.ts → isTeacherAvailable.

export interface AvailabilitySlot {
  teacher_id: string
  day_of_week: number
  start_time: string // "HH:MM" or "HH:MM:SS"
  end_time: string
}

const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const

export function isTeacherAvailableClient(
  teacherId: string,
  slots: AvailabilitySlot[],
  scheduledAtIso: string,
  durationMinutes: number,
): boolean {
  const scheduled = new Date(scheduledAtIso)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Tegucigalpa',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(scheduled)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00'
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00'
  const dow = DAYS[weekday as keyof typeof DAYS] ?? 0
  const startMin = parseInt(hour) * 60 + parseInt(minute)
  const endMin = startMin + durationMinutes

  return slots.some(s => {
    if (s.teacher_id !== teacherId) return false
    if (s.day_of_week !== dow) return false
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    const slotStart = sh * 60 + (sm || 0)
    const slotEnd = eh * 60 + (em || 0)
    return slotStart <= startMin && slotEnd >= endMin
  })
}

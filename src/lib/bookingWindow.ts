// Keep a class in the "upcoming / active" lists until it has actually ended —
// not the instant its start time passes — so a live or slightly-late class
// doesn't vanish from My Classes / the dashboards with no Join button.
//
// Mirrors the room's late-join cap (getRoomAccess allows joining until
// scheduled_at + duration + 90 min); 2.5h comfortably covers a standard class
// plus that grace, after which a no-show booking finally drops off the list.
export const ACTIVE_BOOKING_GRACE_MS = 2.5 * 60 * 60 * 1000

// ISO cutoff for `bookings.scheduled_at >= cutoff` filters on join surfaces.
export function activeBookingCutoffIso(): string {
  return new Date(Date.now() - ACTIVE_BOOKING_GRACE_MS).toISOString()
}

# Phase 1 Changelog

**Scope:** Close role-leakage and LiveKit-inaccessibility gaps.
**Date:** 2026-04-19

## Bugs fixed

### 1. Role leakage across dashboards
An admin at `/en/admin` could type `/en/dashboard` into the URL bar and see
student UI. Root cause: `dashboard/layout.tsx` and `maestro/layout.tsx` read
`user_metadata.role` (which drifts after admin DB promotions) and only
redirected one direction (teacher → maestro, or non-teacher → dashboard) —
admins fell straight through into whichever area they visited.

**Fix — two layers:**
- **Source of truth:** both layouts now read `profiles.role` (canonical) and
  whitelist exactly one role. Admins and cross-role visitors are redirected
  to their own home.
- **UX fast path:** `src/proxy.ts` reads a new signed `ee-role` cookie
  (httpOnly, 30d) set in `signIn` and cleared in `signOut`. When present and
  mismatched, the proxy redirects before rendering, preventing a wrong-role
  flash. Cookie absence falls through to the layout guards — the cookie can
  never *grant* access, only shortcut the redirect.

Files:
- `src/proxy.ts` — role-cookie gate after locale handling
- `src/app/actions/auth.ts` — set/delete `ee-role` in signIn/signOut
- `src/app/[lang]/dashboard/layout.tsx` — canonical-role guard
- `src/app/[lang]/maestro/layout.tsx` — canonical-role guard

### 2. LiveKit rooms had no way to join
Rooms existed server-side (`getRoomAccess` + `/sala/[bookingId]`) but no UI
surfaced a join button, so admins and users couldn't access sessions. Also,
admins could not enter a room even if they navigated there — the participant
check in `getRoomAccess` and the sala page rejected non-student/non-teacher
users.

**Fix:**
- **Admin access:** `getRoomAccess` and `sala/[bookingId]/page.tsx` now allow
  any user with `profiles.role === 'admin'` through, plus the
  `conductor_profile_id` (placement admin). Admins currently receive
  participant-level LiveKit grants; a `TODO: observer-mode` comment marks
  where to scope grants down when the observer role is wired.
- **Join button:** new `src/components/JoinSessionButton.tsx`. Client
  component with a 30-second ticker; shows a countdown before
  `scheduled_at − 15min`, active link in the window, and "Session ended"
  after `scheduled_at + 90min` (matching `getRoomAccess`). Three variants
  (`primary`, `secondary`, `compact`) to fit different row densities.
- **Mounted in 5 surfaces:**
  1. `dashboard/StudentDashboardClient.tsx` — upcoming classes row (compact)
  2. `dashboard/clases/ClasesClient.tsx` — upcoming list (compact, replaces
     the inline link + local `canJoinClass` helper)
  3. `dashboard/placement/PlacementScheduledScreen.tsx` — centered primary
     button above "Go to Dashboard"
  4. `maestro/dashboard/TeacherDashboardClient.tsx` — upcoming sessions row
     (compact)
  5. `admin/bookings/BookingCalendarClient.tsx` — booking detail panel
     (secondary, replacing the dead `video_room_url` anchor)

## Architecture notes

- **Canonical role source** is `profiles.role`. `user_metadata.role` is no
  longer trusted because an admin promoting a user via DB update leaves it
  stale. The role cookie is a UX-only cache — it can only redirect, never
  authorize.
- **Window parity:** `JoinSessionButton`'s open/close window (T−15 / T+90)
  mirrors the server-side window in `actions/video.ts → getRoomAccess` so a
  client showing "Join" will not get rejected by the server.
- **Admin observer TODO:** `getRoomAccess` currently grants admins full
  publish permissions; the observer-mode comment marks the exact spot to
  narrow the grant (LiveKit canPublish=false) once the UX is designed.

## Verification

- `pnpm lint` — 65 problems (45 errors, 20 warnings). Baseline before Phase 1
  changes was 68 problems (46 errors, 22 warnings); all remaining items are
  pre-existing and unrelated.
- `npx tsc --noEmit` — clean.
- `pnpm build` — succeeds; all protected routes compile as dynamic
  server-rendered (`ƒ`).
- `grep JoinSessionButton src/` — 5 usage sites confirmed (one per surface).

## Env check

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` verified present in
  `.env.local`. No `.env.example` exists in the repo.

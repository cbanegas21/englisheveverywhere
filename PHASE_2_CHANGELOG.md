# Phase 2 Changelog

**Scope:** Revamp 3 cramped student pages — Schedule (Agendar), My Classes
(Clases), and Diagnostic Call (Placement) — to feel premium, use the full
viewport, and guide the user.
**Date:** 2026-04-19

## Scope decisions (from planning)

- **Diagnostic ≡ Placement:** same booking type (`placement_test`), same
  purpose ("figure out your level and place you"). Merged into one enhanced
  `PlacementScheduledScreen` instead of two components.
- **No "pick a teacher" filter on Schedule:** current flow is "student picks
  time → admin assigns teacher". Filter dropdown would lie about what the
  user can actually do. Went visual-only: weekly calendar grid *is* the filter.
- **Duration:** fixed at 60 min per product — no duration toggle.
- **Reminders UI (Option A):** visual stub with toggles + timing, marked
  "Próximamente". Real wiring (Twilio/Resend + cron scheduler) is Phase 3.
- **"Watch recording":** dropped. LiveKit recording egress not configured;
  user flagged it as not a felt need.
- **"Repeat last week":** built. Scans student's non-cancelled bookings from
  the last 7 days; surfaces up to 3 next-week equivalents as click-to-select
  chips in the left rail.

## Pages revamped

### 1. `dashboard/agendar/AgendarClient.tsx`
**Before:** `max-w-5xl`, 40px grid rows, 8-9px cell text, no guidance, no
recurrence shortcut. Cramped.

**After:**
- **Full-bleed layout** — `max-w-[1440px]` container with `lg:grid-cols-[300px_1fr]`.
- **Left rail (new):**
  - Gradient balance hero ("X classes left") — crimson-on-crimson, 44px number.
  - **"Repeat last week"** card — shows up to 3 past-week bookings as
    next-week suggestion chips. Click selects the slot, opens confirm modal.
    Empty-state message when nothing to repeat.
  - **"How it works"** card — 3 numbered steps explaining the pick-time →
    teacher-assigned-later flow.
- **Main grid:**
  - Hour rows raised to 52px, cell text to 11px, hour labels to 11px.
  - Day headers enlarged (17px date circles, opacity dim on past days).
  - **Business-hours default** (7 AM–10 PM) with "Show 24h" toggle —
    collapses the useless midnight-3AM rows most users never look at.
  - Legend strip at bottom (Available / Booked).
  - Selected-cell hover scale + shadow.
  - Auto-scroll to 8 AM on mount when 24h view is expanded.
- **Confirm modal:** subtitle line added, blur backdrop strengthened.

### 2. `dashboard/clases/ClasesClient.tsx`
**Before:** `max-w-3xl`, calendar stacked on top of a tiny list, no search,
no stats. Single cramped column.

**After:**
- **Two-column layout** — `lg:grid-cols-[380px_1fr]`.
- **Left rail:**
  - Monthly calendar — bigger cells, larger date numbers, dot markers for
    booked days, "X classes this month" subline.
  - **30-day stats card (new):** Total / Completed / Hours learned — 22px
    tabular numerals, 3-up grid.
- **Main:**
  - Pill tabs with icons + count badges (Upcoming / History).
  - **Search bar (new):** filter list by teacher name; diagnostic calls match
    "placement"/"diagnostic".
  - List rows: wider, 14px title, teacher avatar (falls back to icon pill),
    date card on the left with red month/day hierarchy. Hover row highlight.
  - Header "Book a class" CTA (primary) surfaced on desktop.

### 3. `dashboard/placement/PlacementScheduledScreen.tsx`
**Before:** 480px-wide card, one green banner, single "Go to dashboard" link.
Nothing about *how* to prepare or *when* it's happening.

**After:**
- **Hero card** (`max-w-[1200px]`, gradient crimson):
  - Scheduled pill badge, Honduras-CST label, 28-36px date, 22-28px time,
    60-min chip.
  - **Live countdown** — updates every 30s. Shows "In 2 days · 4 hours",
    "In 45 minutes", pulse dot + "Happening now" during the call, "Ended"
    after T+90min.
  - JoinSessionButton surfaced top-right of hero.
  - Green "Join 15 min early" note strip below the gradient.
- **3-card row:**
  - **Add to calendar (new):** Google Calendar link (`calendar/render`
    template URL) + .ics data-URL download. Both link directly — no backend.
  - **Reminders (new, Option A stub):** Email/SMS/WhatsApp toggles +
    24h/1h-before checkboxes, "Próximamente" badge, TODO comment points to
    the exact wiring path (`notification_preferences` JSONB on profiles +
    cron + Resend/Twilio).
  - **Prep checklist (new):** 4 items — quiet space, mic test, relax, notepad.
    Icons per item (Wifi/Mic/Sparkles/Headphones).
- **FAQ accordion (new):** 4 common questions (length / prep / who joins /
  reschedule). Single-open, chevron-rotate indicator.
- **Past state:** same layout shell, amber gradient, reschedule + dashboard
  CTAs. Centered 600px card.

## Architecture notes

- **Purity rule:** React 19 ESLint flags `Date.now()` inside `useMemo` (and
  any render-time impure call). Both Agendar and Clases now snapshot time via
  `useState(() => Date.now())` — the same pattern used by
  `components/JoinSessionButton.tsx`. Value is stable across renders; if the
  page lives for hours, the "last 7 days" / "last 30 days" windows drift by
  the age of the tab, which is acceptable for a classes dashboard.
- **No schema changes.** Phase 2 is frontend-only as scoped. Reminders card
  intentionally does not persist — its state is local to the component.
- **Design system preserved:** same palette (`#C41E3A` brand, `#F9F9F9` bg,
  `#111111` text, `#9CA3AF` muted), same card idiom (`rounded-2xl`,
  `border: 1px solid #E5E7EB`), same framer-motion spring presets.
  Typography scale nudged up (H1 22px → 22px, but card headers 13-15px from
  13px; hero H2 36px new).
- **Full i18n:** every new string has `en` + `es` pairs. All existing strings
  preserved.

## Verification

- `npx tsc --noEmit` — clean.
- `pnpm lint` — 65 problems (45 errors, 20 warnings). Phase 1 baseline was
  the same count; my temporary +2 `Date.now()` errors fixed during self-check.
  All remaining items are pre-existing and unrelated.
- `pnpm build` — succeeds. All 3 revamped routes compile as dynamic (`ƒ`):
  `dashboard/agendar`, `dashboard/clases`, `dashboard/placement`.

## Phase 3 backlog carried forward

- **Reminders backend:** `notification_preferences` JSONB on `profiles`,
  persist server action, cron job hitting Resend + Twilio.
- **LiveKit recording:** enable egress in LiveKit Cloud, Supabase Storage
  destination, playback link on completed classes.

## Files touched

- `src/app/[lang]/dashboard/agendar/AgendarClient.tsx` — full rewrite
- `src/app/[lang]/dashboard/clases/ClasesClient.tsx` — full rewrite
- `src/app/[lang]/dashboard/placement/PlacementScheduledScreen.tsx` — full rewrite
- `PHASE_2_CHANGELOG.md` — new

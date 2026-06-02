# EnglishKolab — Human-Lens Audit Ticket List

_Generated 2026-06-01 via multi-agent audit (8 surface reviewers + synthesis). 227 raw findings → 79 consolidated tickets. Measured against the authoritative product flow: pay → free placement call (level) → **student books any slot** → **admin assigns an available teacher after booking**._

**Counts:** 🔴 6 critical · 🟠 23 high · 🟡 36 medium · ⚪ 14 low

### Progress log
- **2026-06-02 — all 6 criticals DONE + deployed** (commit `32420e9`): EK-001 (gate reverted), EK-002 (HowItWorks reordered), EK-003 (Terms expiry), EK-004 (Stripe refund metadata), EK-005 (email sender fallback), EK-006 (role-cookie constant). Also folded in: **EK-027** ✅ (agendar copy), **EK-033** ✅ (Terms currency), and **partial** EK-007/EK-008 (the HowItWorks instances only — the rest of those two tickets remain open).
- **2026-06-02 — copy sweep DONE:** EK-007 (near-native/LatAm descriptors removed everywhere — Hero meta, Pricing, Teachers, FAQ, registro, PlanClient, teacher profile), EK-008 (Hero now "you pick the time" + FAQ/dashboard/maestros agency copy), EK-009 (Teachers 8-city network + "24/7 really means 24/7" + MorningBanner cities + maestros backup all corrected — kept the real per-slot substitute). Folded in: EK-063 (registro "no subscription" → "pay once per pack") and EK-073 (maestros "assigned after you book"). Remaining "Latin American" mentions are audience/market context, intentionally kept.
- **2026-06-02 — EK-024 responsive DONE** (Playwright-verified at 390px + 1280px): landing grids (Hero, Teachers, FAQ, Footer) collapse to 1 col on mobile; HorasGrid scrolls horizontally instead of squishing; dashboard main layouts (/agendar rail+calendar, dashboard upcoming+actions) stack on mobile. Minor follow-up: the in-card 7-day booking calendar is still tight at 390px (fits, not broken) — add horizontal scroll later.
- **2026-06-02 — logic batch 1:** EK-013 ✅ (admin cancel now refunds the class credit via cancelBookingWithRefund in both BookingAssign + calendar; removed the no-refund cancelBooking). EK-016 ✅ (deleted dead updateStudentTeacher). EK-018 ✅ (relabeled teacher "pending requests" → "Classes to confirm" with a hint — kept as an acceptance step per Carlos). EK-010 ✅ (removed dead student level-picker step 2 + unused state; level comes from the placement call). **EK-014 = VERIFIED FALSE POSITIVE** — credit is decremented at booking creation, so a student legitimately has classes_remaining=0 at admin-confirm; a guard there would block valid confirmations. Decisions captured: EK-017 → ban via Supabase Auth; EK-018 → keep accept step.
- **2026-06-02 — logic batch 2:** EK-017 ✅ (deactivate now bans at the auth layer via setStudentDeactivated → user truly can't log in; was a no-op invalid role). EK-012 ✅ (my-teacher page reads primary_teacher_id, falls back to last booking only if unset). EK-050 ✅ (admin students-list teacher column uses primary_teacher_id; overview nested-join array-guarded).
- **EK-011 NEEDS A DECISION** (teacher self-lockout): fix is either (a) remove the teacher-facing "accepting students" toggle (admin controls activation — no migration), or (b) add an `accepting_students` column (migration) so it's decoupled from is_active. Flagged to Carlos.
- **Open next:** EK-011 (pending decision), EK-015 (reschedule notify), EK-019/044/045/046 (timezone — batch together), EK-020/021/022 (video), EK-023 (payouts reporting), EK-025 (html lang), EK-026 (privacy ES), EK-028 (level-set security), EK-029 (ganancias cap) → then medium → low. Minor: maestros placement-date timezone (EK-012 tz part) folded into the timezone batch; onboarding LEVELS/LEVEL_LABELS/step2Student constants dead (EK-077).

> ⚠️ Engineering-bug tickets (EK-004/005/006/010 etc.) are reviewer claims — **verify against current code before fixing**. Copy/UX tickets are direct observations.

## Executive summary
Four dominant themes: **(1)** the critical **booking-gate bug** (createBooking + /agendar require `primary_teacher_id` before booking — inverts the real flow and hard-blocks every paid student — this is the gate we shipped and must revert); **(2)** pervasive **banned/contradictory copy** ("near-native"/"Latin American" teacher descriptors in 8+ files incl. SEO meta; copy implying the platform assigns class times or assigns the teacher before booking); **(3)** a **legal-vs-marketing contradiction** (Terms say classes expire while marketing promises they never do; Terms misdescribe FX; legal pages use a personal Gmail); **(4)** **systemic engineering gaps** (role-cookie name mismatch, missing class-credit refund/check paths, Stripe refund metadata may never reverse credits, signup email falls back to a sandbox that drops mail to real users, inconsistent timezone handling, many non-responsive grids). Tackle the booking gate first, then the email/Stripe/cookie correctness bugs, then the copy + Terms sweep.

---

## 🔴 Critical

### EK-001 · BUG · Booking gate requires a teacher before booking
- **Where:** `src/app/actions/booking.ts:90-99`, `dashboard/agendar/page.tsx:47-48`, `agendar/AgendarClient.tsx:224-269`, `dashboard/maestros/[teacherId]/TeacherProfileClient.tsx:11` (2nd entry point)
- **Impact:** Every paid student is hard-blocked until an admin sets `primary_teacher_id`. Inverts the real flow (book first, assign after). **This is the gate we just shipped.**
- **Fix:** Remove the `if (!student.primary_teacher_id)` guard; prerequisites are `classes_remaining > 0` + level/intake. Drop the `teacherAssigned` prop + early-return wall in AgendarClient; retire `noTeacher*` strings. Same for the teacher-profile entry point.

### EK-002 · BUG · HowItWorks shows "we assign teacher" *before* booking
- **Where:** `components/landing/HowItWorks.tsx:14-16` (EN), `:26-28` (ES)
- **Impact:** Teaches the wrong sequence (assign-before-book).
- **Fix:** Reorder → 01 Choose pack → 02 Free placement call → 03 Book your times → 04 Admin assigns an available teacher.

### EK-003 · COPY · Terms say classes expire, marketing says never
- **Where:** `terms/page.tsx:30` (EN §3), `:120` (ES §3) vs `Pricing.tsx:14,41`
- **Impact:** Direct contradiction between accepted Terms and the "classes never expire" promise.
- **Fix:** Update Terms §3 to "classes do not expire and stack."

### EK-004 · BUG · Stripe refund may never reverse class credits
- **Where:** `api/stripe/webhook/route.ts:124-160`, `actions/stripe.ts (createCheckoutSession)`
- **Impact:** Refund handler reads `charge.metadata`, but payment-mode metadata lives on the Session, not the Charge, unless `payment_intent_data.metadata` is set. Refunded student keeps classes. **LIVE Stripe.**
- **Fix:** Add `payment_intent_data: { metadata: { user_id, plan_key } }` at session creation, or fetch the PaymentIntent in the webhook.

### EK-005 · BUG · Signup email falls back to Resend sandbox → real users never get activation
- **Where:** `actions/auth.ts:104-108`
- **Impact:** If `EMAIL_FROM` unset, confirmation emails come from `onboarding@resend.dev` (only delivers to the Resend owner). Every real signup's email is silently dropped.
- **Fix:** Require a verified-domain `EMAIL_FROM`; fail loudly if missing in prod.

### EK-006 · BUG · Role-cookie name mismatch (`ee-role` vs `ek_role`)
- **Where:** `actions/auth.ts:12` (`ee-role`) vs `actions/profile.ts:10,274` (`ek_role`)
- **Impact:** `deleteMyAccount` deletes a cookie that never exists; the real `ee-role` cookie survives deletion → proxy may route a deleted session to a protected dashboard until JWT expiry.
- **Fix:** Use a single shared constant (`ee-role`) everywhere.

---

## 🟠 High

### EK-007 · COPY · "near-native"/"Latin American" teacher descriptors site-wide
- **Where:** `HowItWorks.tsx`, `Pricing.tsx:24,51`, `Teachers.tsx`, `FAQ.tsx:14,27`, `registro/page.tsx:17,52`, `PlanClient.tsx:66-67,132-133`, `TeacherProfileClient.tsx:77,116`, `app/layout.tsx:30` (SEO meta), `MorningBanner.tsx`
- **Impact:** Banned descriptors in 8+ files incl. global SEO meta.
- **Fix:** Replace with factual "certified teacher, matched to your level & goals." Keep "platform for Latin America" (audience).

### EK-008 · COPY · Copy implies the platform assigns class times / assigns teacher before booking
- **Where:** `Hero.tsx:15-18,38-41`, `HowItWorks.tsx:15,27`, `FAQ.tsx:14,27`, `AgendarClient.tsx:34,76`, `StudentDashboardClient.tsx:55-56,123-124`, `maestros/page.tsx:48-53,75-80`
- **Impact:** "matched to your schedule", "with your teacher", "we assign based on your schedule" etc. contradict student-picks-time.
- **Fix:** Make student agency explicit; match teacher to level/goals only, assigned after booking. **(Your item 1 hero clarity lives here.)**

### EK-009 · COPY · False multi-city network / "24/7 backup teacher" with one teacher
- **Where:** `Teachers.tsx:14-15,49,31-40,66-75`, `MorningBanner.tsx:8,15`, `maestros/page.tsx:42,70`
- **Impact:** Claims teachers across 8 cities + always-on coverage; only one active teacher exists. _Note: the per-slot substitute concept is real (you confirmed), but the multi-city network claim is not._
- **Fix:** Remove city enumeration + 24/7-network guarantee; keep honest "if your regular teacher isn't free at your time, another available teacher covers it."

### EK-010 · BUG · Student onboarding level (step 2) never saved
- **Where:** `OnboardingClient.tsx:163` (`totalSteps=1`), `:219-221`, `:396-476` (unreachable step 2)
- **Impact:** Level picker never reached; `completeStudentOnboarding` doesn't receive level → level always null.
- **Fix:** Either wire level through, or remove step 2 if level always comes from the placement call.

### EK-011 · BUG · Teacher "Accepting students" toggle writes `is_active` → self-lockout
- **Where:** `TeacherDashboardClient.tsx:167-175`, `maestro/dashboard/layout.tsx:28`
- **Impact:** Toggling off kicks the teacher to `/maestro/pending` with no way back.
- **Fix:** Separate `accepting_students` from admin-controlled `is_active`; move write to a server action.

### EK-012 · BUG · "My teacher" page shows last-booking teacher + hardcoded timezone
- **Where:** `maestros/page.tsx:245-270,303-316`
- **Fix:** Source from `primary_teacher_id`; use `profiles.timezone`.

### EK-013 · BUG · Admin calendar cancel doesn't refund the class credit
- **Where:** `BookingCalendarClient.tsx:244-257`, `admin/actions.ts:380-394` (`cancelBooking`) vs `:518` (`cancelBookingWithRefund`)
- **Fix:** Use the refund-aware action (with a no-refund flag for no-shows).

### EK-014 · BUG · Drag-drop assign-and-confirm skips class-credit check
- **Where:** `BookingCalendarClient.tsx:182-188`, `admin/actions.ts:102-184`
- **Fix:** Add `classes_remaining > 0` guard; surface remaining count on cards.

### EK-015 · BUG · Approve-reschedule moves time but keeps "confirmed", no notify
- **Where:** `admin/actions.ts:248-252`
- **Fix:** Set pending, re-issue reminders, notify student.

### EK-016 · BUG · `updateStudentTeacher` patches latest booking, not `primary_teacher_id` (dead)
- **Where:** `admin/actions.ts:406-424`
- **Fix:** Delete or repoint to `primary_teacher_id`.

### EK-017 · BUG · "Deactivate account" sets invalid role `deactivated` → user still logs in
- **Where:** `StudentProfileClient.tsx:738-739`, `actions/auth.ts` (signIn default)
- **Fix:** Add a real deactivated state or use Supabase Auth ban.

### EK-018 · BUG · Teacher confirm/decline of pending bookings contradicts admin-assigns model
- **Where:** `agenda/AgendaClient.tsx:237-260`, `booking.ts:154-182`
- **Fix:** Clarify intent — remove, or relabel as "confirm you can teach this admin-assigned class." _(needs product decision)_

### EK-019 · BUG · Teacher reschedule modal parses time in browser-local, not saved timezone
- **Where:** `agenda/AgendaClient.tsx:167-175,189`

### EK-020 · BUG · Mute/camera state desync from LiveKit
- **Where:** `sala/.../ControlBar.tsx:55-68` — use `useTrackToggle`.

### EK-021 · BUG · Unassigned-teacher booking breaks room access
- **Where:** `sala/[bookingId]/page.tsx:54-62`, `actions/video.ts`
- **Impact:** With `teacher_id` null (the normal pre-assignment window), the teacher can't join.
- **Fix:** Handle undefined teacher gracefully in `getRoomAccess`.

### EK-022 · UX · ControlBar overflows off-screen on mobile
- **Where:** `sala/.../ControlBar.tsx:71-74` — wrap/overflow menu.

### EK-023 · BUG · `completeSession` payout row can double-count revenue in reports
- **Where:** `actions/video.ts:296-316` — flag/type payout rows distinctly.

### EK-024 · UX · Many fixed inline multi-column grids don't collapse on mobile
- **Where:** `Hero.tsx`, `Teachers.tsx`, `FAQ.tsx`, `Footer.tsx`, `HorasGrid.tsx`, `AgendarClient.tsx:421-431`, `StudentDashboardClient.tsx:683-689`
- **Fix:** Responsive grid utilities / breakpoints; overflow for HorasGrid + calendar.

### EK-025 · A11Y · Root `html lang="es"` + Spanish meta on all `/en` pages
- **Where:** `app/layout.tsx:41,27-31` — set lang per locale; add hreflang.

### EK-026 · MISSING · Privacy policy English-only even on `/es`
- **Where:** `privacy/page.tsx` — add full `es` translation.

### EK-027 · COPY · "/agendar confirm within 24h" implies the chosen time can be rejected
- **Where:** `AgendarClient.tsx:34-37,41,62,77-79,83,103`
- **Fix:** Reframe — only teacher assignment is pending, not the time. _(touches copy we just wrote)_

### EK-028 · SECURITY · `teacherSetStudentLevel` callable by any teacher sharing a booking
- **Where:** `actions/placement.ts:294-341`, `estudiantes/EstudiantesClient.tsx:324-368`
- **Fix:** Restrict to admin or placement relationship; track `level_source`.

### EK-029 · UX · Teacher Ganancias caps at 50 sessions → wrong total earnings
- **Where:** `ganancias/page.tsx:38` — separate aggregate query + pagination.

---

## 🟡 Medium

### EK-030 · UX · FinalCTA "Free diagnostic" links to /registro (dup of primary CTA) — `FinalCTA.tsx:143-149`
### EK-031 · BROKEN · HeroBookingCard "BOOK →" + slot rows look interactive but are dead — `HeroBookingCard.tsx:205-212,143-189,6-20`
### EK-032 · COPY · Legal pages use personal Gmail not `hola@englishkolab.com` — `privacy/page.tsx:4`, `terms/page.tsx:4`
### EK-033 · COPY · Terms misdescribe currency (says Stripe converts; app does FX, charges USD) — `terms/page.tsx:31,121`
### EK-034 · COPY · Terms §6 describes nonexistent self-serve teacher application/availability — `terms/page.tsx:51-52,141-142`
### EK-035 · COPY · "Cancel anytime"/"Renews on"/subscription framing contradicts one-time model — `translations.ts:50,122`, `PlanClient.tsx:29,99,35,105,474-476`
### EK-036 · UX · Contact/Privacy/Terms have no Navbar — navigation dead-end — `contact/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`
### EK-037 · A11Y · FAQ accordion lacks `aria-expanded`/`aria-controls` — `FAQ.tsx:101-133`
### EK-038 · A11Y · Classroom controls have no visible focus ring — `sala/.../ControlBar,DevRoom,Lobby,EndedScreen`
### EK-039 · A11Y · Password toggle has no aria-label + removed from tab order — `registro/page.tsx:343-352`
### EK-040 · BUG · "Remember me" checkboxes are no-ops — `login/page.tsx:205-212`, `registro/page.tsx:357-360`
### EK-041 · BUG · `auth/callback` never sets `ee-role` cookie — `auth/callback/route.ts`
### EK-042 · BUG · new-password PKCE may expire across tabs + post-update redirect ignores role — `login/new-password/page.tsx:41-57,74,95`
### EK-043 · BUG · intake → agendar redirect can loop when revalidation lags — `intake/page.tsx:25`, `agendar/page.tsx:29`
### EK-044 · BUG · Placement scheduling hardcoded to Honduras time — `PlacementClient.tsx:88-123`, `PlacementScheduledScreen.tsx:354`
### EK-045 · BUG · Agendar calendar renders slots in browser-local, not profile timezone — `AgendarClient.tsx:786-794`
### EK-046 · BUG · Admin calendar fixed -6h offset + today's day-of-week → DST/week bugs — `BookingCalendarClient.tsx:65-71,170-174,262-267`, `TeacherProfileClient.tsx:317-329`
### EK-047 · UX · Unassigned bookings invisible in admin week view — `BookingCalendarClient.tsx:389-393`
### EK-048 · BUG · MeetingScheduler weekday-only + required-teacher label + English-only — `MeetingScheduler.tsx:49-61,82,224,304-306`
### EK-049 · BUG · Assign-teacher dropdown keeps stale selection between bookings — `BookingCalendarClient.tsx:136,703-864`
### EK-050 · BUG · Students list/overview derive teacher from booking, not `primary_teacher_id`; unguarded nested join — `students/page.tsx:82-86`, `overview/page.tsx:199-207`
### EK-051 · UX · Admin level select auto-saves onChange, no undo — `StudentProfileClient.tsx:340-343`
### EK-052 · MISSING · Admin "Est. Total Paid" hardcoded $25/class; Payments tab + student receipts are stubs — `StudentProfileClient.tsx:309,533`, `PlanClient.tsx:826-832`
### EK-053 · BUG · Progreso "total time"/plan progress/"classes to next level" fabricated — `StudentDashboardClient.tsx:677`, `ProgresoClient.tsx:194,196`
### EK-054 · MISSING · Teacher Materiales is an all-stub "coming soon" page still in nav — `materiales/page.tsx:11-38,124-130`, `Sidebar.tsx:51,61`
### EK-055 · BUG · Graded assignments re-open editable form → silent overwrite — `TeacherTareasClient.tsx:369-509`
### EK-056 · UX · Tareas score selector mixes CEFR + qualitative in one dropdown — `TeacherTareasClient.tsx:10,486-494`
### EK-057 · BROKEN · Teacher "Change password" links to possibly-nonexistent `/login/reset` — `ConfigTeacherClient.tsx:208`
### EK-058 · BUG · Estudiantes "Total sessions" counts cancelled/pending — `estudiantes/page.tsx:26-48`, `EstudiantesClient.tsx:95-126`
### EK-059 · BROKEN · Student "Become a teacher" links to protected `/maestro/dashboard` — `Sidebar.tsx:209-234`
### EK-060 · MISSING · Clases "Cancelled" tab translated but never rendered/fetched — `ClasesClient.tsx:30,99`
### EK-061 · UX · Dashboard "Reschedule" links to blank /agendar, not a reschedule flow — `StudentDashboardClient.tsx:629-644`
### EK-062 · COPY · Placement "Step 1 of 3" but only one step exists — `PlacementClient.tsx:143,181`
### EK-063 · COPY · Registro "No subscription required" confusing (reads as "no payment") — `registro/page.tsx:19,54`
### EK-064 · BUG · Lobby promises a join notification that's never sent — `sala/.../i18n.ts:35,104`
### EK-065 · BUG · Admin in room treated as student (no End Class/notes; Leave doesn't complete) — `sala/[bookingId]/page.tsx:54-59`
### EK-066 · UX · Cancelled-booking rooms render then loop on always-failing Retry — `sala/[bookingId]/page.tsx:28-76`
### EK-067 · BUG · Classroom right-side panels overlap, no mutual exclusion — `NotesPanel.tsx:47`, `RoomShell.tsx:127-136`
### EK-068 · COPY · CuadernoPanel vocab never persisted but footer says "saved automatically" — `CuadernoPanel.tsx:458,470`
### EK-069 · BUG · Classroom timer clamps to 00:00 when joined late/over — `sala/.../hooks/useTimer.ts:7`
### EK-070 · MISSING · EndedScreen tells students to find a summary that may not surface — `EndedScreen.tsx:47`
### EK-071 · UX · Muted control variant visually identical to active/brand — `ControlBar.tsx:174-189`
### EK-072 · UX · CuadernoPanel defaults open at 360px, compresses video stage — `CuadernoPanel.tsx:58-60`, `RoomShell.tsx:134-135`
### EK-073 · COPY · Maestros copy makes placement call a prerequisite for assignment — `maestros/page.tsx:75-80`
### EK-074 · COPY · Admin overview English-only, ignores Spanish toggle; "Teacher Payouts" mislabel — `overview/page.tsx:43-46,64-104,199-224`

---

## ⚪ Low

### EK-075 · BUG · Teacher onboarding email hardcodes locale segment — `actions/onboarding.ts:137,145`
### EK-076 · UX · Login/Registro resolve lang client-side → Spanish flash for EN — `login/page.tsx:285-287`, `registro/page.tsx:408-410`
### EK-077 · BUG · Dead/duplicate code (empty purchase.ts, dead translations, dup approve fns, PII console.logs) — see ticket for full list
### EK-078 · BUG · TopBar participant count hardcoded to "2" — `sala/.../TopBar.tsx:60-62`
### EK-079 · COPY · Raw DB booking-type labels to admins; static HorasGrid clock; marquee ignores reduced-motion — `BookingCalendarClient.tsx:787`, `HorasGrid.tsx:13,24`, `TrustStrip.tsx:34-41`

---

## Recommended attack order
1. **EK-001** — revert the booking gate (undo what we shipped). _Quick, unblocks the core product._
2. **EK-005, EK-006, EK-004** — verify + fix the onboarding-email, cookie, and Stripe-refund correctness bugs (silent breakers of signup/billing).
3. **Copy + flow sweep** — EK-002, EK-007, EK-008, EK-009, EK-027, EK-073 + your 5 landing items.
4. **Terms/legal** — EK-003, EK-032, EK-033, EK-034, EK-035.
5. Then work down high → medium → low, QA'ing each.

# Student-side QA backlog — Carlos walkthrough 2026-06-06 (Round 2)

Status: **PLANNING ONLY — do not build yet.** Captured from Carlos's live student
walkthrough. Teacher-side notes to be appended next, then we sequence the work.

Legend: 🟢 like / keep · 🔧 fix · ✨ new feature · 🎨 de-AI polish · 🧭 decision needed ·
⚙️ needs external setup (accounts/APIs/$) · 🔬 research · ⏸ deferred (talk later)

---

## A. Settings / Configuración (student)
- **ST-01 🎨 De-AI the whole student Settings page.** Carlos still sees "AI slop" in
  Profile, Account, Notifications, and Billing sub-sections — off-brand vs the editorial
  system. Bring it to Cálido Editorial like the rest. (The dashboard round restyled other
  pages; Settings still needs it.)
- **ST-02 ✨ Profile photo upload.** No way to add a profile picture today. Add upload in
  the Profile section (storage bucket + avatar wiring). Used by sidebar avatar + teacher view.
- **ST-03 🔧🧭 Professional timezone selector — SITE-WIDE & CRUCIAL.** Today it shows a
  fixed string (e.g. "GMT-6 · 10:37 AM"). Carlos wants a *proper* tz control like the good
  complex dropdowns: correct GMT offsets, readable zone/region labels, current local time,
  searchable, and **auto-aligned to the user's real location**. Apply EVERYWHERE tz appears:
  **landing, settings, scheduling, all sections.** Verify thoroughly. (Decisions: auto-detect
  on first load? store per user? IANA zone list + a tz lib; how it feeds booking times.)
- **ST-04 ✨⚙️ Reminders / notifications — Email + SMS + WhatsApp (all three).** Currently
  "Coming soon." Build the notification system + a preferences UI. NOTE: per CLAUDE.md, **email
  booking reminders already exist** (Resend scheduled T-24h/T-1h for student+teacher) — verify,
  then add: SMS (Twilio or cheaper alt), WhatsApp (WhatsApp Business / Cloud API), and the
  user-facing on/off preferences. Carlos wants a written breakdown of what must be set up per
  channel (accounts, API approval, sender IDs, templates, costs). See "Big rocks" below.
- **ST-05 🔧 Danger zone — hide/de-emphasize.** Don't show it as a big option among the first
  five. Tuck it small + low, e.g. bottom of the Profile section, visually minimized.
- (Billing "Go to my plan" no-op when nothing purchased = expected, no action.)

## B. My Plan
- 🟢 Likes the My Plan section a lot. Pricing is competitive — **do NOT touch pricing.**
- **ST-06 🧭 Rename plans to be more sales-y (ES + EN).** Keep the descriptor lines (Spark→
  "start", Drive→"consistency", Ascent→"real progress", Peak→"max exposure") but the names
  "Spark/Drive/Ascent/Peak" feel weird — *worse in English.* Propose new, conversion-friendly
  names in both languages. (Canonical source: src/lib/pricing.ts.)

## C. My Progress
- 🟢 Likes the whole section overall.
- **ST-07 ✨🧭 Self-declared level (skip diagnostic testing).** Add a small box/toggle in the
  middle of My Progress: "¿Ya conoces tu nivel? / Do you already know your level?" Some students
  already know (A1–C2) from tests (EF SET, EnglishScore, etc.). If they set it, the teacher sees
  it and the diagnostic call doesn't waste time testing — teacher talks about other things.
  Ties into the existing "current level pending" state.
- **ST-08 🔧 Fix "Tu Camino" / "Your way" copy.** Bottom of My Progress. "Your way" reads off /
  awkwardly placed in EN. Reword + reposition properly (both locales).
- **ST-09 ✨ Edit the Learning Profile.** The "Tu perfil de aprendizaje / Your learning profile"
  block has no button to change/improve it. Add an edit affordance.
- **ST-10 🧭 Reorder My Progress.** Recent classes are at the bottom; consider surfacing them
  (and a weekly count — "how many classes do I need this week") near the top. Plan for the
  diagnostic-call / current-level block to move aside once the level is set (ties to ST-07).
- **ST-11 🔧 PDF report download is broken.** "Download report PDF" does nothing on click. Fix
  generation/delivery (may currently no-op when there's no data — should still produce a report).
- **ST-12 🔬✨ Student diploma / certificate.** Explore issuing a completion certificate/diploma
  as a sales lever. Research what "certified" can legally mean for us; teachers are certified +
  we're a legal company. Design a tasteful certificate + the rule for when it's earned.

## D. Scheduling & Classes
- **ST-13 🔧 Agendar with no plan → redirect to My Plan.** Entering the schedule flow without a
  plan shouldn't dead-end; send the student to My Plan (logical, since no credits = no booking).
- **ST-14 🎨 Replace cheap "bootstrap-y" icons.** The diagnostic-call icon (looks like a
  stethoscope) feels cheap. Audit the WHOLE page for these generic line-icons and replace with
  proper/brand-appropriate marks (consistent with the de-AI direction).
- **ST-15 ✨ Real countdown timer for upcoming calls.** Replace the static "starts in 30 minutes"
  with a live countdown of remaining time.
- **ST-16 🧭 Surface the early-join window.** Make it clear how early a student can join a call.
  (Code already enforces ~15-min early-join / 90-min late-cap in getRoomAccess — display it.)
- 🟢 My Classes: likes having the diagnostic call here. Home/Inicio: looks good, no complaints
  (likes plans, diagnostic call, upcoming classes).

## E. Navigation & Support
- **ST-17 🔧 Remove "Become a teacher" from the student sidebar.** Not needed; prospective
  teachers reach out via phone/email. (Sidebar.tsx renders "Enseñar en la plataforma" for
  role=student — remove it.)
- **ST-18 ✨ Add a Support/Help path for students.** Carlos didn't find a clear way to reach
  support / raise a concern. Add a visible, proper support contact (beyond the small sidebar
  "Ayuda y contacto" mailto). Decide channel(s): help/contact page, WhatsApp, email, in-app form.

## F. Deferred (talk later)
- **ST-D1 ⏸ Library (Biblioteca).** Still pending — discuss later.
- **ST-D2 ⏸ Homework intake mechanism.** Likes the homework look; how homework actually gets
  added to the platform is TBD — discuss later.

---

## Big rocks (need design + your input before building)
1. **Timezone (ST-03)** — site-wide, "crucial." Pick a tz library + UX, auto-detect strategy,
   and how it flows into booking/display everywhere.
2. **Notifications Email/SMS/WhatsApp (ST-04)** — channel-by-channel setup plan:
   - Email: Resend (already wired for booking reminders) — extend + add prefs.
   - SMS: Twilio vs cheaper (e.g. Vonage, AWS SNS, MessageBird) — needs account, sender, $/msg.
   - WhatsApp: WhatsApp Business / Cloud API (Meta) — needs business verification, approved
     message templates, a BSP or direct Cloud API; this has the longest setup lead time.
3. **Diploma/certification (ST-12)** — research legal framing + design.
4. **PDF report (ST-11)** — fix the generation pipeline.

## Liked / keep as-is (do not change)
Inicio/Home, My Plan layout, My Progress overall, Homework look, diagnostic-call presence,
the pricing.

---

_Next: append Carlos's teacher-side walkthrough notes, then produce a sequenced build plan
(one item at a time, with decisions resolved first)._

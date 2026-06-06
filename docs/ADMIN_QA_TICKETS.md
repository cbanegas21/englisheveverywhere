# Admin-side QA backlog — Carlos walkthrough 2026-06-06 (Round 2)

Status: **PLANNING ONLY — do not build yet.** Captured from Carlos's live admin walkthrough.

Legend: 🟢 like / keep · 🔧 fix · ✨ new feature · 🎨 de-AI / polish · 🧭 decision needed ·
⚙️ needs external setup · 🔬 research · ⏸ deferred (talk later)

---

## General
- **AD-01 🎨 De-AI the ENTIRE admin section.** It's "very AI slop." Replicate the Cálido
  Editorial system from the student/teacher sides across **all** admin pages (overview,
  students, teachers, bookings, etc.). The single biggest admin item.
- **AD-04 ✨🧭 Make admin more powerful / complex.** "Admin should be able to do whatever they
  want." Needs scoping — which extra capabilities? (edit any entity, manage plans/pricing,
  refunds, manual bookings, manage content, etc.)
- **AD-05 ✨🧭 Impersonate / "log in as" a student or teacher (view-as).** Let an admin act as a
  given user to see their exact view / debug. (Security: safe impersonation pattern + audit log.)

## Students (admin)
- 🟢 Likes it: open a student profile → classes, payments, profile, admin tools. Solid & neat.
  Just needs the AD-01 de-AI pass. Some students have no plan / no classes = normal.

## Teachers (admin)
- 🟢 Teacher list (4 active / 0 pending review), review schedules, students, session history,
  profile, admin tools — all good. Needs the AD-01 de-AI pass.
- **AD-06 🧭 Question the teacher *rating* feature.** "I don't know why we have rating." Not bad,
  fine for now — but decide whether ratings stay and what they're for.

## Bookings — BIG ROCK (Google Calendar–style)
- **AD-02 🔧 Bookings can be missed.** The current calendar is too big; some bookings get
  overlooked.
- **AD-03 ✨🧭 Build a Google-Calendar-style bookings calendar.** Model the UX on Google Calendar
  (one of the best/most solid). Requirements:
  - Default focus on waking/business hours (~6am–11pm) while keeping the full 24h available
    (don't start the view at midnight).
  - Click a time to **book** a call; **edit / remove / rename / assign**.
  - Intuitive create/edit interactions.
  - **Multi-calendar overlay:** select teachers to view their calendars together; see teacher
    **unavailability / "out of office"** blocking; a general who's-free/busy view.
  - 🧭 Decisions: build vs adopt a calendar lib (FullCalendar / react-big-calendar / Schedule-X);
    scope of admin edit actions; how it maps to existing bookings + availability_slots data.

## Library (admin)
- **AD-D1 ⏸** Library/books — no books yet; pending the cross-cutting **books/curriculum**
  discussion (= student Library + teacher Materials). Discuss later.

---

## Big rocks
- **AD-01** de-AI the whole admin section.
- **AD-03** Google-Calendar-style bookings calendar (+ multi-teacher overlay / out-of-office).
- **AD-04 / AD-05** admin power + impersonation.

## Liked / keep as-is
Student management depth (profile / classes / payments / admin tools), teacher management views.

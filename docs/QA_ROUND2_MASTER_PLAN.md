# QA Round 2 — Master Plan (Student + Teacher + Admin + Call)

Consolidated from Carlos's four walkthroughs on 2026-06-06. **PLANNING ONLY — nothing is built
until Carlos approves the sequence + the decisions below.**

Source backlogs: `docs/STUDENT_QA_TICKETS.md` (ST-01..ST-18), `docs/TEACHER_QA_TICKETS.md`
(TE-01..TE-04), `docs/ADMIN_QA_TICKETS.md` (AD-01..AD-06), `docs/CALL_QA_TICKETS.md`
(CALL-01..CALL-13). ~41 tickets total.

---

## Proposed phasing (a starting point — Carlos sets priority)

**Phase A — Finish the de-AI editorial sweep** *(low risk, continues shipped work; no new infra)*
- ST-01 student Settings · AD-01 entire admin section · ST-14 replace cheap "bootstrap" icons
- Quick wins folded in: ST-05 (hide danger zone), ST-08 ("Tu Camino" copy), ST-17 (remove
  become-teacher), ST-18 (support link), TE-01 (clarify accepting-students toggle), TE-02
  (stronger hover), ST-13 (Agendar→My Plan redirect), CALL-01/CALL-02 (chat overlap + self-notify).

**Phase B — Live Call / Classroom (CALL-01..CALL-13) — HIGH PRIORITY** *(most user time; must
feel Google-Meet/Teams professional)* — self-camera positioning/resize + share-time controls
(CALL-08/09/10), transcript + vocabulary fix (CALL-06/07), whiteboard zoom + collab verify
(CALL-04/05), raise-hand + reactions (CALL-11/12), Meet-quality UI polish (CALL-03), and the
**direct join link** (CALL-13, ties to notifications).

**Phase C — Timezone, site-wide (ST-03)** *(foundational; "crucial")*

**Phase D — Notifications (ST-04)** — Email (extend Resend) + SMS + WhatsApp + prefs; carries the
CALL-13 join link. *Start WhatsApp Business verification ASAP — longest external lead.*

**Phase E — Teacher Earnings / payouts (TE-04)** — Upwork-style on Stripe Connect.

**Phase F — Admin power tools** — AD-03 Google-Calendar bookings (+ multi-teacher overlay /
out-of-office) · AD-04 broader admin abilities · AD-05 impersonate / log-in-as.

**Phase G — Student progress & conversion** — ST-06 plan names · ST-07 self-declared level ·
ST-09 edit learning profile · ST-10 reorder My Progress · ST-11 fix PDF report · ST-12 diploma ·
ST-15 call countdown · ST-16 early-join window · ST-02 profile photo · TE-03 availability slot
model · TE-05 availability extra tools.

**Cross-cutting / later:** Books & curriculum content model (student Library + teacher Materials +
homework intake) · AD-06 keep-or-drop teacher ratings.

> Note: the **Call (Phase B)** is the most-used surface — Carlos may want it ahead of even the
> de-AI sweep. Priority is his call.

---

## Decisions needed before the big rocks (Carlos)
1. **Timezone (ST-03):** auto-detect on first load + store per user? (Recommend yes — browser
   detect, IANA list + tz lib, editable in settings.)
2. **SMS provider (ST-04):** Twilio vs cheaper (Vonage / AWS SNS / MessageBird)?
3. **WhatsApp (ST-04):** WhatsApp Cloud API (Meta) needs business verification + approved
   templates — green-light to start verification now.
4. **Plan names (ST-06):** I'll propose new sales-y ES/EN names for approval (pricing untouched).
5. **Earnings methods (TE-04):** Stripe Connect bank payout only (already wired) vs add
   PayPal / Payoneer / wire? + schedule/fee/min/reserve rules.
6. **Availability slot model (TE-03):** one window (9–18 = 1 block) vs N hourly slots?
7. **Admin calendar (AD-03):** build custom vs adopt a lib (FullCalendar / react-big-calendar /
   Schedule-X)? + scope of admin edit actions.
8. **Admin powers (AD-04) + impersonation (AD-05):** which capabilities; impersonation needs an
   audit log + safe pattern.
9. **Diploma (ST-12):** what "certified" means for us (legal) + design.
10. **Teacher ratings (AD-06):** keep or remove?
11. **Books/curriculum:** how content is hosted & added (one model for Library + Materials +
    Homework).
12. **Call transcript (CALL-06/07):** which STT/transcription approach (LiveKit transcription /
    a streaming STT service) — drives the live transcript + the vocabulary panel.
13. **Call join link (CALL-13):** the auth/redirect flow for a link that lands a logged-out user
    straight into the room.

---

## What Carlos liked (do NOT change)
Student: Inicio, My Plan layout, My Progress overall, Homework look, diagnostic-call presence,
pricing. Teacher: Home, My Schedule. Admin: student-management depth, teacher-management views.
Call: mic/video buttons, side-by-side, glass chat, screen share, mic/cam settings.

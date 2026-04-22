# EnglishKolab — First-Time User Audit (50 questions answered from code)

Generated 2026-04-21. Source questions: `docs/BACKLOG_QUESTIONS.md` (questions 1–50 of the user-facing block). Answers grounded in the actual repo state at this date.

Columns: **#** = question number  •  **Question** = what a real first-time user thinks  •  **What the user sees today** = what the code actually delivers  •  **Gap** = "none" if fully answered, otherwise what's missing.

---

## 1. Landing & trust

| # | Question | What the user sees today | Gap |
|---|---|---|---|
| 1 | Is this site legit? | Hero: "Live 1-on-1 sessions with certified teachers." Trust badges (cancel anytime, near-native, CEFR). 4 named testimonials. Footer: Remote ACKtive LLC, Wyoming. | None — solid positioning + social proof |
| 2 | ES or EN — which? | Language toggle visible top-right (mobile + desktop). Default `/es`. | None |
| 3 | Real teachers or AI? | Section "Teachers who genuinely care" but **no actual teacher photos or names** on landing. | Missing real teacher photos/names |
| 4 | Where are teachers from? | "near-native Honduran teachers" only in footer. | Vague — surface in hero / teachers section |
| 5 | Diff vs Duolingo / italki? | "No fixed timetables" in hero. No competitor comparison. | No "why us" differentiator block |
| 6 | Sample class? | None — no demo video, screenshot, or sample lesson | No sample / preview content |
| 7 | Not a scam? | Testimonials w/ real names + city, company name, T&Cs signed 2026-04-21. | No Stripe/SSL trust badges |
| 8 | Free trial? | None offered. | No free trial or intro class |
| 9 | Try before paying? | FAQ: "full refund after first paid class if not satisfied." | Refund scope unclear (1 class only?) |
| 10 | Who owns it? | Footer: Remote ACKtive LLC, Wyoming. Email c.banegaspaz2020@gmail.com. | Owners/team not named |

## 2. Pricing & plans

| # | Question | What the user sees today | Gap |
|---|---|---|---|
| 11 | Spark vs Drive vs Ascent vs Peak? | Cards with one-line tagline each ("start the habit," "full month," etc.) | No "who should pick this" persona guidance |
| 12 | 30 min or 1 hour? | **Class duration not stated anywhere on landing.** | Critical — must disclose duration |
| 13 | Do classes expire? | "Your unused classes carry over." FAQ: "no expiry, no countdown." | None |
| 14 | Auto-charge when pack runs out? | "One payment. No auto-renewal, ever." | None — clearly disclosed |
| 15 | Switch plans midway? | No upgrade/downgrade UI or policy copy. | Gap |
| 16 | Refund if I don't like it? | Terms §4: 14-day refund minus used/scheduled classes. | None |
| 17 | Pay in local currency? | Selector shows 20+ currencies but Stripe charges USD. | **Misleading** — add "USD only, converted for display" |
| 18 | What cards? | Stripe handles this; not stated on landing. | Minor |
| 19 | Card info safe? | Terms §3 mentions Stripe. | SSL/PCI not surfaced visibly |
| 20 | Statement descriptor? | Not disclosed anywhere. | Add "appears as ENGLISHKOLAB" copy |

## 3. Signup & onboarding

| # | Question | What the user sees today | Gap |
|---|---|---|---|
| 21 | Verify email? | Yes — registro success page tells them to check inbox/spam for confirmation link. | None |
| 22 | Charged at signup? | No — signup is free. Stripe only at plan purchase. | None |
| 23 | Pick teacher or assigned? | Booking screen: "your teacher will be assigned within 24 hours." Student cannot pick. | None |
| 24 | How do I take placement test? | Onboarding Q2 → PlacementClient survey + 60-min live call with admin. | "Test" misleading — it's a survey + call |
| 25 | How long is placement test? | 60 min — but only stated in confirmation email, not pre-booking. | Show duration in booking UI |

## 4. Booking

| # | Question | What the user sees today | Gap |
|---|---|---|---|
| 26 | How do I book first class? | Dashboard → Agendar → pick week → pick slot → confirm. Classes deducted immediately. | None |
| 27 | Book for today? | No — <24h cells gray "Too soon." Server rejects with "24h advance notice required." | Add a banner above grid stating the rule |
| 28 | Book for tonight? | Same 24h rule; same UX. | Same |
| 29 | What if no teachers free? | Student can book any slot; admin assigns later. **No empty-state messaging.** | Black-box feel — needs reassurance copy |
| 30 | Same teacher every time? | Server has `primary_teacher_id` + admin lock-in, **but zero student-facing UI**. | Show "Your teacher: X" once locked |

## 5. Before class

| # | Question | What the user sees today | Gap |
|---|---|---|---|
| 31 | Download anything? | Browser-native LiveKit. Not stated to user. | Add "no download required" copy |
| 32 | Works on phone? | Responsive design, but no explicit mobile reassurance. | Add mobile-friendly badge |
| 33 | Need webcam + mic? | Required, not stated pre-booking. | Add requirements list before booking |
| 34 | How do I join? | Email link (T-24h, T-1h) + dashboard "Join" button. | None |
| 35 | Join early to test? | 15-min early-join window enforced server-side; device picker available. | Window not advertised pre-class |
| 36 | Reminder before class? | Resend at T-24h + T-1h, both student & teacher. **Timezone hardcoded to Honduras** (`America/Tegucigalpa`). | Use student's timezone |

## 6. During class

| # | Question | What the user sees today | Gap |
|---|---|---|---|
| 37 | Recorded for later? | **Not built.** Marketing implies "AI summaries" but no video/audio recording. | **Launch blocker** — fix marketing or build feature |
| 38 | Internet drops? | LiveKit auto-reconnects; "Reconnecting" banner shown. | No user-facing recovery instructions |
| 39 | Teacher no-show? | **Zero handling.** No detection, no auto-refund, no support escalation. | **Critical gap** — student left stranded |
| 40 | Message teacher during class? | Yes — `ChatPanel` wired with `useChat()`, unread counter works. | None |

## 7. After class

| # | Question | What the user sees today | Gap |
|---|---|---|---|
| 41 | Where are today's notes? | Clases tab → "Summary" button opens AI summary modal (covered topics, next steps). | Falls back to "no summary" if teacher didn't fill notes |
| 42 | Will I get homework? | **Built.** `dashboard/tareas` shows assignments, submissions, scoring; teachers assign via `maestro/dashboard/tareas`. | None — confirm discoverability in onboarding |
| 43 | Rate the teacher? | **Not built.** No rating UI or schema. | Either build or hide expectation |
| 44 | Track progress over weeks? | 30-day stats (total/completed/hours) + monthly calendar. CEFR level shown elsewhere. | No level-progression timeline |

## 8. Reschedules & cancellations

| # | Question | What the user sees today | Gap |
|---|---|---|---|
| 45 | Can I reschedule? | **No student-facing reschedule for regular classes.** Teachers can request, admin approves. Placement calls reschedulable. | Critical — add student reschedule flow |
| 46 | Cancel — lose credit? | **No cancel button anywhere in student UI.** `declineBooking()` (teacher-only) restores credit. Admin can refund. | Critical — students can't self-cancel |
| 47 | What if I'm 5 min late? | 90-min late-join cap exists server-side; **never communicated.** | Add "you have 90 min to join" to email + UI |

## 9. Account & support

| # | Question | What the user sees today | Gap |
|---|---|---|---|
| 48 | Contact support? | `hola@englishkolab.com` only in error toasts + outbound emails. **No contact page.** | **Critical blocker** — no discoverable support |
| 49 | Delete my account? | Settings > Danger Zone has button, **but it's not wired** (TODO comment). | **Critical (GDPR)** — must implement |
| 50 | Change password / email? | Password: works via `/login/reset` (Supabase magic link). Email: read-only "cannot be changed." | Add email change path or "contact support" copy |

---

## Top 10 launch blockers (cross-cutting)

Ordered roughly by severity to a launching business.

1. **Teacher no-show has zero handling** (Q39) — student stranded, no auto-refund, no support path. First bad incident = chargeback + bad review.
2. **No student cancel button** (Q46) — student who can't make it has no way to free the credit; will email/chargeback.
3. **No student reschedule** (Q45) — same problem as cancel; common life event.
4. **Support contact not discoverable** (Q48) — email is buried in error toasts; no help/contact page.
5. **Delete account is fake** (Q49) — UI button does nothing. GDPR / app-store risk.
6. **Marketing promises features that don't exist** (Q37 recordings, Q43 ratings) — fix copy or build.
7. **Class duration not stated on landing** (Q12) — basic disclosure gap; users won't trust pricing.
8. **Currency selector misleads** (Q17) — shows 20 currencies but charges USD; surprise at checkout.
9. **No empty-state for "no teachers free"** (Q29) — feels like a black box after booking.
10. **Reminders ignore student timezone** (Q36) — Honduras-timezone email confusing for Mexico/Colombia students.

## Quick wins (low effort, high impact)

- Add a single `Help & contact` link in dashboard footer surfacing `hola@englishkolab.com` (fixes Q48, ~30 min).
- Banner above booking grid: "Sessions are 60 min. Book at least 24h in advance." (fixes Q12, Q27, Q28 partial, ~15 min).
- "Your teacher: X" card on dashboard once assigned (fixes Q30, ~1 hr).
- Late-join wording in confirmation email: "you can join up to 90 min after start." (fixes Q47, ~10 min copy edit).
- Reframe currency widget as "Prices shown in USD ≈ {local}" (fixes Q17, ~30 min).

## Real product work needed (not just copy)

- Student cancel + reschedule flows (Q45, Q46) — server actions + UI.
- Delete-account server action with cascade (Q49).
- Teacher no-show detection + auto-refund or escalation path (Q39).
- Decide: build recordings/ratings OR strip them from marketing (Q37, Q43).
- Per-user timezone preference + use it in reminders + booking display (Q36).

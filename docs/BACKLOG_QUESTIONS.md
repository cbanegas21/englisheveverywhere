# EnglishKolab — Pre-launch Question Backlog

Generated during 2026-04-21 planning session. 100 open questions —
50 developer-facing, 50 first-time-user-facing. Use this as the shape of
the pre-launch backlog; not every question needs answering today.

---

## 50 Developer Questions

### Architecture & scale
1. Is the Stripe webhook idempotent against duplicate events from Stripe retries?
2. Do we log webhook failures anywhere actionable?
3. Race protection when two students book the same slot simultaneously?
4. Is RLS enabled on every user-data table AND tested?
5. Can student A query student B's `payments` row via the API?
6. Is `service_role` key only used server-side (never in client bundles)?
7. What's the rollback plan for a bad prod deploy?
8. Staging/preview env or only prod?
9. Supabase backups automated — how fresh?
10. Can we point-in-time restore the DB?

### Security
11. Rate limiting on `/api/stripe/webhook`?
12. Rate limiting on `/login` to block credential stuffing?
13. Is CAPTCHA on signup to block bots?
14. Is `CRON_SECRET` actually set in Vercel prod? (Moot once cron is removed.)
15. Is 2FA enforced on admin accounts?
16. SPF/DKIM/DMARC correctly configured for `englishkolab.com`?
17. Password policy — min length, complexity rules?
18. Is the Supabase anon key safe to expose client-side (yes, if RLS is airtight — is it)?
19. Any CVE scanning on dependencies?
20. Do we have any WAF / abuse protection beyond Vercel defaults?

### Reliability & errors
21. If Anthropic API fails, does `completeSession` still save the booking + payment?
22. Do we retry failed AI summaries?
23. If Resend is down, do we queue emails or just drop?
24. LiveKit token expires mid-class — does the class survive?
25. Do transcripts persist after disconnect or die with the session?
26. What if user's Supabase JWT expires mid-booking-flow?
27. Does `decrement_classes` handle concurrent calls correctly?
28. Refund arrives but `classes_remaining` is already 0 — does it go negative?
29. Are any errors going to Sentry / Datadog / any observability tool today?
30. Do we have a public status page or uptime SLA?

### Data integrity
31. Cascade: delete student → what happens to bookings/payments/sessions?
32. Cascade: delete teacher → same question.
33. GDPR "delete my account" — documented process?
34. CCPA data export — documented process?
35. Is `sessions.transcript` ever purged (it's sensitive PII)?

### Edge cases
36. Honduras doesn't observe DST; US does. Do teacher/student time displays handle it?
37. Student in Mexico booking teacher in Honduras — each sees their local time?
38. Booking in the past: blocked?
39. Booking <24h out: blocked? (Yes per CLAUDE.md — verified?)
40. Teacher cancels 30 min before — what does student see?

### Product correctness
41. "Session recordings" marketed but not built — fix before launch?
42. Does `admin/overview` show live or stale payout totals?
43. Does webhook correctly handle legacy plan keys (`starter`/`estandar`/`intensivo`)?
44. Does refund-reversal work if user is deleted before the refund hits?
45. Does webhook verify the Stripe signature before processing?

### Ops
46. Do we paginate long booking lists or fetch all rows into memory?
47. Largest DB query — is it indexed?
48. Is `bookings.scheduled_at` indexed for the reminder scan? (Moot once cron is removed.)
49. Is email-send non-blocking even if Resend is slow?
50. Any feature flags for gradual rollouts?

---

## 50 First-Time User Questions

### Landing & trust
1. "What is this site? Is it legit?"
2. "Spanish or English — which do I click?"
3. "Who are the teachers? Real people or AI?"
4. "Where are the teachers from?"
5. "How is this different from Duolingo / italki / Preply?"
6. "Can I see sample classes before signing up?"
7. "How do I know this isn't a scam?"
8. "Is there a free trial?"
9. "Can I try before paying?"
10. "Who owns this company?"

### Pricing & plans
11. "Spark vs Drive vs Ascent vs Peak — which is for me?"
12. "Are the classes 30 min or 1 hour?"
13. "Do my unused classes expire?"
14. "Do you auto-charge me when my pack runs out?"
15. "Can I switch plans midway?"
16. "Can I get a refund if I don't like it?"
17. "Can I pay in Lempiras / Pesos / local currency?"
18. "What cards do you accept?"
19. "Is my card info safe?"
20. "What will the charge look like on my statement?"

### Signup & onboarding
21. "Do I need to verify my email?"
22. "Will I get charged right after signing up?"
23. "Do I pick a teacher or am I assigned one?"
24. "How do I take the placement test?"
25. "How long does the placement test take?"

### Booking
26. "How do I book my first class?"
27. "Can I book for today?"
28. "Can I book for tonight?"
29. "What if there are no teachers available when I want?"
30. "Can I get the same teacher every time?"

### Before class
31. "Do I need to download anything?"
32. "Does this work on my phone?"
33. "Do I need a webcam + microphone?"
34. "How do I join the call?"
35. "Can I join early to test my mic/camera?"
36. "Will I get a reminder before class?"

### During class
37. "Is the class recorded so I can review later?"
38. "What if my internet drops?"
39. "What if the teacher no-shows?"
40. "Can I message the teacher during class?"

### After class
41. "Where do I see notes from today?"
42. "Will I get homework?"
43. "Can I rate the teacher?"
44. "How do I track my progress over weeks?"

### Reschedules & cancellations
45. "I can't make it — can I reschedule?"
46. "If I cancel, do I lose the credit?"
47. "What if I'm 5 minutes late?"

### Account & support
48. "How do I contact support?"
49. "How do I delete my account?"
50. "How do I change my password / email?"

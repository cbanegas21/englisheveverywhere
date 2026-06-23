# The Lab — P1 build plan (englishKo·LAB playground)

Synthesized from an 8-agent design pass (2026-06-23) grounded in the live codebase.
Spec source: `docs/PLAN_MAESTRO.md` §5.3, §8.2–8.5. This doc = the canonical P1
architecture. The Lab is the gamified student practice surface + the teacher
Moodle-clone authoring behind it.

## Non-negotiables (carried from QA history + the B4/A11 audit)

- **Money path untouched.** Credit-neutral. NEVER call the credit RPCs
  (`increment/decrement/add_classes` — SECURITY DEFINER, EXECUTE revoked in 042/043),
  `payments`, `teacher_payouts`, or `bookings`/`sessions` completion. The only
  sanctioned overlap is *reading* `sessions.vocabulary` (already persisted by 053)
  for auto-gen — deferred to P2. QA asserts balances/payments/sessions are
  byte-identical before/after every Lab action.
- **Migration-017 template for every new table:** RLS ON, per-role SELECT-only
  policies (teacher-owns / student-target / admin-all), **ZERO** authenticated
  write policies (the migration-048 lesson — convenience write policies were
  paywall/payout holes). All writes go through gated `'use server'` actions via the
  service-role admin client after auth + role + ownership checks.
- **Two id spaces:** Lab FKs target `teachers(id)` / `students(id)` (domain ids),
  NOT `profile_id`. `profile_id` (= `auth.uid()`) appears only inside RLS predicates.
  Mixing them silently matches nothing or leaks.
- **Answer keys never reach the client.** The question bank has NO student SELECT
  policy; students see questions only via a published/assigned quiz read through the
  service-role page AFTER confirming the assignment targets them, with answer keys
  stripped. Auto-grading is server-side only (the gated-pricing `priceUsd` leak +
  no-show self-grade lessons).
- **Gentle / anti-IA is a product constraint:** no streaks/leagues/leaderboards;
  retake always allowed; score shown as "x de y aciertos", never a grade or
  "reprobaste"; short-answer with no wildcard match → `is_correct = null` (awaiting
  teacher), never auto-marked wrong; copy "si respondes con IA te engañas a ti mismo";
  everything optional.
- **#418 hydration discipline:** every time label (due / "última clase" / SRS-due /
  "just now") uses the `now = null` → `useEffect` → `now !== null` guard + am/pm
  whitespace `.replace`. The single most-fixed bug in the repo.
- **Server actions RETURN `{error}` (localized), never throw** (prod redacts thrown
  digests); raw PG errors `console.error`'d server-side, generic `saveFailed` to the
  user; end with `revalidatePath('/', 'layout')`. Re-throw only Next redirect/notFound.

## Data model — migration 054 (additive)

FKs `on delete cascade`; indexes on `(owner_id, created_at desc)`; apply via the
Supabase Management API (never `db push`/`reset`), then `pnpm gen-types` +
`pnpm dump-schema` or CI drift fails. Next free number is **054** (folder has a
`012_*` collision — numbers aren't dense; confirm 054 is free).

| Table | Purpose | SELECT policies |
|---|---|---|
| `lab_question_bank` | Teacher-private pool. ONE table, JSONB `payload` per `type` (P1: `mcq_single`, `mcq_multi`, `true_false`, `short_answer`, `matching`, `essay`). | teacher-owns, admin. **No student.** |
| `lab_quizzes` | Teacher quiz template: `title`, `intro`, `settings` jsonb (shuffle, attempts_allowed, grading_method greatest/avg/first/last, review_options), `question_ids uuid[]`, `status` draft/published/cancelled. | teacher-owns, admin. |
| `lab_quiz_assignments` | Bridge — teacher assigns a quiz to a student (`quiz_id`, `student_id`, `due_at`, `status` open/cancelled). Creating it = the quiz appears in the student's Lab. | teacher-owns, student-target, admin. |
| `lab_quiz_attempts` | Student submission: `assignment_id` UNIQUE, `questions_snapshot` jsonb (frozen so later bank edits don't mutate a live attempt), `answers` jsonb, `auto_score`, `max_score`, `teacher_feedback`, `manual_adjusted`, `submitted_at`, `graded_at`. | teacher (via assignment→quiz), student-target, admin. |
| `lab_teacher_files` | §8.4 private folder metadata; bytes in a NEW private `lab-files` bucket (clone 018 books bucket + signed-URL viewer). | teacher-owns, admin. **No student.** |
| `lab_file_shares` | §8.4 per-file share-with-one-student (`file_id`, `student_id`, UNIQUE). | teacher (via file), student-target, admin. |
| `lab_progress` | XP + "palabras dominadas" + progress rings NOW; SM-2 SRS seam (nullable `ease_factor`/`interval_days`/`repetitions`/`due_at`) for P2 — no schema change to wire SRS later (intervals only lengthen, enforced in the action). Polymorphic `(item_type, item_id)`. | student-target, admin. **No streak/league/leaderboard columns.** |

Decisions: a quiz's questions are **snapshotted** into `lab_quiz_attempts` (frozen at
assign/submit) rather than a link table, so editing the template never mutates a live
attempt. Assignment (`lab_quiz_assignments`) and submission (`lab_quiz_attempts`) are
separate, mirroring 017's `assignments` / `assignment_submissions`. The legacy
`tareas` feature (017) is **extended additively** in Step 4 (file/rubric/audio), not
forked — and the Lab feed surfaces BOTH legacy tareas and new lab assignments so
nothing is orphaned.

## Routes

Student: `/[lang]/dashboard/lab` (feed) + `/[lang]/dashboard/lab/[assignmentId]`
(quiz player) — nest under `dashboard/layout.tsx` (guard inherited), covered by proxy
`wantsStudent`, **no proxy edit**. Teacher: `/[lang]/maestro/dashboard/banco`
(question bank), `/quizzes` (builder + assign + attempt review), `/carpeta` (folder) —
inherit BOTH maestro role + `is_active` guards.

## Phased build (each step shippable, QA gate after each)

- **STEP 0 — student feed shell (ZERO schema, ZERO risk).** `/dashboard/lab`
  re-skins EXISTING data into the §8.2 card layout: *Continuar* hero, *De tu última
  clase* (reads the now-persisted `sessions.vocabulary`), *De parte de tu maestro·a*
  (existing assignments), *Para repasar* / *Juegos* = gentle "Próximamente", *Tu
  progreso* (existing CEFR/plan). + "El Lab"/"The Lab" nav entry (badge Nuevo/New) in
  both `studentNav` locales + `loading.tsx`. Lets Carlos see the feed before any DB
  change. **← start here.**
- **STEP 1 — migration 054** (7 tables) + private `lab-files` bucket + `gen-types` +
  `dump-schema`. Schema only, no behavior change. **PAUSE for Carlos's OK before
  applying to prod.**
- **STEP 2 — teacher question bank:** `/maestro/dashboard/banco` + `src/app/actions/lab.ts`
  (clone `requireTeacher`/`requireStudent` + `A_MSG`/`am` + `isUniqueViolation` +
  booking-IDOR gate from `assignments.ts`) + per-type JSONB payload validators.
- **STEP 3 — quiz engine (the core):** `/maestro/dashboard/quizzes` (build + publish +
  assign with booking-gate + attempt review) + student player + `submitQuizAttempt`
  (server-side auto-grade of objective types; short-answer no-match → teacher review)
  + `gradeQuizAttempt`. Wire the live "De parte de tu maestro·a" section.
- **STEP 4 — assignment upgrade:** extend 017 `assignments`/`assignment_submissions`
  additively (file attachment + rubric/marking-guide + audio feedback), keep gentle copy.
- **STEP 5 — teacher folder + share (§8.4):** private bucket + `/maestro/dashboard/carpeta`
  + upload/share/unshare + `getLabFileSignedUrl` (entitlement gate clones
  `getBookSignedUrl`); surface shared files read-only in the student feed.
- **STEP 6 — P1 closeout:** bilingual anti-IA copy pass, `ProgressRing`, responsive/a11y,
  full QA sweep (RLS direct-REST across all tables, IDOR escalation replay, #418 scan,
  money-path-untouched assertion). HOLD the landing-page benefits-list update (D2) for a
  separate Carlos-gated decision — do not over-promise.

## Reuse map (don't rebuild)

- `src/app/actions/assignments.ts` — `requireTeacher`/`requireStudent`, the booking-IDOR
  gate, `A_MSG`/`am`, `isUniqueViolation`, single-submission upsert, grade flow.
- `src/lib/supabase/{admin,server}.ts` — service-role for reads+writes after a gate;
  SSR client only for the auth identity check.
- Migration 018 + `getBookSignedUrl` — private bucket + signed-URL entitlement pattern
  for §8.4.
- UI: `--ek-*` tokens, `SectionHeader`/`StatLedger`/`DarkHeroCard`/`StatusBadge`/`Modal`/
  `Drawer`, `Cuaderno.Word` (flashcard), `PageLoading` (loading.tsx). New: `ProgressRing`.
- `sessions.vocabulary` (053 + `saveSessionVocab`) — already persisted; "De tu última
  clase" reads it (P1 read; haiku auto-gen of quizzes is P2).

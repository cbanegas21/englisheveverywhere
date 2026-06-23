-- ============================================================
-- MIGRATION 054: The Lab (englishKo·LAB) — P1 data model
-- ============================================================
-- The student practice surface + the teacher Moodle-clone authoring behind it.
-- Spec: docs/THE_LAB_PLAN.md / docs/PLAN_MAESTRO.md §8.2–8.5.
--
-- Pattern (cloned verbatim from migration 017): every table has RLS ON with
-- per-role SELECT-only policies (teacher-owns / student-target / admin-all) and
-- ZERO authenticated INSERT/UPDATE/DELETE policies. ALL writes go through gated
-- 'use server' actions via the service-role admin client after auth + role +
-- ownership checks. (Migration 048 dropped exactly such "convenience" write
-- policies because they were paywall/payout holes — do not reintroduce them.)
--
-- FKs target the DOMAIN ids public.teachers(id) / public.students(id), never
-- profile_id. profile_id (= auth.uid()) appears only inside RLS predicates.
-- Student predicates use public.auth_student_id() (SECURITY DEFINER, migr 035)
-- to avoid RLS recursion.
--
-- Credit-neutral: nothing here touches credits / Stripe / payouts / bookings /
-- sessions completion. Additive + idempotent; apply via the Management API.

-- ── 1. lab_question_bank — teacher-private question pool ──────────────────
-- ONE table, JSONB payload-per-type (§8.3 "una tabla, payload por tipo").
create table if not exists public.lab_question_bank (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       uuid not null references public.teachers(id) on delete cascade,
  type             text not null check (type in
                     ('mcq_single','mcq_multi','true_false','short_answer','matching','essay')),
  prompt           text not null default '',
  payload          jsonb not null default '{}'::jsonb,
  general_feedback text,
  tags             text[] not null default '{}',
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_lab_question_bank_teacher
  on public.lab_question_bank (teacher_id, created_at desc);
alter table public.lab_question_bank enable row level security;

drop policy if exists "teacher reads own lab questions" on public.lab_question_bank;
create policy "teacher reads own lab questions" on public.lab_question_bank
  for select using (
    teacher_id in (select id from public.teachers where profile_id = auth.uid())
  );
-- NO student SELECT: the bank is author-private. Students only ever see a
-- question via the frozen snapshot inside their own assigned attempt.
drop policy if exists "admin reads lab questions" on public.lab_question_bank;
create policy "admin reads lab questions" on public.lab_question_bank
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 2. lab_quizzes — teacher quiz template ───────────────────────────────
create table if not exists public.lab_quizzes (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.teachers(id) on delete cascade,
  title         text not null,
  intro         text not null default '',
  question_ids  uuid[] not null default '{}',
  settings      jsonb not null default '{}'::jsonb,
  status        text not null default 'draft' check (status in ('draft','published','cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_lab_quizzes_teacher
  on public.lab_quizzes (teacher_id, created_at desc);
alter table public.lab_quizzes enable row level security;

drop policy if exists "teacher reads own lab quizzes" on public.lab_quizzes;
create policy "teacher reads own lab quizzes" on public.lab_quizzes
  for select using (
    teacher_id in (select id from public.teachers where profile_id = auth.uid())
  );
-- NO student SELECT: a student reaches a quiz only through an assignment row;
-- the player page reads the quiz via service-role after verifying the assignment
-- targets them.
drop policy if exists "admin reads lab quizzes" on public.lab_quizzes;
create policy "admin reads lab quizzes" on public.lab_quizzes
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 3. lab_quiz_assignments — teacher → student bridge ───────────────────
-- Creating this row is how a teacher assigns a quiz; it makes the quiz appear in
-- the student's Lab. teacher_id is denormalized for a direct ownership policy
-- (mirrors 017 assignments carrying both teacher_id and student_id).
create table if not exists public.lab_quiz_assignments (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.lab_quizzes(id) on delete cascade,
  teacher_id  uuid not null references public.teachers(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  due_at      timestamptz,
  status      text not null default 'open' check (status in ('open','cancelled')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_lab_quiz_assignments_student
  on public.lab_quiz_assignments (student_id, created_at desc);
create index if not exists idx_lab_quiz_assignments_teacher
  on public.lab_quiz_assignments (teacher_id, created_at desc);
alter table public.lab_quiz_assignments enable row level security;

drop policy if exists "teacher reads own lab assignments" on public.lab_quiz_assignments;
create policy "teacher reads own lab assignments" on public.lab_quiz_assignments
  for select using (
    teacher_id in (select id from public.teachers where profile_id = auth.uid())
  );
drop policy if exists "student reads own lab assignments" on public.lab_quiz_assignments;
create policy "student reads own lab assignments" on public.lab_quiz_assignments
  for select using (student_id = public.auth_student_id());
drop policy if exists "admin reads lab assignments" on public.lab_quiz_assignments;
create policy "admin reads lab assignments" on public.lab_quiz_assignments
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 4. lab_quiz_attempts — student submission ────────────────────────────
-- One submission per assignment (UNIQUE). questions_snapshot freezes the quiz at
-- submit time so later bank/template edits never mutate a graded attempt.
create table if not exists public.lab_quiz_attempts (
  id                 uuid primary key default gen_random_uuid(),
  assignment_id      uuid not null unique references public.lab_quiz_assignments(id) on delete cascade,
  questions_snapshot jsonb not null default '[]'::jsonb,
  answers            jsonb not null default '{}'::jsonb,
  auto_score         numeric,
  max_score          numeric,
  teacher_feedback   text,
  manual_adjusted    boolean not null default false,
  submitted_at       timestamptz not null default now(),
  graded_at          timestamptz
);
create index if not exists idx_lab_quiz_attempts_assignment
  on public.lab_quiz_attempts (assignment_id);
alter table public.lab_quiz_attempts enable row level security;

drop policy if exists "teacher reads own lab attempts" on public.lab_quiz_attempts;
create policy "teacher reads own lab attempts" on public.lab_quiz_attempts
  for select using (
    assignment_id in (
      select id from public.lab_quiz_assignments where teacher_id in (
        select id from public.teachers where profile_id = auth.uid()
      )
    )
  );
drop policy if exists "student reads own lab attempts" on public.lab_quiz_attempts;
create policy "student reads own lab attempts" on public.lab_quiz_attempts
  for select using (
    assignment_id in (
      select id from public.lab_quiz_assignments where student_id = public.auth_student_id()
    )
  );
drop policy if exists "admin reads lab attempts" on public.lab_quiz_attempts;
create policy "admin reads lab attempts" on public.lab_quiz_attempts
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 5. lab_teacher_files — teacher private folder (§8.4) ──────────────────
-- Bytes live in a private 'lab-files' bucket (below); this is the metadata.
create table if not exists public.lab_teacher_files (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.teachers(id) on delete cascade,
  file_name    text not null,
  description  text not null default '',
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);
create index if not exists idx_lab_teacher_files_teacher
  on public.lab_teacher_files (teacher_id, created_at desc);
alter table public.lab_teacher_files enable row level security;

drop policy if exists "teacher reads own lab files" on public.lab_teacher_files;
create policy "teacher reads own lab files" on public.lab_teacher_files
  for select using (
    teacher_id in (select id from public.teachers where profile_id = auth.uid())
  );
-- NO student SELECT: students see a file only via a lab_file_shares row.
drop policy if exists "admin reads lab files" on public.lab_teacher_files;
create policy "admin reads lab files" on public.lab_teacher_files
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 6. lab_file_shares — per-file, per-student read-only grant (§8.4) ─────
create table if not exists public.lab_file_shares (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references public.lab_teacher_files(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  shared_at   timestamptz not null default now(),
  unique (file_id, student_id)
);
create index if not exists idx_lab_file_shares_student
  on public.lab_file_shares (student_id, shared_at desc);
alter table public.lab_file_shares enable row level security;

drop policy if exists "teacher reads own lab file shares" on public.lab_file_shares;
create policy "teacher reads own lab file shares" on public.lab_file_shares
  for select using (
    file_id in (
      select id from public.lab_teacher_files where teacher_id in (
        select id from public.teachers where profile_id = auth.uid()
      )
    )
  );
drop policy if exists "student reads own lab file shares" on public.lab_file_shares;
create policy "student reads own lab file shares" on public.lab_file_shares
  for select using (student_id = public.auth_student_id());
drop policy if exists "admin reads lab file shares" on public.lab_file_shares;
create policy "admin reads lab file shares" on public.lab_file_shares
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 7. lab_progress — gentle gamification now + SRS seam for P2 ───────────
-- XP / "palabras dominadas" / progress rings now; the SM-2 columns are nullable
-- and unused in P1 (P2 wires SM-2-lite with NO schema change — intervals only
-- lengthen, enforced in the action). NO streak/league/leaderboard columns.
create table if not exists public.lab_progress (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  item_type       text not null check (item_type in ('vocab','flashcard','quiz','assignment','lesson')),
  item_id         uuid,
  xp              integer not null default 0,
  mastered        boolean not null default false,
  ease_factor     numeric(4,2),
  interval_days   integer,
  repetitions     integer,
  due_at          timestamptz,
  last_reviewed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student_id, item_type, item_id)
);
create index if not exists idx_lab_progress_student
  on public.lab_progress (student_id, updated_at desc);
alter table public.lab_progress enable row level security;

drop policy if exists "student reads own lab progress" on public.lab_progress;
create policy "student reads own lab progress" on public.lab_progress
  for select using (student_id = public.auth_student_id());
drop policy if exists "admin reads lab progress" on public.lab_progress;
create policy "admin reads lab progress" on public.lab_progress
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── Storage: private 'lab-files' bucket (§8.4) ───────────────────────────
-- Private (clone of 018 'books'): direct URLs 404; downloads go through a
-- service-role-minted short-lived signed URL after an ownership/share gate. No
-- storage.objects policy — service-role bypasses RLS and the signed URL carries
-- its own token.
insert into storage.buckets (id, name, public)
  values ('lab-files', 'lab-files', false)
  on conflict (id) do nothing;

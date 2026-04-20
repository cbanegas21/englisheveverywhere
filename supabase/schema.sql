-- ============================================================
-- EnglishEverywhere — Full Database Schema
-- Run this in Supabase SQL Editor (once, in order)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text not null,
  avatar_url    text,
  role          text not null check (role in ('student', 'teacher', 'admin')) default 'student',
  timezone      text not null default 'America/Guatemala',
  preferred_language text not null check (preferred_language in ('es', 'en')) default 'es',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TEACHERS
-- ============================================================
create table public.teachers (
  id                  uuid primary key default uuid_generate_v4(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  bio                 text,
  specializations     text[] default '{}',
  certifications      text[] default '{}',
  hourly_rate         numeric(10,2) not null default 0,
  rating              numeric(3,2) default 5.0,
  total_sessions      integer default 0,
  stripe_account_id   text,
  is_active           boolean default true,
  created_at          timestamptz not null default now()
);

alter table public.teachers enable row level security;

create policy "Teachers are publicly visible"
  on public.teachers for select using (is_active = true);

create policy "Teachers can update own record"
  on public.teachers for update
  using (auth.uid() = profile_id);

-- ============================================================
-- STUDENTS
-- ============================================================
create table public.students (
  id                    uuid primary key default uuid_generate_v4(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  level                 text check (level in ('A1','A2','B1','B2','C1','C2')),
  classes_remaining     integer default 0,
  stripe_customer_id    text,
  placement_test_done   boolean default false,
  created_at            timestamptz not null default now()
);

alter table public.students enable row level security;

create policy "Students can view own record"
  on public.students for select
  using (auth.uid() = profile_id);

create policy "Students can update own record"
  on public.students for update
  using (auth.uid() = profile_id);

-- ============================================================
-- PLANS
-- ============================================================
create table public.plans (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  name_es             text not null,
  classes_per_month   integer not null,
  price_usd           numeric(10,2) not null,
  stripe_price_id     text,
  description         text,
  description_es      text,
  is_popular          boolean default false,
  is_active           boolean default true,
  created_at          timestamptz not null default now()
);

alter table public.plans enable row level security;
create policy "Plans are publicly visible" on public.plans for select using (is_active = true);

-- Seed plans
insert into public.plans (name, name_es, classes_per_month, price_usd, is_popular, description, description_es)
values
  ('Starter',   'Starter',   4,  39, false, '4 one-hour classes per month', '4 clases de una hora por mes'),
  ('Standard',  'Estándar',  8,  69, true,  '8 one-hour classes per month', '8 clases de una hora por mes'),
  ('Intensive', 'Intensivo', 16, 119, false, '16 one-hour classes per month', '16 clases de una hora por mes');

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table public.subscriptions (
  id                        uuid primary key default uuid_generate_v4(),
  student_id                uuid not null references public.students(id) on delete cascade,
  plan_id                   uuid not null references public.plans(id),
  stripe_subscription_id    text unique,
  status                    text not null check (status in ('active','cancelled','past_due','trialing')) default 'trialing',
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  created_at                timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Students can view own subscriptions"
  on public.subscriptions for select
  using (
    auth.uid() = (select profile_id from public.students where id = student_id)
  );

-- ============================================================
-- AVAILABILITY SLOTS (teacher weekly schedule)
-- ============================================================
create table public.availability_slots (
  id              uuid primary key default uuid_generate_v4(),
  teacher_id      uuid not null references public.teachers(id) on delete cascade,
  day_of_week     integer not null check (day_of_week between 0 and 6), -- 0=Sun, 6=Sat
  start_time      time not null,
  end_time        time not null,
  is_active       boolean default true
);

alter table public.availability_slots enable row level security;

create policy "Availability slots are publicly visible"
  on public.availability_slots for select using (is_active = true);

create policy "Teachers manage own availability"
  on public.availability_slots for all
  using (
    auth.uid() = (select profile_id from public.teachers where id = teacher_id)
  );

-- ============================================================
-- BOOKINGS
-- ============================================================
create table public.bookings (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references public.students(id) on delete cascade,
  teacher_id        uuid not null references public.teachers(id) on delete cascade,
  scheduled_at      timestamptz not null,
  duration_minutes  integer not null default 60,
  status            text not null check (status in ('pending','confirmed','completed','cancelled')) default 'pending',
  video_room_url    text,
  video_room_name   text,
  notes             text,
  student_notes     text,
  created_at        timestamptz not null default now()
);

alter table public.bookings enable row level security;

create policy "Students see own bookings"
  on public.bookings for select
  using (
    auth.uid() = (select profile_id from public.students where id = student_id)
  );

create policy "Teachers see own bookings"
  on public.bookings for select
  using (
    auth.uid() = (select profile_id from public.teachers where id = teacher_id)
  );

create policy "Students can create bookings"
  on public.bookings for insert
  with check (
    auth.uid() = (select profile_id from public.students where id = student_id)
  );

create policy "Teachers can update booking status"
  on public.bookings for update
  using (
    auth.uid() = (select profile_id from public.teachers where id = teacher_id)
  );

-- ============================================================
-- SESSIONS (after a booking is completed)
-- ============================================================
create table public.sessions (
  id              uuid primary key default uuid_generate_v4(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  started_at      timestamptz,
  ended_at        timestamptz,
  recording_url   text,
  teacher_notes   text,
  student_rating  integer check (student_rating between 1 and 5),
  student_review  text,
  created_at      timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "Session participants can view"
  on public.sessions for select
  using (
    auth.uid() in (
      select p.profile_id from public.students p
      join public.bookings b on b.student_id = p.id
      where b.id = booking_id
      union
      select t.profile_id from public.teachers t
      join public.bookings b on b.teacher_id = t.id
      where b.id = booking_id
    )
  );

-- ============================================================
-- PAYMENTS
-- ============================================================
create table public.payments (
  id                          uuid primary key default uuid_generate_v4(),
  booking_id                  uuid references public.bookings(id),
  student_id                  uuid not null references public.students(id),
  teacher_id                  uuid not null references public.teachers(id),
  amount_usd                  numeric(10,2) not null,
  platform_fee_usd            numeric(10,2) not null,
  teacher_payout_usd          numeric(10,2) not null,
  stripe_payment_intent_id    text unique,
  stripe_transfer_id          text,
  status                      text not null check (status in ('pending','completed','failed','refunded')) default 'pending',
  created_at                  timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "Students see own payments"
  on public.payments for select
  using (
    auth.uid() = (select profile_id from public.students where id = student_id)
  );

create policy "Teachers see own payments"
  on public.payments for select
  using (
    auth.uid() = (select profile_id from public.teachers where id = teacher_id)
  );

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_bookings_student on public.bookings(student_id);
create index idx_bookings_teacher on public.bookings(teacher_id);
create index idx_bookings_scheduled_at on public.bookings(scheduled_at);
create index idx_availability_teacher on public.availability_slots(teacher_id);
create index idx_payments_student on public.payments(student_id);
create index idx_payments_teacher on public.payments(teacher_id);

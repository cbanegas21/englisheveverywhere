-- ============================================================
-- MIGRATION 018: Library books — in-platform viewer, no download
-- ============================================================
-- Bug #33: students need to read books inside the platform without a
-- downloadable copy. This migration adds:
--   • storage bucket `books` (private — no public access)
--   • public.library_books table (metadata catalog)
--   • RLS: any authenticated user can read the catalog (SELECT)
--   • Writes go through the service-role admin client from server actions.
--
-- Viewer model: server action mints a short-lived signed URL (~15 min)
-- which is served into an iframe with Chrome's PDF toolbar hidden. Not
-- cryptographic DRM — it's a deterrent against casual downloads. Anyone
-- running devtools can still grab the signed URL before it expires.

-- Bucket — private so direct URLs 404 without a signed token.
insert into storage.buckets (id, name, public)
  values ('books', 'books', false)
  on conflict (id) do nothing;

-- Book catalog.
create table if not exists public.library_books (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text not null default '',
  level         text check (level is null or level in ('A1','A2','B1','B2','C1','C2','all')),
  storage_path  text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_library_books_active
  on public.library_books (created_at desc)
  where is_active = true;

alter table public.library_books enable row level security;

drop policy if exists "auth reads active library books" on public.library_books;
create policy "auth reads active library books" on public.library_books
  for select
  to authenticated
  using (is_active = true);

-- storage.objects — no authenticated policy; service-role bypasses RLS to
-- generate signed URLs, and the signed URL contains its own auth token.

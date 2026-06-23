-- 053_session_vocabulary.sql
-- Persist the AI "cuaderno" vocabulary that is extracted live during a class
-- (extractLiveVocab → CuadernoVocabItem[] {word, translation, example}). Until
-- now this was generated every ~30s and shown in the room sidebar, then thrown
-- away on unmount. We now snapshot it on End Class (mirrors the transcript) so the
-- student can review the new words afterward in their class history (Cuaderno).
--
-- Stored as JSONB (an array of {word, translation, example} objects). Written
-- ONLY via the service-role admin client in saveSessionVocab (teacher-gated),
-- exactly like transcript — the existing sessions RLS is read-only (no per-user
-- write policy), so no policy change is needed.

alter table public.sessions
  add column if not exists vocabulary jsonb,
  add column if not exists vocabulary_captured_at timestamptz;

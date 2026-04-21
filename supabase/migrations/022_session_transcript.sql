-- 022_session_transcript.sql
-- Stores the class transcript on the sessions row. Produced either by a live
-- captioner during the class (see Bug #18 live transcript panel) or by a
-- post-call transcription job. Kept as plain text for display; structured
-- per-speaker transcripts can be stored as JSON in the same column later.

alter table sessions
  add column if not exists transcript text,
  add column if not exists transcript_captured_at timestamptz;

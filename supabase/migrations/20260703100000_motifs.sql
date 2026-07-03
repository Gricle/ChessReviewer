-- Fulfils the "motif tags ... intentionally deferred to Phase 5" NOTE on
-- public.move_facts in 20260702000000_init.sql.
alter table public.move_facts add column motifs text[] not null default '{}';

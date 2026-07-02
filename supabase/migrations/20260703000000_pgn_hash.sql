-- NOTE: shipped before first provisioning (no rows exist), so no backfill needed;
-- if applying to a DB with existing games, re-analyzed pre-migration games cannot
-- sync until pgn_hash is healed (see uploadReview fallback).
-- Client-computed djb2 hash of the pgn, so the duplicate-game lookup can be
-- an indexed equality instead of shipping the whole PGN in a query string.
alter table public.games add column pgn_hash text;
create index games_user_pgnhash_idx on public.games (user_id, pgn_hash);
-- (games_user_pgn_uniq on md5(pgn) remains the server-side dedup authority.)

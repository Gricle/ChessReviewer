-- Deferred from Phase 2a review: reviews had no user_id index; the trend
-- query filters reviews by user, and the auth.users cascade benefits too.
create index reviews_user_idx on public.reviews (user_id);

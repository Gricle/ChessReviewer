// Writes one ReviewUpload to Postgres: games (insert-or-find by unique
// (user_id, md5(pgn))), reviews (upsert), move_facts (replace).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReviewUpload } from './mapReview';

const UNIQUE_VIOLATION = '23505';

export async function uploadReview(
  client: SupabaseClient,
  userId: string,
  u: ReviewUpload,
): Promise<void> {
  let gameId: string;
  const inserted = await client
    .from('games')
    .insert({ ...u.game, user_id: userId })
    .select('id')
    .single();

  if (inserted.error) {
    if (inserted.error.code !== UNIQUE_VIOLATION) throw new Error(inserted.error.message);
    // Same user re-analyzed the same PGN — find the existing row by hash
    // instead of shipping the whole PGN in the query. djb2 collisions on
    // different games for the same user are ~10^-6; the fallout of one is
    // overwriting the collided game's review, which is an acceptable
    // trade-off for avoiding huge PGNs in every dedup lookup.
    const found = await client
      .from('games')
      .select('id')
      .eq('user_id', userId)
      .eq('pgn_hash', u.game.pgn_hash)
      .limit(1)
      .single();
    if (found.error) throw new Error(found.error.message);
    gameId = found.data.id;
  } else {
    gameId = inserted.data.id;
  }

  const review = await client
    .from('reviews')
    .upsert({ ...u.review, game_id: gameId, user_id: userId });
  if (review.error) throw new Error(review.error.message);

  const cleared = await client.from('move_facts').delete().eq('game_id', gameId);
  if (cleared.error) throw new Error(cleared.error.message);

  const facts = await client
    .from('move_facts')
    .insert(u.move_facts.map((m) => ({ ...m, game_id: gameId, user_id: userId })));
  if (facts.error) throw new Error(facts.error.message);
}

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
    // Same user re-analyzed the same PGN — find the existing row.
    const found = await client
      .from('games')
      .select('id')
      .eq('user_id', userId)
      .eq('pgn', u.game.pgn)
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

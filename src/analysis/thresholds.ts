// All thresholds are in win% drop (0..100), tuned against sample games.
export const WIN_DROP = {
  best: 2,        // < 2  -> best (when not literally the engine move)
  excellent: 5,   // < 5  -> excellent
  good: 10,       // < 10 -> good
  inaccuracy: 15, // < 15 -> inaccuracy
  mistake: 25,    // < 25 -> mistake; >= 25 -> blunder
};

// "Great" = found the only good move.
export const GREAT_GAP_CP = 150;     // best must beat 2nd-best by this many cp
export const GREAT_MIN_WIN = 25;     // only meaningful in roughly balanced/better spots
export const GREAT_MAX_WIN = 90;

// "Brilliant" = best move that sacrifices material while staying winning.
export const BRILLIANT_MIN_SAC = 2;  // pawns of material net given up (after best reply)
export const BRILLIANT_MIN_WIN_AFTER = 50;
export const BRILLIANT_MAX_DROP = 2; // win% drop must stay tiny

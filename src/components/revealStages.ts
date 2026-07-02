// Stage timeline for the results reveal. Each stage shows its section and
// schedules the next one; 'done' holds until the user starts the review.
export const REVEAL_STAGES = ['enter', 'accuracy', 'ratings', 'badges', 'done'] as const;
export type RevealStage = (typeof REVEAL_STAGES)[number];

export const STAGE_MS: Record<Exclude<RevealStage, 'done'>, number> = {
  enter: 500,
  accuracy: 1500,
  ratings: 900,
  badges: 1000,
};

export function nextStage(stage: RevealStage): RevealStage {
  const i = REVEAL_STAGES.indexOf(stage);
  return REVEAL_STAGES[Math.min(i + 1, REVEAL_STAGES.length - 1)];
}

/** Has `stage` reached (or passed) `target` in the timeline? */
export function stageReached(stage: RevealStage, target: RevealStage): boolean {
  return REVEAL_STAGES.indexOf(stage) >= REVEAL_STAGES.indexOf(target);
}

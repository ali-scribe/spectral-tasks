// Pure Ghost_Companion decision logic and messages (REQ-GHOST-01).
//
// This module only decides which completion reaction applies and supplies the
// message text. The reducer owns the ghost state machine and the once-per-day
// guard (Task 7); the animation timing lives in the component (Task 11).

import { DAILY_GOAL } from './constants.ts';

/** Short themed messages shown by the Ghost_Companion (AC-GHOST-01.1/.2/.3). */
export const GHOST_MESSAGES = {
  idle: 'The ghost drifts quietly, waiting.',
  summon: 'A new spirit has been summoned.',
  celebrate: 'A spirit is released. Well done.',
  goal: "Daily goal reached. The manor grows brighter tonight.",
} as const;

export interface CompletionReactionInput {
  /** Daily_Progress before the completion is applied. */
  progressBefore: number;
  /** Daily_Progress after the completion is applied. */
  progressAfter: number;
  /** The stored celebration date, or null. */
  lastGoalCelebrationDate: string | null;
  /** Local_Today in effect at the moment of completion. */
  today: string;
}

/**
 * Decides the reaction for a Task completion (AC-GHOST-01.2, .3, .8).
 *
 * Returns 'goal' only when this completion raises Daily_Progress from below the
 * Daily_Goal to at or above it AND the goal has not already been celebrated
 * today. Otherwise returns 'ordinary'. This is the sole trigger for the
 * daily-goal celebration, which replaces the ordinary reaction (AC-GHOST-01.16).
 */
export function decideCompletionReaction(i: CompletionReactionInput): 'goal' | 'ordinary' {
  const reachesGoalNow = i.progressBefore < DAILY_GOAL && i.progressAfter >= DAILY_GOAL;
  const notYetCelebratedToday = i.lastGoalCelebrationDate !== i.today;
  return reachesGoalNow && notYetCelebratedToday ? 'goal' : 'ordinary';
}

// Pure Manor progression logic (REQ-MANOR-01).
//
// The Manor_Stage is a pure function of the number of currently existing
// Completed_Tasks, so reopening or deleting a completed Task lowers the count
// and the manor regresses (AC-MANOR-01.1, .5, .12).

import type { ManorStageId } from './types.ts';
import { MANOR_STAGES } from './constants.ts';

/**
 * Highest Manor_Stage whose threshold is at most `n` (AC-MANOR-01.1, .2).
 * Negative counts are clamped to stage 0. Monotonic by construction
 * (AC-MANOR-01.9).
 */
export function getManorStage(n: number): ManorStageId {
  const count = n < 0 ? 0 : n;
  let stage: ManorStageId = MANOR_STAGES[0]!.id;
  for (const s of MANOR_STAGES) {
    if (count >= s.min) {
      stage = s.id;
    } else {
      break;
    }
  }
  return stage;
}

/**
 * Name of the next stage and how many more Completed_Tasks are needed to reach
 * it, or null when already at the top stage (AC-MANOR-01.7, .8).
 */
export function getNextStageInfo(n: number): { name: string; remaining: number } | null {
  const count = n < 0 ? 0 : n;
  const current = getManorStage(count);
  const next = MANOR_STAGES.find((s) => s.id === current + 1);
  if (!next) {
    return null;
  }
  return { name: next.name, remaining: next.min - count };
}

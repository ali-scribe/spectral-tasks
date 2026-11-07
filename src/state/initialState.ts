// Builds the initial AppState from a storage LoadResult and the current
// Local_Today. Performs the Silent_Goal_Record on load without playing the
// Daily_Goal_Celebration (AC-GHOST-01.10, EC-25). Never sets manorNotice on
// load (AC-MANOR-01.11).

import type { AppState } from '../domain/types.ts';
import { DAILY_GOAL } from '../domain/constants.ts';
import { countCompletedOn } from '../domain/selectors.ts';
import { GHOST_MESSAGES } from '../domain/ghost.ts';
import type { LoadResult } from '../storage/storageService.ts';

export function createInitialState(load: LoadResult, today: string): AppState {
  // Silent_Goal_Record: if the goal is already met today, record the date so the
  // celebration will not fire later today, but do not play it now.
  let lastGoalCelebrationDate = load.lastGoalCelebrationDate;
  const progressToday = countCompletedOn(load.tasks, today);
  if (progressToday >= DAILY_GOAL && lastGoalCelebrationDate !== today) {
    lastGoalCelebrationDate = today;
  }

  return {
    tasks: load.tasks,
    lastGoalCelebrationDate,
    today,
    storageMode: load.storageMode,
    notices: load.notices,
    ghost: { kind: 'idle', message: GHOST_MESSAGES.idle, seq: 0 },
    announcement: null,
    manorNotice: null,
    ui: {
      view: 'today',
      filters: { search: '', category: 'all', priority: 'all' },
      editingId: null,
    },
  };
}

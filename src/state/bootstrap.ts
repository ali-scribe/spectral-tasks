// Startup sequence shared by main.tsx and the integration-test helper: load
// storage once (running corruption recovery if needed), build the initial state
// and capture the snapshot that was actually read, so a load-time
// Silent_Goal_Record is persisted (design D4, AC-PERS-01.2).

import type { AppState, Task } from '../domain/types.ts';
import { toLocalDateString, type Clock } from '../domain/dates.ts';
import { loadStorage, type StorageLike } from '../storage/storageService.ts';
import { createInitialState } from './initialState.ts';

export interface Bootstrap {
  initialState: AppState;
  loadedSnapshot: { tasks: Task[]; date: string | null };
}

export function bootstrapFromStorage(storage: StorageLike | null, clock: Clock): Bootstrap {
  const load = loadStorage(storage);
  const initialState = createInitialState(load, toLocalDateString(clock()));
  const loadedSnapshot = { tasks: load.tasks, date: load.lastGoalCelebrationDate };
  return { initialState, loadedSnapshot };
}

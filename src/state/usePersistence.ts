// Writes tasks and the celebration date to storage after state changes
// (AC-PERS-01.1). It runs as an effect so the state update and render happen
// first; persistence never blocks a task operation (AC-GHOST-01.18, 18.6).

import { useEffect, useRef } from 'react';
import type { Task } from '../domain/types.ts';
import { useAppState, useAppDispatch } from './AppContext.tsx';
import { saveEnvelope, type StorageLike } from '../storage/storageService.ts';

interface Snapshot {
  tasks: Task[];
  date: string | null;
}

/**
 * Persists on changes to tasks or the celebration date. Writes only when the
 * values differ from the last loaded-or-saved snapshot, which also covers a
 * Silent_Goal_Record made at initialization (so the recorded date, which
 * differs from what was on disk, is written on the first effect). Skips
 * entirely unless the storage mode is 'normal' (read-only and memory-only
 * perform no writes).
 *
 * `loadedSnapshot` seeds the ref with what was actually read from storage. When
 * omitted, the current state seeds it, which suppresses the first write.
 */
export function usePersistence(storage: StorageLike | null, loadedSnapshot?: Snapshot): void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const last = useRef<Snapshot>(
    loadedSnapshot ?? { tasks: state.tasks, date: state.lastGoalCelebrationDate },
  );

  useEffect(() => {
    if (state.storageMode !== 'normal') {
      // Keep the snapshot current so a later return to normal does not write a
      // stale value; but in this MVP mode never returns to normal.
      last.current = { tasks: state.tasks, date: state.lastGoalCelebrationDate };
      return;
    }
    const unchanged =
      last.current.tasks === state.tasks && last.current.date === state.lastGoalCelebrationDate;
    if (unchanged) {
      return;
    }
    const result = saveEnvelope(storage, state.tasks, state.lastGoalCelebrationDate);
    // Update the snapshot optimistically; on quota the change stays in memory
    // and a later change will retry because the snapshot still differs from the
    // persisted bytes only logically, so we keep the attempted values.
    last.current = { tasks: state.tasks, date: state.lastGoalCelebrationDate };
    dispatch({ type: 'PERSIST_RESULT', result });
  }, [state.tasks, state.lastGoalCelebrationDate, state.storageMode, storage, dispatch]);
}

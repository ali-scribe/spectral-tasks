import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppProvider, useAppDispatch } from './AppContext.tsx';
import { usePersistence } from './usePersistence.ts';
import { createInitialState } from './initialState.ts';
import type { Action } from './actions.ts';
import type { AppState } from '../domain/types.ts';
import type { LoadResult, StorageLike } from '../storage/storageService.ts';
import { STORAGE_KEY } from '../storage/storageService.ts';
import { serializeEnvelope } from '../storage/envelope.ts';
import { createFakeStorage } from '../test/fakeStorage.ts';

const TODAY = '2026-06-15';
const nowIso = new Date(2026, 5, 15, 12, 0, 0).toISOString();

const validInput = {
  title: 'Spirit',
  description: '',
  category: 'Study' as const,
  priority: 'High' as const,
  dueDate: null,
  estimatedMinutes: null,
};

// A tiny harness: renders usePersistence and exposes dispatch so tests can
// drive reducer actions.
function renderPersistence(load: LoadResult, storage: StorageLike | null) {
  let dispatch: React.Dispatch<Action> = () => {};
  function Harness(): null {
    dispatch = useAppDispatch();
    usePersistence(storage, { tasks: load.tasks, date: load.lastGoalCelebrationDate });
    return null;
  }
  const initialState: AppState = createInitialState(load, TODAY);
  function Wrapper({ children }: { children: ReactNode }) {
    return <AppProvider initialState={initialState}>{children}</AppProvider>;
  }
  render(
    <Wrapper>
      <Harness />
    </Wrapper>,
  );
  return { dispatch: (a: Action) => act(() => dispatch(a)) };
}

const normalLoad: LoadResult = { tasks: [], lastGoalCelebrationDate: null, storageMode: 'normal', notices: [] };

describe('usePersistence (AC-PERS-01.1)', () => {
  it('does not write the just-loaded state, then writes once on a change', () => {
    const storage = createFakeStorage();
    const { dispatch } = renderPersistence(normalLoad, storage);
    expect(storage.setCalls()).toHaveLength(0); // no write for the loaded state
    dispatch({ type: 'CREATE_TASK', input: validInput, id: 'a', nowIso });
    expect(storage.setCalls()).toHaveLength(1);
    expect(storage.setCalls()[0]!.key).toBe(STORAGE_KEY);
  });

  it('read-only mode never writes', () => {
    const storage = createFakeStorage();
    const readOnly: LoadResult = { ...normalLoad, storageMode: 'readOnly' };
    const { dispatch } = renderPersistence(readOnly, storage);
    dispatch({ type: 'CREATE_TASK', input: validInput, id: 'a', nowIso });
    expect(storage.setCalls()).toHaveLength(0);
  });

  it('quota keeps the change in memory with an error notice; a later change retries', () => {
    const storage = createFakeStorage({ throwOnSet: true, setErrorKind: 'quota' });
    const { dispatch } = renderPersistence(normalLoad, storage);
    dispatch({ type: 'CREATE_TASK', input: validInput, id: 'a', nowIso });
    // Attempted a write.
    expect(storage.setCalls()).toHaveLength(1);
    // A second, different change attempts another write (retry).
    dispatch({ type: 'CREATE_TASK', input: validInput, id: 'b', nowIso });
    expect(storage.setCalls()).toHaveLength(2);
  });

  it('a non-quota failure switches to memory-only with a persistent notice', () => {
    const storage = createFakeStorage({ throwOnSet: true, setErrorKind: 'generic' });
    const { dispatch } = renderPersistence(normalLoad, storage);
    dispatch({ type: 'CREATE_TASK', input: validInput, id: 'a', nowIso });
    // After the unavailable result switches to memory-only, a further change does
    // not attempt another write.
    const before = storage.setCalls().length;
    dispatch({ type: 'CREATE_TASK', input: validInput, id: 'b', nowIso });
    expect(storage.setCalls().length).toBe(before);
  });

  it('persists a Silent_Goal_Record made at initialization', () => {
    // Load with three completed today but no stored celebration date: the initial
    // state records it, and the first effect should persist that difference.
    const completed = [0, 1, 2].map((i) => ({
      id: `c${i}`,
      title: `C${i}`,
      description: '',
      category: 'Study' as const,
      priority: 'Medium' as const,
      status: 'completed' as const,
      dueDate: null,
      estimatedMinutes: null,
      source: 'user' as const,
      createdAt: nowIso,
      completedAt: nowIso,
    }));
    const storage = createFakeStorage();
    // Simulate what loadStorage would return: tasks present, date null.
    const load: LoadResult = { tasks: completed, lastGoalCelebrationDate: null, storageMode: 'normal', notices: [] };
    renderPersistence(load, storage);
    // The initial state sets lastGoalCelebrationDate to TODAY, which differs from
    // the loaded null, so a write occurs with the recorded date.
    const writes = storage.setCalls();
    expect(writes).toHaveLength(1);
    expect(writes[0]!.value).toBe(serializeEnvelope(completed, TODAY));
  });
});

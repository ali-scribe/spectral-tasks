import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppProvider, useAppState } from './AppContext.tsx';
import { useDateChangeCheck } from './useDateChangeCheck.ts';
import { createInitialState } from './initialState.ts';
import type { Clock } from '../domain/dates.ts';
import type { LoadResult } from '../storage/storageService.ts';

const emptyLoad: LoadResult = { tasks: [], lastGoalCelebrationDate: null, storageMode: 'normal', notices: [] };

// A mutable clock the test advances explicitly.
let current = new Date(2026, 5, 15, 23, 59, 0); // 2026-06-15 23:59 local
const clock: Clock = () => new Date(current.getTime());

function renderHook() {
  let today = '';
  function Harness(): null {
    today = useAppState().today;
    useDateChangeCheck();
    return null;
  }
  const initialState = createInitialState(emptyLoad, '2026-06-15');
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProvider initialState={initialState} clock={clock}>
        {children}
      </AppProvider>
    );
  }
  const utils = render(
    <Wrapper>
      <Harness />
    </Wrapper>,
  );
  return { getToday: () => today, unmount: utils.unmount };
}

beforeEach(() => {
  vi.useFakeTimers();
  current = new Date(2026, 5, 15, 23, 59, 0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useDateChangeCheck (AC-DATE-01.8 to .13)', () => {
  it('the midnight timer fires and updates today (EC-5)', () => {
    const { getToday } = renderHook();
    expect(getToday()).toBe('2026-06-15');
    // Advance the clock past local midnight, then fire the scheduled timer.
    act(() => {
      current = new Date(2026, 5, 16, 0, 0, 1);
      vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes, past the 1-minute delay
    });
    expect(getToday()).toBe('2026-06-16');
  });

  it('a visibility change on a new day updates today (EC-30)', () => {
    const { getToday } = renderHook();
    act(() => {
      current = new Date(2026, 5, 17, 10, 0, 0);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(getToday()).toBe('2026-06-17');
  });

  it('a window focus event triggers a check', () => {
    const { getToday } = renderHook();
    act(() => {
      current = new Date(2026, 5, 18, 8, 0, 0);
      window.dispatchEvent(new Event('focus'));
    });
    expect(getToday()).toBe('2026-06-18');
  });

  it('an early timer with no date change is a no-op and re-arms', () => {
    const { getToday } = renderHook();
    // Fire the timer but keep the clock on the same day: today stays, no crash.
    act(() => {
      current = new Date(2026, 5, 15, 23, 59, 59);
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(getToday()).toBe('2026-06-15');
    // The timer re-armed; a later real crossing still works.
    act(() => {
      current = new Date(2026, 5, 16, 0, 0, 1);
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    });
    expect(getToday()).toBe('2026-06-16');
  });

  it('never uses setInterval', () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    const { unmount } = renderHook();
    unmount();
    expect(spy).not.toHaveBeenCalled();
  });

  it('removes its listeners on unmount', () => {
    const removeDoc = vi.spyOn(document, 'removeEventListener');
    const removeWin = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook();
    unmount();
    expect(removeDoc).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(removeWin).toHaveBeenCalledWith('focus', expect.any(Function));
  });
});

// Detects a Local_Today change while the app stays open, without polling
// (AC-DATE-01.8 to .13). Triggers on: the document becoming visible, the window
// regaining focus, and a single setTimeout scheduled for the next local
// midnight. Each check dispatches DATE_CHECK and re-arms the midnight timer.

import { useEffect, useRef } from 'react';
import { useAppDispatch, useClock } from './AppContext.tsx';
import { toLocalDateString, msUntilNextLocalMidnight } from '../domain/dates.ts';

export function useDateChangeCheck(): void {
  const dispatch = useAppDispatch();
  const clock = useClock();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Keep exactly one midnight timer alive; re-arm it after every check so a
    // throttled or early-firing timer self-corrects.
    const scheduleMidnight = (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      const delay = msUntilNextLocalMidnight(clock());
      timerRef.current = setTimeout(() => {
        runCheck();
      }, delay);
    };

    const runCheck = (): void => {
      dispatch({ type: 'DATE_CHECK', today: toLocalDateString(clock()) });
      scheduleMidnight();
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        runCheck();
      }
    };
    const onFocus = (): void => {
      runCheck();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    scheduleMidnight();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [dispatch, clock]);
}

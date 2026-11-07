// Integration-test helper that mirrors the main.tsx bootstrap: read storage via
// the shared bootstrap function, then render StrictMode > ErrorBoundary >
// AppProvider > App. Calling it again with the same storage is a true remount:
// it re-reads storage and builds fresh state (nothing carries over in memory).

import { StrictMode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import App from '../App.tsx';
import { AppProvider } from '../state/AppContext.tsx';
import { bootstrapFromStorage } from '../state/bootstrap.ts';
import { ErrorBoundary } from '../components/layout/ErrorBoundary.tsx';
import type { StorageLike } from '../storage/storageService.ts';
import type { Clock } from '../domain/dates.ts';

/** Fixed clock: noon on 2026-06-15 local time (Local_Today = "2026-06-15"). */
export const fixedClock: Clock = () => new Date(2026, 5, 15, 12, 0, 0);

export function mountApp(storage: StorageLike | null, clock: Clock = fixedClock): RenderResult {
  const { initialState, loadedSnapshot } = bootstrapFromStorage(storage, clock);
  return render(
    <StrictMode>
      <ErrorBoundary>
        <AppProvider initialState={initialState} clock={clock}>
          <App storage={storage} loadedSnapshot={loadedSnapshot} />
        </AppProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Global stylesheets are imported at the entry point so the design tokens, base
// styles and layout always load regardless of which components render.
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/manor.css';
import './styles/motion.css';
import App from './App.tsx';
import { AppProvider } from './state/AppContext.tsx';
import { ErrorBoundary } from './components/layout/ErrorBoundary.tsx';
import { bootstrapFromStorage } from './state/bootstrap.ts';
import type { StorageLike } from './storage/storageService.ts';
import { systemClock } from './domain/dates.ts';

// Load storage exactly once, before rendering, so the corruption-recovery side
// effects never run twice under StrictMode (design D4). Access to
// window.localStorage can itself throw (for example when cookies are blocked),
// so it is guarded and treated as unavailable storage.
function getStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = getStorage();
const { initialState, loadedSnapshot } = bootstrapFromStorage(storage, systemClock);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider initialState={initialState} clock={systemClock}>
        <App storage={storage} loadedSnapshot={loadedSnapshot} />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);

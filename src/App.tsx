import type { Task } from './domain/types.ts';
import type { StorageLike } from './storage/storageService.ts';
import { usePersistence } from './state/usePersistence.ts';
import { useDateChangeCheck } from './state/useDateChangeCheck.ts';
import { SkipLink } from './components/layout/SkipLink.tsx';
import { AppHeader } from './components/layout/AppHeader.tsx';
import { NoticeBar } from './components/layout/NoticeBar.tsx';
import { LiveRegions } from './components/layout/LiveRegions.tsx';
import { Dashboard } from './components/dashboard/Dashboard.tsx';
import { CreateTaskPanel } from './components/tasks/CreateTaskPanel.tsx';
import { TaskBrowser } from './components/tasks/TaskBrowser.tsx';
import { TaskFormDialog } from './components/tasks/TaskFormDialog.tsx';

interface AppProps {
  /** Storage handle for persistence (null when unavailable). */
  storage: StorageLike | null;
  /** The snapshot actually read from storage, so a load-time Silent_Goal_Record persists. */
  loadedSnapshot: { tasks: Task[]; date: string | null };
}

/**
 * Application shell: landmarks, skip link, header, notices and live regions.
 * The dashboard and task columns are filled in by later tasks; the aside and
 * main sections are present now as the layout frame.
 */
export default function App({ storage, loadedSnapshot }: AppProps): JSX.Element {
  usePersistence(storage, loadedSnapshot);
  useDateChangeCheck();

  return (
    <div className="app-shell">
      <SkipLink />
      <AppHeader />
      <NoticeBar />
      <LiveRegions />
      <main id="main" className="app-main" tabIndex={-1}>
        <aside aria-label="Manor and progress">
          <Dashboard />
          <CreateTaskPanel />
        </aside>
        <section aria-label="Spirits">
          <TaskBrowser />
        </section>
      </main>
      <TaskFormDialog />
    </div>
  );
}

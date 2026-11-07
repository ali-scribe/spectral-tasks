import { useMemo, useState } from 'react';
import type { Task } from '../../domain/types.ts';
import { useAppState, useAppDispatch, useClock } from '../../state/AppContext.tsx';
import { toLocalDateString } from '../../domain/dates.ts';
import { getViewTasks, applyFilters, compareActive } from '../../domain/selectors.ts';
import { ViewNav } from './ViewNav.tsx';
import { FilterBar } from './FilterBar.tsx';
import { TaskList } from './TaskList.tsx';
import { EmptyState } from './EmptyState.tsx';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';

/**
 * The right-column task browser (REQ-ORG-01/02/03). Selects the current View,
 * applies the active filters, sorts active Views with compareActive, and shows
 * the appropriate empty-state message. Complete/reopen, edit and delete are
 * wired to the reducer; delete opens a confirmation dialog.
 */
export function TaskBrowser(): JSX.Element {
  const { tasks, today, ui } = useAppState();
  const dispatch = useAppDispatch();
  const clock = useClock();
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  const { view, filters } = ui;

  // Derived list: view -> filters -> sort. Completed view is already ordered by
  // completion timestamp inside getViewTasks; active views sort with
  // compareActive. Memoized on the inputs that affect the result.
  const { visible, viewHasTasks } = useMemo(() => {
    const inView = getViewTasks(tasks, view, today);
    const filtered = applyFilters(inView, filters);
    const sorted = view === 'completed' ? filtered : [...filtered].sort(compareActive);
    return { visible: sorted, viewHasTasks: inView.length > 0 };
  }, [tasks, view, today, filters]);

  const toggle = (task: Task) => {
    if (task.status === 'completed') {
      dispatch({ type: 'REOPEN_TASK', id: task.id });
    } else {
      dispatch({
        type: 'COMPLETE_TASK',
        id: task.id,
        nowIso: clock().toISOString(),
        today: toLocalDateString(clock()),
      });
    }
  };

  const edit = (task: Task) => dispatch({ type: 'OPEN_EDIT', id: task.id });

  const confirmDelete = () => {
    if (pendingDelete) {
      dispatch({ type: 'DELETE_TASK', id: pendingDelete.id });
      setPendingDelete(null);
    }
  };

  return (
    <div className="task-browser">
      {/* Gives the Spirits region a heading (design: sections have h2 headings). */}
      <h2 className="visually-hidden">Your spirits</h2>
      <ViewNav />
      <FilterBar />

      {visible.length === 0 ? (
        <EmptyState view={view} noMatches={viewHasTasks} />
      ) : (
        <TaskList
          tasks={visible}
          today={today}
          onToggle={toggle}
          onEdit={edit}
          onDelete={(task) => setPendingDelete(task)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Banish this spirit?"
          message={`This will permanently delete "${pendingDelete.title}".`}
          confirmLabel="Banish"
          tone="danger"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

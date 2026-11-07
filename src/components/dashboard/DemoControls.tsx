import { useState } from 'react';
import { ArrowRight, Sparkles, Trash2 } from 'lucide-react';
import { useAppState, useAppDispatch, useClock } from '../../state/AppContext.tsx';
import { createId } from '../../domain/ids.ts';
import { toLocalDateString } from '../../domain/dates.ts';
import { createDemoTasks } from '../../domain/demo.ts';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';

/**
 * Welcoming empty state and demo-data controls (REQ-DASH-01). "Load demo data"
 * shows only when there are zero tasks (AC-DASH-01.6); "Remove demo data" shows
 * whenever any task has source "demo" and confirms before removing, deleting
 * only demo-sourced tasks (AC-DASH-01.9, .11).
 */
export function DemoControls(): JSX.Element {
  const { tasks } = useAppState();
  const dispatch = useAppDispatch();
  const clock = useClock();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const isEmpty = tasks.length === 0;
  const hasDemo = tasks.some((t) => t.source === 'demo');

  const loadDemo = () => {
    const today = toLocalDateString(clock());
    const demo = createDemoTasks(today, clock().toISOString(), createId);
    dispatch({ type: 'LOAD_DEMO', tasks: demo });
  };

  // The welcome points at the create form: move focus to its title field
  // (the form sits beside the dashboard on wide screens and right below it on
  // phones). Focusing also scrolls it into view.
  const focusCreateForm = () => {
    document.getElementById('create-title')?.focus();
  };

  const removeDemo = () => {
    dispatch({ type: 'REMOVE_DEMO' });
    setConfirmingRemove(false);
  };

  return (
    <div className="demo-controls">
      {isEmpty && (
        <div className="empty-welcome">
          <p>The manor stands silent. Summon your first spirit to begin its restoration.</p>
          <button type="button" className="btn btn--primary" onClick={focusCreateForm}>
            <ArrowRight className="empty-welcome__arrow" size={16} aria-hidden="true" />
            Summon your first spirit
          </button>
          <button type="button" className="btn" onClick={loadDemo}>
            <Sparkles size={16} aria-hidden="true" />
            Load demo data
          </button>
        </div>
      )}

      {hasDemo && (
        <button
          type="button"
          className="btn btn--danger demo-controls__remove"
          onClick={() => setConfirmingRemove(true)}
        >
          <Trash2 size={16} aria-hidden="true" />
          Remove demo data
        </button>
      )}

      {confirmingRemove && (
        <ConfirmDialog
          title="Remove demo spirits?"
          message="This removes every demo spirit. Your own spirits stay untouched."
          confirmLabel="Remove them"
          tone="danger"
          onConfirm={removeDemo}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  );
}

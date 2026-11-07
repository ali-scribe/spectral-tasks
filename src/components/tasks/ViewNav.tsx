import type { ViewId } from '../../domain/types.ts';
import { useAppState, useAppDispatch } from '../../state/AppContext.tsx';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All Tasks' },
  { id: 'completed', label: 'Completed' },
];

/**
 * View navigation (REQ-ORG-01). Four buttons; the selected one carries
 * aria-current="page" so assistive technology announces the current View.
 */
export function ViewNav(): JSX.Element {
  const { ui } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <nav className="view-nav" aria-label="Task views">
      <ul>
        {VIEWS.map((view) => {
          const current = ui.view === view.id;
          return (
            <li key={view.id}>
              <button
                type="button"
                className={`view-nav__btn${current ? ' view-nav__btn--current' : ''}`}
                aria-current={current ? 'page' : undefined}
                onClick={() => dispatch({ type: 'SET_VIEW', view: view.id })}
              >
                {view.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

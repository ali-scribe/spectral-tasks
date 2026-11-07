import type { ViewId } from '../../domain/types.ts';

interface EmptyStateProps {
  view: ViewId;
  /** True when the view has tasks but filters hid them all (AC-ORG-02.6). */
  noMatches: boolean;
}

const VIEW_EMPTY: Record<ViewId, string> = {
  today: 'No spirits haunt today. Enjoy the quiet, or summon a new one.',
  upcoming: 'No spirits linger on the horizon yet.',
  all: 'No active spirits. Summon one to begin restoring the manor.',
  completed: 'No spirits released yet. Complete a task to free its spirit.',
};

/**
 * Empty-state messaging (AC-ORG-01.7, AC-ORG-02.6). Shows a view-specific
 * themed message when the view itself is empty, or a distinct "no matching
 * spirits" message when active filters removed everything.
 */
export function EmptyState({ view, noMatches }: EmptyStateProps): JSX.Element {
  return (
    <p className="empty-state">
      {noMatches
        ? 'No spirits match your search. Try clearing the filters.'
        : VIEW_EMPTY[view]}
    </p>
  );
}

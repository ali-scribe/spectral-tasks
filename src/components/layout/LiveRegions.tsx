import { useAppState } from '../../state/AppContext.tsx';

/**
 * Two visually hidden polite live regions (AC-A11Y-01.8, AC-GHOST-01.9,
 * AC-GHOST-01.17): one announces task actions, the other announces the ghost's
 * message. The ghost message is also shown as visible text by GhostCompanion;
 * this region adds the assistive-technology announcement. Both are polite so
 * they never interrupt the user mid-action.
 */
export function LiveRegions(): JSX.Element {
  const { announcement, ghost } = useAppState();

  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement?.text ?? ''}
      </div>
      <div className="visually-hidden" role="status" aria-live="polite">
        {ghost.message}
      </div>
    </>
  );
}

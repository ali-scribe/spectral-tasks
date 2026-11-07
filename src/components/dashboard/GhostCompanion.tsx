import { useEffect } from 'react';
import { Ghost } from 'lucide-react';
import { useAppState, useAppDispatch } from '../../state/AppContext.tsx';

/** How long a reaction pose plays before returning to idle (ms). Kept at or
 *  below the ~1.2s animation cap (AC-A11Y-02.5). */
const REACTION_MS = 1100;

const POSE_LABEL = {
  idle: 'Resting',
  summon: 'Summoning',
  celebrate: 'Celebrating',
  goal: 'Daily goal reached',
} as const;

/**
 * The ghost companion (REQ-GHOST-01). Renders a pose per state.ghost.kind with
 * visible message text (also announced via the Task 8 LiveRegions). After a
 * reaction it schedules GHOST_IDLE with the matching seq, so a newer reaction
 * is never reset by a stale timer. The pose label is text, so reduced-motion
 * users still get the reaction (AC-A11Y-02.4). This component never disables or
 * blocks any task control (AC-GHOST-01.5, AC-A11Y-02.6).
 */
export function GhostCompanion(): JSX.Element {
  const { ghost } = useAppState();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (ghost.kind === 'idle') {
      return;
    }
    const seq = ghost.seq;
    const timer = setTimeout(() => {
      dispatch({ type: 'GHOST_IDLE', seq });
    }, REACTION_MS);
    return () => clearTimeout(timer);
  }, [ghost.kind, ghost.seq, dispatch]);

  return (
    <div className={`ghost ghost--${ghost.kind}`}>
      <div className="ghost__figure" aria-hidden="true">
        <Ghost size={48} />
      </div>
      <p className="ghost__pose-label visually-hidden">{POSE_LABEL[ghost.kind]}</p>
      <p className="ghost__message">{ghost.message}</p>
    </div>
  );
}

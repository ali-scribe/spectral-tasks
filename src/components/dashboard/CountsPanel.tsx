import { Ghost, Sparkles } from 'lucide-react';
import { useAppState } from '../../state/AppContext.tsx';
import { getCounts } from '../../domain/selectors.ts';

/**
 * Active and completed task counts, derived at render time (AC-DASH-01.1).
 */
export function CountsPanel(): JSX.Element {
  const { tasks } = useAppState();
  const { active, completed } = getCounts(tasks);

  return (
    <div className="counts-panel">
      <div className="count">
        <Ghost size={20} aria-hidden="true" />
        <span className="count__value">{active}</span>
        <span className="count__label">{active === 1 ? 'restless spirit' : 'restless spirits'}</span>
      </div>
      <div className="count">
        <Sparkles size={20} aria-hidden="true" />
        <span className="count__value">{completed}</span>
        <span className="count__label">{completed === 1 ? 'spirit released' : 'spirits released'}</span>
      </div>
    </div>
  );
}

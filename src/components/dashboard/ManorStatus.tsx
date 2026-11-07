import { useAppState } from '../../state/AppContext.tsx';
import { getCounts } from '../../domain/selectors.ts';
import { getManorStage, getNextStageInfo } from '../../domain/manor.ts';
import { MANOR_STAGES } from '../../domain/constants.ts';

/**
 * Manor stage name and progress toward the next stage (AC-MANOR-01.6, .7, .8).
 * All values derive from the current completed-task count. When manorNotice is
 * set (only after a stage increase, never on load), a polite live region
 * announces the new stage.
 */
export function ManorStatus(): JSX.Element {
  const { tasks, manorNotice } = useAppState();
  const completed = getCounts(tasks).completed;
  const stage = getManorStage(completed);
  const stageName = MANOR_STAGES[stage]!.name;
  const next = getNextStageInfo(completed);

  return (
    <div className="manor-status">
      <p className="manor-status__stage">
        <span className="manor-status__stage-label">Manor:</span> {stageName}
      </p>
      {next ? (
        <p className="manor-status__next">
          {next.remaining} more {next.remaining === 1 ? 'spirit' : 'spirits'} released to reach{' '}
          {next.name}
        </p>
      ) : (
        <p className="manor-status__next">The manor is fully restored.</p>
      )}

      {/* Stage-increase announcement (polite). Only present after an increase. */}
      <div className="visually-hidden" role="status" aria-live="polite">
        {manorNotice ? `The manor has risen to ${MANOR_STAGES[manorNotice.stage]!.name}.` : ''}
      </div>
    </div>
  );
}

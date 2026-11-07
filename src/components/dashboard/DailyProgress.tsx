import { useAppState } from '../../state/AppContext.tsx';
import { countCompletedOn } from '../../domain/selectors.ts';
import { DAILY_GOAL } from '../../domain/constants.ts';

/**
 * Daily progress toward the fixed goal (AC-DASH-01.3, .10). Shows "N of 3"
 * text with a <progress> element; derived from completion timestamps on the
 * current Local_Today, never from stored progress (AC-PERS-01.7).
 */
export function DailyProgress(): JSX.Element {
  const { tasks, today } = useAppState();
  const completedToday = countCompletedOn(tasks, today);
  const reached = completedToday >= DAILY_GOAL;

  return (
    <div className="daily-progress">
      <div className="daily-progress__label">
        <span>Daily goal</span>
        <span className="daily-progress__count">
          {completedToday} of {DAILY_GOAL}
          {reached ? ' — reached!' : ''}
        </span>
      </div>
      <progress
        className="daily-progress__bar"
        max={DAILY_GOAL}
        value={Math.min(completedToday, DAILY_GOAL)}
        aria-label={`Daily goal: ${completedToday} of ${DAILY_GOAL} spirits released today`}
      />
    </div>
  );
}

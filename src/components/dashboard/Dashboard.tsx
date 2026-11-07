import { ManorView } from './ManorView.tsx';
import { ManorStatus } from './ManorStatus.tsx';
import { CountsPanel } from './CountsPanel.tsx';
import { DailyProgress } from './DailyProgress.tsx';
import { GhostCompanion } from './GhostCompanion.tsx';
import { DemoControls } from './DemoControls.tsx';

/**
 * The haunted dashboard (REQ-DASH-01): manor illustration and status, task
 * counts, daily progress, the ghost companion, the welcoming empty state and
 * demo controls. All values are derived at render time; the stage-increase and
 * ghost messages reach assistive technology through their live regions.
 */
export function Dashboard(): JSX.Element {
  return (
    <div className="dashboard panel">
      <h2 className="visually-hidden">Manor and progress</h2>
      <ManorView />
      <ManorStatus />
      <CountsPanel />
      <DailyProgress />
      <GhostCompanion />
      <DemoControls />
    </div>
  );
}

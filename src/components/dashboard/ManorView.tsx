import { useAppState } from '../../state/AppContext.tsx';
import { getCounts } from '../../domain/selectors.ts';
import { getManorStage } from '../../domain/manor.ts';
import { MANOR_STAGES } from '../../domain/constants.ts';

/**
 * The haunted manor as one inline SVG (REQ-MANOR-01; resolves OQ-6). The root
 * carries `manor manor--stage-N` and `data-stage`; layers are shown or hidden
 * by stage in manor.css, so each stage looks visibly different and stage 0 is a
 * ruined, dark manor. The SVG is decorative to the layout but exposes a text
 * alternative via role="img" and <title> (AC-MANOR-01.4, .10, .11).
 */
export function ManorView(): JSX.Element {
  const { tasks } = useAppState();
  const stage = getManorStage(getCounts(tasks).completed);
  const description = MANOR_STAGES[stage]!.description;

  return (
    <svg
      className={`manor manor--stage-${stage}`}
      data-stage={stage}
      viewBox="0 0 400 260"
      role="img"
      aria-label={description}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{description}</title>

      {/* Sky / ambient fog (always present, intensifies at low stages). */}
      <g className="layer layer--sky">
        <rect x="0" y="0" width="400" height="260" fill="var(--manor-sky)" />
      </g>
      <g className="layer layer--fog fog">
        <ellipse cx="90" cy="210" rx="120" ry="30" fill="var(--manor-fog)" />
        <ellipse cx="300" cy="220" rx="140" ry="28" fill="var(--manor-fog)" />
      </g>

      {/* Moon, brighter as the manor awakens. */}
      <g className="layer layer--moon layer--minStage-1">
        <circle cx="330" cy="60" r="26" fill="var(--manor-moon)" />
      </g>

      {/* Ground / garden (bare at low stages, greener higher). */}
      <g className="layer layer--ground">
        <rect x="0" y="210" width="400" height="50" fill="var(--manor-ground)" />
      </g>
      <g className="layer layer--garden layer--minStage-4">
        <circle cx="40" cy="214" r="10" fill="var(--manor-garden)" />
        <circle cx="365" cy="214" r="10" fill="var(--manor-garden)" />
      </g>

      {/* Manor body. Ruined walls at low stages, intact walls higher. */}
      <g className="layer layer--walls-ruined">
        <polygon points="120,210 120,120 200,80 280,120 280,210" fill="var(--manor-wall-ruined)" />
        {/* broken roofline notches */}
        <polygon points="120,120 140,110 150,122 170,108 185,120 200,80" fill="var(--manor-sky)" />
      </g>
      <g className="layer layer--walls layer--minStage-2">
        <polygon points="120,210 120,120 200,80 280,120 280,210" fill="var(--manor-wall)" />
        <polygon points="120,120 200,80 280,120 200,100" fill="var(--manor-roof)" />
      </g>

      {/* Windows: dark sockets at low stages, lit higher. */}
      <g className="layer layer--windows">
        <rect x="150" y="150" width="24" height="34" fill="var(--manor-window-dark)" />
        <rect x="226" y="150" width="24" height="34" fill="var(--manor-window-dark)" />
        <rect x="188" y="130" width="24" height="30" fill="var(--manor-window-dark)" />
      </g>
      <g className="layer layer--windows-lit layer--minStage-2">
        <rect x="150" y="150" width="24" height="34" fill="var(--manor-window-lit)" />
        <rect x="226" y="150" width="24" height="34" fill="var(--manor-window-lit)" />
      </g>
      <g className="layer layer--windows-lit-more layer--minStage-3">
        <rect x="188" y="130" width="24" height="30" fill="var(--manor-window-lit)" />
      </g>

      {/* Door, restored from stage 2. */}
      <g className="layer layer--door layer--minStage-2">
        <rect x="186" y="178" width="28" height="32" fill="var(--manor-door)" />
      </g>

      {/* Lanterns flanking the door, lit from stage 4. */}
      <g className="layer layer--lanterns layer--minStage-4">
        <circle cx="172" cy="184" r="5" fill="var(--manor-lantern)" />
        <circle cx="228" cy="184" r="5" fill="var(--manor-lantern)" />
      </g>

      {/* Spectral sparkles at the top stage. */}
      <g className="layer layer--sparkles layer--minStage-5">
        <circle cx="200" cy="60" r="3" fill="var(--manor-sparkle)" />
        <circle cx="240" cy="90" r="2" fill="var(--manor-sparkle)" />
        <circle cx="160" cy="95" r="2" fill="var(--manor-sparkle)" />
      </g>
    </svg>
  );
}

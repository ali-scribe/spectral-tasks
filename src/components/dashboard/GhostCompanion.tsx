import { useEffect } from 'react';
import { useAppState, useAppDispatch } from '../../state/AppContext.tsx';

/** How long a reaction pose plays before returning to idle (ms). Kept at or
 *  below the ~1.2s animation cap (AC-A11Y-02.5). */
const REACTION_MS = 1100;

/** Four-point spark centered at (x, y). */
function spark(x: number, y: number, r: number): string {
  const k = r * 0.3;
  return `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`;
}

/**
 * The ghost's art: a shrouded figure with a tattered hem and two stubby arms.
 * The pose is chosen by the parent's `ghost--{kind}` class in components.css
 * (arms, eyes, mouth, and the wisp or sparks that belong to each pose), so the
 * pose stays visible even when motion is reduced. Purely decorative.
 */
function GhostArt(): JSX.Element {
  return (
    <svg
      className="ghost-art"
      viewBox="0 -8 64 80"
      width="64"
      height="80"
      aria-hidden="true"
      focusable="false"
    >
      {/* daily-goal warmth, behind everything */}
      <defs>
        <radialGradient id="ghost-glow-grad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.5" stopColor="var(--ghost-glow)" stopOpacity="0.4" />
          <stop offset="1" stopColor="var(--ghost-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="ghost-art__glow" cx="32" cy="32" rx="38" ry="42" fill="url(#ghost-glow-grad)" />

      <path
        className="ghost-art__arm ghost-art__arm--l"
        d="M16 35 C9 37 6 46 8 54 C12 53 16 48 18 42 Z"
        fill="var(--ghost-body)"
        stroke="var(--ghost-shade)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        className="ghost-art__arm ghost-art__arm--r"
        d="M48 35 C55 37 58 46 56 54 C52 53 48 48 46 42 Z"
        fill="var(--ghost-body)"
        stroke="var(--ghost-shade)"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      <path
        className="ghost-art__body"
        d="M32 4 C19 4 13 15 13 29 V58 L19 53 L25 61 L32 53 L39 61 L45 53 L51 58 V29 C51 15 45 4 32 4 Z"
        fill="var(--ghost-body)"
      />
      <path
        d="M44 10 C49 15 51 22 51 29 V58 L45 53 L39 61 L41 42 C45 33 46 20 44 10 Z"
        fill="var(--ghost-shade)"
        opacity="0.75"
      />

      {/* eyes */}
      <g className="ghost-art__eyes ghost-art__eyes--open" fill="var(--ghost-ink)">
        <ellipse cx="25" cy="28" rx="2.7" ry="3.8" />
        <ellipse cx="39" cy="28" rx="2.7" ry="3.8" />
      </g>
      <g
        className="ghost-art__eyes ghost-art__eyes--happy"
        stroke="var(--ghost-ink)"
        strokeWidth="2.3"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M21.5 29.5 Q25 23.5 28.5 29.5" />
        <path d="M35.5 29.5 Q39 23.5 42.5 29.5" />
      </g>

      {/* mouths */}
      <path
        className="ghost-art__mouth ghost-art__mouth--idle"
        d="M29 38 Q32 40.5 35 38"
        stroke="var(--ghost-ink)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse
        className="ghost-art__mouth ghost-art__mouth--summon"
        cx="32"
        cy="39"
        rx="2.6"
        ry="3.2"
        fill="var(--ghost-ink)"
      />
      <path
        className="ghost-art__mouth ghost-art__mouth--celebrate"
        d="M26.5 36 Q32 44 37.5 36"
        stroke="var(--ghost-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        className="ghost-art__mouth ghost-art__mouth--goal"
        d="M24.5 35 Q32 49 39.5 35 Z"
        fill="var(--ghost-ink)"
      />

      {/* summon: the spirit being called, a small wisp by the raised hand */}
      <path
        className="ghost-art__wisp"
        d="M58 4 C62.5 10 63 15 58 20 C53 15 53.5 10 58 4 Z"
        fill="var(--ghost-wisp)"
      />

      {/* daily goal: three sparks over the head */}
      <g className="ghost-art__sparks" fill="var(--ghost-glow)">
        <path d={spark(11, 4, 4.2)} />
        <path d={spark(53, 0, 5)} />
        <path d={spark(32, -4, 3.2)} />
      </g>
    </svg>
  );
}

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
        <GhostArt />
      </div>
      <p className="ghost__pose-label visually-hidden">{POSE_LABEL[ghost.kind]}</p>
      <p className="ghost__message">{ghost.message}</p>
    </div>
  );
}

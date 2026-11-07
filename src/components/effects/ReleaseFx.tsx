import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useAppState } from '../../state/AppContext.tsx';
import { prefersReducedMotion, subscribeRelease, type ReleaseRect } from './releaseFx.ts';

/** Most wisps on screen at once (rapid completions); older ones are dropped. */
const MAX_WISPS = 4;
/** Safety nets if animationend never fires (hidden tab, reduced motion). */
const FALLBACK_MS = 1600;
const REDUCED_MS = 900;

interface Wisp {
  id: number;
  rect: ReleaseRect;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  goal: boolean;
}

/**
 * The "spirit released" moment (presentational only). On completion a wisp
 * lifts from where the row was and rises toward the manor, then fades; the
 * row's old footprint glows briefly. The overlay is fixed, non-interactive and
 * aria-hidden, so it never shifts layout or takes focus; the existing live
 * region still announces "Spirit released". Under reduced motion nothing moves:
 * a static highlight marks the row's place for a short moment instead.
 */
export function ReleaseFx(): JSX.Element {
  const { ghost } = useAppState();
  const [wisps, setWisps] = useState<Wisp[]>([]);

  useEffect(
    () =>
      subscribeRelease((event) => {
        if (!event.rect) return;
        const { rect } = event;
        const manor = document.querySelector('svg.manor')?.getBoundingClientRect();
        const x0 = rect.left + 36;
        const y0 = rect.top + rect.height / 2;
        // Rise toward the manor (its windows are where the stage beat plays); keep
        // the end point on screen if the manor is scrolled away.
        const tx = manor ? manor.left + manor.width / 2 : x0;
        const rawTy = manor ? manor.top + manor.height * 0.45 : y0 - 160;
        const ty = Math.min(Math.max(rawTy, 24), window.innerHeight - 24);
        const wisp: Wisp = { id: event.id, rect, x0, y0, dx: tx - x0, dy: ty - y0, goal: false };
        setWisps((current) => [...current.slice(-(MAX_WISPS - 1)), wisp]);
      }),
    [],
  );

  // The reducer decides when the daily goal is reached; the newest wisp simply
  // takes on the bigger, golden variant in the same commit (before paint).
  useLayoutEffect(() => {
    if (ghost.kind !== 'goal') return;
    setWisps((current) =>
      current.map((w, i) => (i === current.length - 1 ? { ...w, goal: true } : w)),
    );
  }, [ghost.kind, ghost.seq]);

  const remove = useCallback((id: number) => {
    setWisps((current) => current.filter((w) => w.id !== id));
  }, []);

  return (
    <div className="release-fx" aria-hidden="true">
      {wisps.map((w) => (
        <ReleaseWisp key={w.id} wisp={w} onDone={remove} />
      ))}
    </div>
  );
}

function ReleaseWisp({
  wisp,
  onDone,
}: {
  wisp: Wisp;
  onDone: (id: number) => void;
}): JSX.Element {
  const { id } = wisp;

  // Primary cleanup is animationend; this timer only covers the cases where it
  // cannot fire. It is cleared on unmount, so nothing leaks (StrictMode-safe).
  useEffect(() => {
    const timer = setTimeout(() => onDone(id), prefersReducedMotion() ? REDUCED_MS : FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [id, onDone]);

  const motes = wisp.goal ? 4 : 2;
  const size = wisp.goal ? 36 : 26;

  const itemStyle = {
    left: wisp.x0,
    top: wisp.y0,
    '--fx-dx': `${wisp.dx}px`,
    '--fx-dy': `${wisp.dy}px`,
  } as CSSProperties;

  return (
    <>
      <span
        className={`release-fx__ring${wisp.goal ? ' release-fx__ring--goal' : ''}`}
        style={{
          left: wisp.rect.left,
          top: wisp.rect.top,
          width: wisp.rect.width,
          height: wisp.rect.height,
        }}
      />
      <span
        className={`release-fx__item${wisp.goal ? ' release-fx__item--goal' : ''}`}
        style={itemStyle}
        onAnimationEnd={(e) => {
          if ((e.target as HTMLElement).classList.contains('release-fx__wisp')) onDone(id);
        }}
      >
        {Array.from({ length: motes }, (_, i) => (
          <span
            key={i}
            className="release-fx__mote"
            style={{ '--fx-i': i + 1, '--fx-x': `${(i % 2 === 0 ? -1 : 1) * (6 + i * 3)}px` } as CSSProperties}
          />
        ))}
        <span className="release-fx__wisp">
          <svg
            className="release-fx__sway"
            viewBox="0 0 12 18"
            width={size * 0.67}
            height={size}
            focusable="false"
          >
            <path d="M6 0 C10.5 6 11 11 6 16 C1 11 1.5 6 6 0 Z" />
          </svg>
        </span>
      </span>
    </>
  );
}

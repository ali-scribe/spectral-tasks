/**
 * A tiny presentational event channel for the "spirit released" moment. The
 * task browser emits when the user completes a task; the overlay (wisp) and the
 * manor (window beat) listen. It carries only geometry and a flag, owns no
 * state and touches no reducer or domain logic.
 */

export interface ReleaseRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ReleaseEvent {
  /** Unique per emit, so listeners can key their one-shot effects. */
  id: number;
  /** The completed row's bounds in viewport coordinates, captured at click time. */
  rect: ReleaseRect | null;
  /** True when this completion raised the manor to a higher stage. */
  stageUp: boolean;
}

type Listener = (event: ReleaseEvent) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function emitRelease(rect: ReleaseRect | null, stageUp: boolean): void {
  const event: ReleaseEvent = { id: nextId, rect, stageUp };
  nextId += 1;
  listeners.forEach((listener) => listener(event));
}

/** Subscribe; returns the unsubscribe function (use it as an effect cleanup). */
export function subscribeRelease(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the user asked for reduced motion (safe where matchMedia is missing). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

import type { ReactNode } from 'react';

/**
 * Renders content that is visually hidden but available to assistive
 * technology (used for extra context on icon-only controls and labels).
 */
export function VisuallyHidden({ children }: { children: ReactNode }): JSX.Element {
  return <span className="visually-hidden">{children}</span>;
}

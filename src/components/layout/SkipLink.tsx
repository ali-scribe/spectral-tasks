/**
 * Skip link (AC-A11Y-01.10). Must be the first focusable element in the DOM so
 * keyboard users can jump straight to the main content. It is visible on focus.
 */
export function SkipLink(): JSX.Element {
  return (
    <a className="skip-link" href="#main">
      Skip to main content
    </a>
  );
}

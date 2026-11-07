/**
 * Page header with the app name as the single h1 (AC-A11Y-01.7).
 */
export function AppHeader(): JSX.Element {
  return (
    <header className="app-header">
      <h1>Spectral Tasks</h1>
      <p className="app-tagline">Summon your tasks. Release them. Restore the manor.</p>
    </header>
  );
}

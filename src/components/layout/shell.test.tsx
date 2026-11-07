import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { AppProvider } from '../../state/AppContext.tsx';
import { createInitialState } from '../../state/initialState.ts';
import type { AppState, Notice } from '../../domain/types.ts';
import type { LoadResult } from '../../storage/storageService.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { NoticeBar } from './NoticeBar.tsx';
import { LiveRegions } from './LiveRegions.tsx';
import { SkipLink } from './SkipLink.tsx';

function stateWithNotices(notices: Notice[]): AppState {
  const load: LoadResult = { tasks: [], lastGoalCelebrationDate: null, storageMode: 'normal', notices };
  return createInitialState(load, '2026-06-15');
}

function withProvider(ui: ReactNode, state: AppState) {
  return render(<AppProvider initialState={state}>{ui}</AppProvider>);
}

describe('ErrorBoundary (AC-NFR-01.9)', () => {
  function Boom(): JSX.Element {
    throw new Error('boom');
  }

  it('renders a themed fallback with a reload button when a child throws', () => {
    // Silence the expected error log from React.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary onReload={() => {}}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All calm</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All calm')).toBeInTheDocument();
  });
});

describe('NoticeBar (AC-PERS-02.3, .6)', () => {
  it('shows a dismiss button for a dismissible notice and dismisses it', async () => {
    const user = userEvent.setup();
    const state = stateWithNotices([
      { id: 'corrupted', tone: 'warning', text: 'Data could not be read.', persistent: false },
    ]);
    withProvider(<NoticeBar />, state);
    expect(screen.getByText('Data could not be read.')).toBeInTheDocument();
    const dismiss = screen.getByRole('button', { name: /dismiss notice/i });
    await user.click(dismiss);
    expect(screen.queryByText('Data could not be read.')).not.toBeInTheDocument();
  });

  it('shows no dismiss button for a persistent notice and uses role=alert for errors', () => {
    const state = stateWithNotices([
      { id: 'newer-version', tone: 'error', text: 'Created by a newer version.', persistent: true },
    ]);
    withProvider(<NoticeBar />, state);
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Created by a newer version.');
  });

  it('renders nothing when there are no notices', () => {
    const { container } = withProvider(<NoticeBar />, stateWithNotices([]));
    expect(container.querySelector('.notice-bar')).toBeNull();
  });
});

describe('LiveRegions (AC-A11Y-01.8, AC-GHOST-01.9)', () => {
  it('renders two polite live regions including the ghost message', () => {
    const state = stateWithNotices([]);
    const { container } = withProvider(<LiveRegions />, state);
    const regions = container.querySelectorAll('[aria-live="polite"][role="status"]');
    expect(regions).toHaveLength(2);
    // The ghost idle message is present as live text.
    expect(container.textContent).toContain('ghost');
  });
});

describe('SkipLink (AC-A11Y-01.10)', () => {
  it('is a link to #main and is the first focusable element', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink />
        <button type="button">Other</button>
      </>,
    );
    const link = screen.getByRole('link', { name: /skip to main content/i });
    expect(link).toHaveAttribute('href', '#main');
    await user.tab();
    expect(link).toHaveFocus();
  });
});

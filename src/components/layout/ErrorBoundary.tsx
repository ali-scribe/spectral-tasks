import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional reload handler; defaults to reloading the page. Injectable for tests. */
  onReload?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors and shows a themed fallback instead of a blank screen
 * (AC-NFR-01.9). The reload button only reloads the page; it never touches
 * stored data, so the user's spirits are preserved.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the error for debugging without crashing the app.
    // eslint-disable-next-line no-console
    console.error('Spectral Tasks render error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
    } else {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-fallback" role="alert">
          <h2>The veil flickered</h2>
          <p>
            Something went wrong while conjuring the page. Your saved spirits are safe. Reload to
            try again.
          </p>
          <button type="button" onClick={this.handleReload}>
            Reload Spectral Tasks
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

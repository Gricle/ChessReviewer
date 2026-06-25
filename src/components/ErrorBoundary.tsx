import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ChessReviewer] Render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '40px', maxWidth: 600, margin: '40px auto',
          background: '#312e2b', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
          color: '#ebe9e6', fontFamily: 'Segoe UI, system-ui, sans-serif',
        }}>
          <h2 style={{ margin: '0 0 8px', color: '#fa412d' }}>Something went wrong</h2>
          <p style={{ color: '#b6b2ac', margin: '0 0 12px', fontSize: 14 }}>
            The game review encountered an error. This might be a browser compatibility issue.
          </p>
          <details style={{ fontSize: 13, color: '#87837e' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Error details</summary>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.message}</pre>
          </details>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#81b64c', color: '#14210a', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

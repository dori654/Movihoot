import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="page-center">
        <div className="card" style={{ maxWidth: 420, textAlign: 'center', padding: '48px 32px' }}>
          <h1 className="logo">MOVIHOOT</h1>
          <div className="neon-divider" />
          <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>
            משהו השתבש בתצוגה. רעננו את הדף כדי להמשיך.
          </p>
          <button className="btn-gold" onClick={() => window.location.reload()}>
            רענון הדף
          </button>
        </div>
      </div>
    );
  }
}

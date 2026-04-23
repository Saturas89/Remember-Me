import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Top-level crash handler. Without it, a render error in any descendant
 * swaps the mounted tree for an empty `<div id="root">` and leaves the user
 * staring at a blank page with nothing actionable.
 *
 * This boundary renders a plain-HTML fallback (no translations, no routing)
 * so it works even if the error originated inside those subsystems.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Remember Me] render error:', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div
        role="alert"
        style={{
          padding: '2rem',
          maxWidth: '520px',
          margin: '3rem auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1.5,
        }}
      >
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>
          Da ist etwas schiefgelaufen.
        </h1>
        <p style={{ marginBottom: '1.25rem' }}>
          Remember Me konnte die Seite nicht anzeigen. Deine gespeicherten
          Erinnerungen sind sicher – sie liegen nur auf deinem Gerät.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: '0.6rem 1.2rem',
            fontSize: '1rem',
            border: 0,
            borderRadius: '8px',
            background: '#4b3f2f',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Seite neu laden
        </button>
      </div>
    )
  }
}

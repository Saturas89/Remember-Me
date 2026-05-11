import { Component, type ErrorInfo, type ReactNode } from 'react'
import { UI_DE } from '../locales/de/ui'
import { UI_EN } from '../locales/en/ui'
import { STORAGE_KEY } from '../locales/detectLocale'

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
 * The fallback intentionally avoids React hooks and the I18n provider –
 * either of those could be the very thing that crashed. We resolve the
 * locale by reading localStorage directly and pull translations from the
 * statically-imported UI bundles so the fallback works even if context /
 * routing / state subsystems are broken.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Storyhold] render error:', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private resolveLocale(): 'de' | 'en' {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'de' || stored === 'en') return stored
    } catch { /* noop */ }
    try {
      const code = navigator.language?.split('-')[0]?.toLowerCase()
      if (code === 'en') return 'en'
    } catch { /* noop */ }
    return 'de'
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    const e = (this.resolveLocale() === 'en' ? UI_EN : UI_DE).errorBoundary

    return (
      <div role="alert" className="error-boundary">
        <h1 className="error-boundary__heading">{e.heading}</h1>
        <p className="error-boundary__body">{e.body}</p>
        <button
          type="button"
          onClick={this.handleReload}
          className="btn btn--primary"
        >
          {e.reloadButton}
        </button>
      </div>
    )
  }
}

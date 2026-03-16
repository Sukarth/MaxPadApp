import './assets/main.css'

import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
  error: unknown
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('Renderer crash:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'ui-sans-serif, system-ui',
            color: '#e5e7eb',
            background: '#09090b',
            height: '100vh'
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>MaxPad App crashed</h1>
          <p style={{ opacity: 0.8, marginBottom: 12 }}>
            This is the real error (so we don’t get a white screen):
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              padding: 12,
              borderRadius: 12,
              background: '#18181b',
              border: '1px solid #27272a'
            }}
          >
            {String(
              (this.state.error instanceof Error ? this.state.error.stack : null) ||
                this.state.error
            )}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
)

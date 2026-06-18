'use client'

import { Component, type ReactNode } from 'react'

// Minimal class error boundary (React requires a class for componentDidCatch).
// Used to ISOLATE the in-room panels: if a panel (tldraw whiteboard, a transcript
// row, etc.) throws during render, this catches it and renders `fallback`
// (default: nothing) instead of letting the throw bubble up and unmount
// <LiveKitRoom> — which would drop the user from the call ("kicked out").
// Resets when `resetKey` changes (e.g. the user toggles a panel) so the surface
// recovers on the next interaction.
interface Props {
  children: ReactNode
  fallback?: ReactNode
  resetKey?: string | number
  onError?: () => void
}
interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // Surfaces in Sentry via the global handler; logged for local debugging.
    console.error('[sala] panel error boundary caught:', error)
    this.props.onError?.()
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}

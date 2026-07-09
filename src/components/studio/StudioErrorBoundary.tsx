"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean };

export class StudioErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              gap: 16,
              padding: 24,
              textAlign: "center",
            }}
          >
            <h2 style={{ fontWeight: 800 }}>Studio crashed</h2>
            <p style={{ color: "var(--muted)" }}>
              Your local autosave is intact. Reload to recover.
            </p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload Studio
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

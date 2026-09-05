"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * The room may break. The way out may not.
 *
 * Without this, an exception anywhere in the 3D tree unmounts everything above
 * it — and everything above it is the whole page. The result is a black
 * rectangle with no HUD, no dock and no way back, which is indistinguishable
 * from a dead server and from a very dark room. Three failures that look the
 * same is exactly what the rest of V2 spends its effort avoiding.
 *
 * So the canvas is the only thing inside the boundary. The status bar, the
 * dock and the inspector live outside it and keep working, which means the way
 * home stays where it always is, even when the world it leads out of is gone.
 *
 * A class component because this is the one thing hooks cannot do: React has
 * no functional error boundary, and wrapping a library in one that "mostly
 * works" would be worse than the honest old API.
 */

type Props = {
  children: ReactNode;
  /**
   * Changing this clears the error.
   *
   * The world id goes here, so leaving a broken room and coming back tries
   * again rather than showing the old failure forever. A boundary that never
   * resets turns one bad frame into a permanently broken session.
   */
  resetKey: string;
  /** Somewhere to put the message, so the HUD can say what happened. */
  onError?: (message: string) => void;
};

type State = { message: string | null };

export class WorldBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in the console in full. The panel shows one line; whoever is
    // debugging needs the component stack, and throwing it away to keep the
    // screen tidy would be trading the fix for the appearance of calm.
    console.error("[V2] Welt abgestürzt:", error, info.componentStack);
    this.props.onError?.(error instanceof Error ? error.message : String(error));
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.message !== null) {
      this.setState({ message: null });
    }
  }

  render() {
    if (this.state.message === null) return this.props.children;

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#05080d] px-6">
        <div className="max-w-md rounded-2xl border border-rose-400/25 bg-[#0a1018]/95 px-5 py-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-200/80">
            Diese Welt ist abgestürzt
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/60">
            Der Raum konnte nicht gezeichnet werden. Das HUD läuft weiter — über
            das Dock unten kommst du in eine andere Welt, und beim Zurückkommen
            wird diese neu aufgebaut.
          </p>
          <p className="mt-3 break-words font-mono text-[10px] leading-relaxed text-white/30">
            {this.state.message}
          </p>
        </div>
      </div>
    );
  }
}

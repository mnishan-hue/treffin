import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught:", error, info);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center px-4"
        style={{ background: "radial-gradient(ellipse at top, #0d1830 0%, #060810 60%)" }}
      >
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-rose-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-6">
            An unexpected error interrupted your session. Refreshing usually fixes it.
          </p>
          <button
            onClick={this.reset}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white treffin-gradient hover:opacity-90 transition-opacity"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }
}

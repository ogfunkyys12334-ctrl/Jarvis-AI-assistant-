import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside JARVIS interface:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-black p-6 text-center text-white">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-red-500 bg-red-950/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <span className="font-display text-4xl font-extrabold">!</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">INTERFACE FAILURE</h1>
          <p className="mt-2 max-w-md font-mono text-sm text-zinc-400">
            {this.state.error?.message || 'Jarvis encountered an unexpected core dump.'}
          </p>
          <button
            onClick={() => {
              try {
                localStorage.clear();
              } catch (e) {
                console.warn("Storage purge restricted inside iframe sandbox", e);
              }
              window.location.reload();
            }}
            id="crash-reset-btn"
            className="mt-6 rounded-lg bg-zinc-800 px-5 py-2.5 font-mono text-sm font-semibold tracking-wider hover:bg-zinc-700 transition"
          >
            PURGE STATE & RELOAD
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

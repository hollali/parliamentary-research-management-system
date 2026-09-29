import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Changing this value remounts the subtree, which is what actually recovers
   * from a render error. Resetting `hasError` alone re-renders the identical
   * failing tree and immediately re-throws.
   */
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleTryAgain = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleBackToDashboard = (): void => {
    window.location.href = '/';
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-sans p-4">
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-10 text-center max-w-lg w-full space-y-4">
            <AlertTriangle className="w-12 h-12 text-[#0037b0] mx-auto" />
            <h3 className="text-lg font-bold text-gray-900">Something Went Wrong</h3>
            {/* The raw error message can contain file paths, Prisma internals
                and other implementation detail. This system handles
                confidential parliamentary material, so show a stable message
                and leave the specifics to the console. */}
            <p className="text-sm text-[#434655] max-w-md mx-auto">
              An unexpected error occurred while rendering this view. You can retry the view or
              return to your dashboard. If the problem persists, contact the system administrator.
            </p>
            <details className="text-left text-xs text-[#6b6c7b] bg-[#f8f9fa] rounded p-3 max-w-md mx-auto">
              <summary className="cursor-pointer font-semibold">Technical details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error?.message || 'Unknown error'}
              </pre>
            </details>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleTryAgain}
                className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded"
              >
                Try Again
              </button>
              <button
                onClick={this.handleBackToDashboard}
                className="bg-white border border-[#c4c5d7] hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 px-4 rounded"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

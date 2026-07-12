import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
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
            <p className="text-sm text-[#434655] max-w-md mx-auto">
              {this.state.error?.message || 'An unexpected error occurred while rendering the application.'}
            </p>
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

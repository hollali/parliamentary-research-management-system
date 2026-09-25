import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message = 'Something went wrong while loading this data.',
  onRetry,
}) => (
  <div role="alert" className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
    <AlertTriangle className="w-6 h-6 text-[#ba1a1a]" />
    <p className="text-xs font-semibold text-[#434655] max-w-sm">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#0037b0] hover:underline"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
    )}
  </div>
);
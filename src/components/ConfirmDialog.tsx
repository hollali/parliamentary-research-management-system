import React from 'react';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { useDialogA11y } from '../lib/useDialogA11y';

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  tone?: 'danger' | 'neutral';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  busyLabel = 'Working…',
  busy = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useDialogA11y<HTMLDivElement>({
    onClose: onCancel,
    enabled: true,
  });

  const Icon = tone === 'danger' ? Trash2 : CheckCircle2;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h3
            className={`text-base font-bold flex items-center gap-2 ${
              tone === 'danger' ? 'text-[#ba1a1a]' : 'text-[#191c1d]'
            }`}
          >
            <Icon className="w-4 h-4" />
            {title}
          </h3>
        </div>
        <div className="p-5">
          <div className="text-sm text-gray-600">{message}</div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                tone === 'danger'
                  ? 'bg-[#ba1a1a] hover:bg-[#93000a]'
                  : 'bg-[#0037b0] hover:bg-[#1d4ed8]'
              }`}
            >
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
import React, { useEffect, useState } from 'react';

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({ label, onClick, active, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={`p-1.5 rounded hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:pointer-events-none ${
      active ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'
    }`}
  >
    {children}
  </button>
);

export function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />;
}

interface ToolbarPopoverProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  align?: 'left' | 'right';
  children: (close: () => void) => React.ReactNode;
}

export const ToolbarPopover: React.FC<ToolbarPopoverProps> = ({ label, active, disabled, align = 'left', children }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:pointer-events-none ${
          active ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'
        }`}
      >
        {label}
        <ChevronDownIcon />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label={label}
            className={`absolute top-full mt-1 z-50 bg-white border border-[#c4c5d7] rounded-lg shadow-lg p-3 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
};

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

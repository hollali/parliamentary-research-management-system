import React, { useState } from 'react';
import type { Editor } from '@tiptap/core';

interface TablePopoverProps {
  editor: Editor;
  close: () => void;
}

const MAX_GRID = 10;
const PRESETS: { label: string; rows: number; cols: number }[] = [
  { label: '2 × 2', rows: 2, cols: 2 },
  { label: '3 × 3', rows: 3, cols: 3 },
  { label: '4 × 3', rows: 4, cols: 3 },
  { label: '3 × 5', rows: 3, cols: 5 },
];

export const TablePopover: React.FC<TablePopoverProps> = ({ editor, close }) => {
  const [hovered, setHovered] = useState<{ rows: number; cols: number } | null>(null);
  const inTable = editor.isActive('table');

  return (
    <div className="w-64 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Insert table</div>
      <div
        role="grid"
        aria-label="Choose table size"
        onMouseLeave={() => setHovered(null)}
        className="inline-grid gap-1"
        style={{ gridTemplateColumns: `repeat(${MAX_GRID}, 1fr)` }}
      >
        {Array.from({ length: MAX_GRID * MAX_GRID }).map((_, index) => {
          const rows = Math.floor(index / MAX_GRID) + 1;
          const cols = (index % MAX_GRID) + 1;
          const filled = hovered ? rows <= hovered.rows && cols <= hovered.cols : false;
          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              aria-label={`${rows} by ${cols}`}
              onMouseEnter={() => setHovered({ rows, cols })}
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows: hovered?.rows ?? rows, cols: hovered?.cols ?? cols, withHeaderRow: true })
                  .run();
                close();
              }}
              className={`w-5 h-5 rounded-sm border transition-colors ${
                filled ? 'bg-[#0037b0] border-[#0037b0]' : 'bg-gray-50 border-[#c4c5d7] hover:border-[#0037b0]'
              }`}
            />
          );
        })}
      </div>
      <div className="text-[10px] text-gray-500">{hovered ? `${hovered.rows} × ${hovered.cols}` : 'Hover to size'}</div>
      <div className="border-t border-gray-200 pt-2 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Presets</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows: preset.rows, cols: preset.cols, withHeaderRow: true })
                  .run();
                close();
              }}
              className="px-2 py-1 text-[11px] font-semibold text-gray-600 border border-[#c4c5d7] rounded hover:bg-[#dce1ff]/30"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      {inTable && (
        <div className="border-t border-gray-200 pt-2 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Selected table</div>
          <div className="flex flex-wrap gap-1.5">
            <TableAction editor={editor} command="addRowAfter" label="Row +" close={close} />
            <TableAction editor={editor} command="addColumnAfter" label="Col +" close={close} />
            <TableAction editor={editor} command="deleteRow" label="Row −" close={close} />
            <TableAction editor={editor} command="deleteColumn" label="Col −" close={close} />
            <TableAction editor={editor} command="toggleHeaderRow" label="Header" close={close} />
            <TableAction
              editor={editor}
              command="deleteTable"
              label="Delete"
              close={close}
              className="!text-[#ba1a1a] !border-[#ba1a1a]/40"
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface TableActionProps {
  editor: Editor;
  command: 'addRowAfter' | 'addColumnAfter' | 'deleteRow' | 'deleteColumn' | 'toggleHeaderRow' | 'deleteTable';
  label: string;
  close: () => void;
  className?: string;
}

const TableAction: React.FC<TableActionProps> = ({ editor, command, label, close, className = '' }) => {
  const run = () => {
    const chain = editor.chain().focus();
    switch (command) {
      case 'addRowAfter':
        chain.addRowAfter().run();
        break;
      case 'addColumnAfter':
        chain.addColumnAfter().run();
        break;
      case 'deleteRow':
        chain.deleteRow().run();
        break;
      case 'deleteColumn':
        chain.deleteColumn().run();
        break;
      case 'toggleHeaderRow':
        chain.toggleHeaderRow().run();
        break;
      case 'deleteTable':
        chain.deleteTable().run();
        break;
    }
    close();
  };

  return (
    <button
      type="button"
      onClick={run}
      className={`px-2 py-1 text-[11px] font-semibold text-gray-600 border border-[#c4c5d7] rounded hover:bg-[#dce1ff]/30 ${className}`}
    >
      {label}
    </button>
  );
};

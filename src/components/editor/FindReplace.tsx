import React, { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { X } from 'lucide-react';
import { collectDocText, findDocRanges } from '../../lib/docText';

interface FindReplaceProps {
  editor: Editor;
  close: () => void;
}

export const FindReplace: React.FC<FindReplaceProps> = ({ editor, close }) => {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [docVersion, setDocVersion] = useState(0);

  useEffect(() => {
    const bump = () => setDocVersion((prev) => prev + 1);
    editor.on('update', bump);
    return () => {
      editor.off('update', bump);
    };
  }, [editor]);

  const ranges = useMemo(
    () => findDocRanges(collectDocText(editor.state.doc), query, { caseSensitive }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, query, caseSensitive, docVersion],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, caseSensitive]);

  const current = ranges[Math.min(activeIndex, Math.max(ranges.length - 1, 0))];

  useEffect(() => {
    if (!current) return;
    editor.chain().focus().setTextSelection(current).scrollIntoView().run();
  }, [editor, current?.from, current?.to]);

  const step = (delta: number) => {
    if (ranges.length === 0) return;
    setActiveIndex((prev) => (prev + delta + ranges.length) % ranges.length);
  };

  const replaceCurrent = () => {
    if (!current) return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: current.from, to: current.to }, replacement)
      .run();
    setDocVersion((prev) => prev + 1);
  };

  const replaceAll = () => {
    if (ranges.length === 0) return;
    const chain = editor.chain().focus();
    for (const range of [...ranges].reverse()) {
      chain.insertContentAt(range, replacement);
    }
    chain.run();
    setDocVersion((prev) => prev + 1);
  };

  return (
    <div className="border-b border-[#c4c5d7] bg-[#f8f9fa] px-4 py-2 flex items-center gap-2 flex-wrap">
      <input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            step(event.shiftKey ? -1 : 1);
          }
          if (event.key === 'Escape') close();
        }}
        placeholder="Find"
        aria-label="Find"
        className="px-2 py-1 text-xs border border-[#c4c5d7] rounded bg-white focus:outline-none focus:border-[#0037b0] w-40"
      />
      <span className="text-[11px] text-gray-500 tabular-nums min-w-16">
        {query ? (ranges.length ? `${Math.min(activeIndex, ranges.length - 1) + 1} of ${ranges.length}` : 'No results') : ''}
      </span>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={ranges.length === 0}
        className="px-2 py-1 text-[11px] font-semibold text-gray-600 border border-[#c4c5d7] rounded bg-white hover:bg-gray-50 disabled:opacity-40"
      >
        Prev
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={ranges.length === 0}
        className="px-2 py-1 text-[11px] font-semibold text-gray-600 border border-[#c4c5d7] rounded bg-white hover:bg-gray-50 disabled:opacity-40"
      >
        Next
      </button>
      <label className="flex items-center gap-1 text-[11px] text-gray-600">
        <input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
        Match case
      </label>
      <div className="w-px h-5 bg-gray-200" />
      <input
        value={replacement}
        onChange={(event) => setReplacement(event.target.value)}
        placeholder="Replace with"
        aria-label="Replace with"
        className="px-2 py-1 text-xs border border-[#c4c5d7] rounded bg-white focus:outline-none focus:border-[#0037b0] w-40"
      />
      <button
        type="button"
        onClick={replaceCurrent}
        disabled={!current}
        className="px-2 py-1 text-[11px] font-semibold text-gray-600 border border-[#c4c5d7] rounded bg-white hover:bg-gray-50 disabled:opacity-40"
      >
        Replace
      </button>
      <button
        type="button"
        onClick={replaceAll}
        disabled={ranges.length === 0}
        className="px-2 py-1 text-[11px] font-semibold text-gray-600 border border-[#c4c5d7] rounded bg-white hover:bg-gray-50 disabled:opacity-40"
      >
        Replace all
      </button>
      <button
        type="button"
        onClick={close}
        title="Close find and replace"
        aria-label="Close find and replace"
        className="ml-auto p-1 rounded text-gray-500 hover:bg-gray-100"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

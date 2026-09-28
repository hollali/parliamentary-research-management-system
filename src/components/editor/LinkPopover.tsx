import React, { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';

interface LinkPopoverProps {
  editor: Editor;
  close: () => void;
}

function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^(https?:|mailto:|#|\/)/i.test(value)) return value;
  return `https://${value}`;
}

export const LinkPopover: React.FC<LinkPopoverProps> = ({ editor, close }) => {
  const [href, setHref] = useState(() => editor.getAttributes('link').href ?? '');
  const [openInNewTab, setOpenInNewTab] = useState(false);

  useEffect(() => {
    setHref(editor.getAttributes('link').href ?? '');
  }, [editor]);

  const apply = () => {
    const url = normalizeUrl(href);
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      close();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url, target: openInNewTab ? '_blank' : null, rel: openInNewTab ? 'noopener noreferrer' : null })
      .run();
    close();
  };

  return (
    <div className="w-72 space-y-2">
      <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500" htmlFor="editor-link-url">
        Link URL
      </label>
      <input
        id="editor-link-url"
        autoFocus
        value={href}
        onChange={(event) => setHref(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            apply();
          }
        }}
        placeholder="https://example.gov.gh"
        className="w-full px-2 py-1.5 text-xs border border-[#c4c5d7] rounded focus:outline-none focus:border-[#0037b0]"
      />
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={openInNewTab} onChange={(event) => setOpenInNewTab(event.target.checked)} />
        Open in new tab
      </label>
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            close();
          }}
          className="px-2 py-1 text-[11px] font-semibold text-gray-500 hover:text-[#ba1a1a]"
        >
          Remove
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={close} className="px-2 py-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="px-3 py-1 text-[11px] font-bold text-white bg-[#0037b0] rounded hover:bg-[#1d4ed8]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

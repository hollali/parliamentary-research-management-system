import React, { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { fileToResizedDataUrl, isImageFile } from '../../lib/imageResize';
import { useToast } from '../../lib/toast';

interface ImagePopoverProps {
  editor: Editor;
  close: () => void;
}

export const ImagePopover: React.FC<ImagePopoverProps> = ({ editor, close }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);

  const insert = (source: string) => {
    if (!source.trim()) return;
    editor.chain().focus().setImage({ src: source.trim(), alt: alt.trim() }).run();
    setSrc('');
    setAlt('');
    close();
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isImageFile(file)) {
      toast.error('Only image files can be inserted.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setSrc(dataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not process that image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-72 space-y-2">
      <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500" htmlFor="editor-image-src">
        Image
      </label>
      <input
        id="editor-image-src"
        value={src.startsWith('data:') ? '(uploaded image ready to insert)' : src}
        onChange={(event) => setSrc(event.target.value)}
        placeholder="Paste an image URL"
        className="w-full px-2 py-1.5 text-xs border border-[#c4c5d7] rounded focus:outline-none focus:border-[#0037b0]"
      />
      <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500" htmlFor="editor-image-alt">
        Alt text
      </label>
      <input
        id="editor-image-alt"
        value={alt}
        onChange={(event) => setAlt(event.target.value)}
        placeholder="Describe the image"
        className="w-full px-2 py-1.5 text-xs border border-[#c4c5d7] rounded focus:outline-none focus:border-[#0037b0]"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void onPickFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="px-2 py-1 text-[11px] font-semibold text-[#0037b0] border border-[#c4c5d7] rounded hover:bg-[#dce1ff]/30 disabled:opacity-50"
        >
          {busy ? 'Processing…' : 'Upload…'}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={close} className="px-2 py-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => insert(src)}
            className="px-3 py-1 text-[11px] font-bold text-white bg-[#0037b0] rounded hover:bg-[#1d4ed8]"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
};

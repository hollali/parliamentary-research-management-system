import React from 'react';
import type { Editor } from '@tiptap/core';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  RemoveFormatting,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Search,
  Type,
} from 'lucide-react';
import { ToolbarButton, ToolbarDivider, ToolbarPopover } from './ToolbarPrimitives';
import { LinkPopover } from './LinkPopover';
import { ImagePopover } from './ImagePopover';
import { TablePopover } from './TablePopover';

interface FormatButtonsProps {
  editor: Editor;
}

export const FormatButtons: React.FC<FormatButtonsProps> = ({ editor }) => (
  <>
    <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
      <Bold className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
      <Italic className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton
      label="Underline"
      active={editor.isActive('underline')}
      onClick={() => editor.chain().focus().toggleUnderline().run()}
    >
      <Underline className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton
      label="Strikethrough"
      active={editor.isActive('strike')}
      onClick={() => editor.chain().focus().toggleStrike().run()}
    >
      <Strikethrough className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton
      label="Superscript"
      active={editor.isActive('superscript')}
      onClick={() => editor.chain().focus().toggleSuperscript().run()}
    >
      <Superscript className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton
      label="Subscript"
      active={editor.isActive('subscript')}
      onClick={() => editor.chain().focus().toggleSubscript().run()}
    >
      <Subscript className="w-3.5 h-3.5" />
    </ToolbarButton>
  </>
);

export const ListButtons: React.FC<FormatButtonsProps> = ({ editor }) => (
  <>
    <ToolbarButton
      label="Bullet list"
      active={editor.isActive('bulletList')}
      onClick={() => editor.chain().focus().toggleBulletList().run()}
    >
      <List className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton
      label="Numbered list"
      active={editor.isActive('orderedList')}
      onClick={() => editor.chain().focus().toggleOrderedList().run()}
    >
      <ListOrdered className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton
      label="Task list"
      active={editor.isActive('taskList')}
      onClick={() => editor.chain().focus().toggleTaskList().run()}
    >
      <ListChecks className="w-3.5 h-3.5" />
    </ToolbarButton>
  </>
);

export const AlignButtons: React.FC<FormatButtonsProps> = ({ editor }) => (
  <>
    <ToolbarButton
      label="Align left"
      active={editor.isActive({ textAlign: 'left' })}
      onClick={() => editor.chain().focus().setTextAlign('left').run()}
    >
      <AlignLeft className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton
      label="Align centre"
      active={editor.isActive({ textAlign: 'center' })}
      onClick={() => editor.chain().focus().setTextAlign('center').run()}
    >
      <AlignCenter className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton
      label="Align right"
      active={editor.isActive({ textAlign: 'right' })}
      onClick={() => editor.chain().focus().setTextAlign('right').run()}
    >
      <AlignRight className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton
      label="Justify"
      active={editor.isActive({ textAlign: 'justify' })}
      onClick={() => editor.chain().focus().setTextAlign('justify').run()}
    >
      <AlignJustify className="w-3.5 h-3.5" />
    </ToolbarButton>
  </>
);

const BLOCK_OPTIONS: { label: string; icon: React.ReactNode; run: (editor: Editor) => void }[] = [
  { label: 'Paragraph', icon: <Type className="w-3.5 h-3.5" />, run: (editor) => editor.chain().focus().setParagraph().run() },
  { label: 'Heading 1', icon: <Heading1 className="w-3.5 h-3.5" />, run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2', icon: <Heading2 className="w-3.5 h-3.5" />, run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3', icon: <Heading3 className="w-3.5 h-3.5" />, run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Heading 4', icon: <Heading4 className="w-3.5 h-3.5" />, run: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run() },
  { label: 'Quote', icon: <Quote className="w-3.5 h-3.5" />, run: (editor) => editor.chain().focus().toggleBlockquote().run() },
];

export function activeBlockLabel(editor: Editor): string {
  for (const level of [1, 2, 3, 4]) {
    if (editor.isActive('heading', { level })) return `Heading ${level}`;
  }
  if (editor.isActive('blockquote')) return 'Quote';
  return 'Paragraph';
}

const HIGHLIGHT_COLORS: { label: string; color: string }[] = [
  { label: 'Yellow', color: '#fef08a' },
  { label: 'Green', color: '#bbf7d0' },
  { label: 'Blue', color: '#bfdbfe' },
  { label: 'Pink', color: '#fbcfe8' },
  { label: 'Grey', color: '#e5e7eb' },
];

interface EditorToolbarProps {
  editor: Editor;
  showFind: boolean;
  onToggleFind: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, showFind, onToggleFind }) => (
  <div className="border-b border-[#c4c5d7] px-4 py-2 flex items-center gap-1 flex-wrap">
    <ToolbarPopover label={activeBlockLabel(editor)}>
      {(close) => (
        <div role="menu" className="w-44">
          {BLOCK_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              role="menuitem"
              onClick={() => {
                option.run(editor);
                close();
              }}
              className="w-full text-left px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 rounded"
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </ToolbarPopover>

    <ToolbarDivider />
    <FormatButtons editor={editor} />

    <ToolbarPopover label="Link" active={editor.isActive('link')}>
      {(close) => <LinkPopover editor={editor} close={close} />}
    </ToolbarPopover>

    <ToolbarPopover label="Highlight" active={editor.isActive('highlight')}>
      {(close) => (
        <div className="w-48 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {HIGHLIGHT_COLORS.map((option) => (
              <button
                key={option.color}
                type="button"
                title={option.label}
                aria-label={`Highlight ${option.label}`}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color: option.color }).run();
                  close();
                }}
                className="w-6 h-6 rounded border border-[#c4c5d7]"
                style={{ backgroundColor: option.color }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              close();
            }}
            className="w-full px-2 py-1 text-[11px] font-semibold text-gray-600 border border-[#c4c5d7] rounded hover:bg-gray-50"
          >
            Remove highlight
          </button>
        </div>
      )}
    </ToolbarPopover>

    <ToolbarButton
      label="Clear formatting"
      onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
    >
      <RemoveFormatting className="w-3.5 h-3.5" />
    </ToolbarButton>

    <ToolbarDivider />
    <ListButtons editor={editor} />

    <ToolbarDivider />
    <AlignButtons editor={editor} />

    <ToolbarDivider />
    <ToolbarButton label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
      <Minus className="w-3.5 h-3.5" />
    </ToolbarButton>

    <ToolbarPopover label="Table" active={editor.isActive('table')}>
      {(close) => <TablePopover editor={editor} close={close} />}
    </ToolbarPopover>

    <ToolbarPopover label="Image">
      {(close) => <ImagePopover editor={editor} close={close} />}
    </ToolbarPopover>

    <ToolbarDivider />
    <ToolbarButton label="Find and replace" active={showFind} onClick={onToggleFind}>
      <Search className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
      <Undo className="w-3.5 h-3.5" />
    </ToolbarButton>
    <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
      <Redo className="w-3.5 h-3.5" />
    </ToolbarButton>
  </div>
);

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { createNodeFromContent } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { TableKit } from '@tiptap/extension-table';
import { EditorToolbar, FormatButtons, ListButtons, activeBlockLabel } from './EditorToolbar';
import { FindReplace } from './FindReplace';
import { ToolbarDivider } from './ToolbarPrimitives';
import { AnnotationHighlight, refreshAnnotations, type AnnotationTarget } from './AnnotationHighlight';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string, text: string) => void;
  onContentLoaded?: (html: string, text: string) => void;
  onReady?: (editor: Editor) => void;
  annotations?: AnnotationTarget[];
  onAnnotationClick?: (commentId: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

const EDITOR_CLASS =
  'font-serif text-sm leading-relaxed min-h-[400px] h-full outline-none p-4 max-w-none';

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  onContentLoaded,
  onReady,
  annotations = [],
  onAnnotationClick,
  placeholder = 'Start drafting the research brief…',
  readOnly = false,
}) => {
  const [showFind, setShowFind] = useState(false);
  const annotationsRef = useRef(annotations);
  const onChangeRef = useRef(onChange);
  const onContentLoadedRef = useRef(onContentLoaded);
  const loadedContent = useRef<string | null>(null);
  const lastReported = useRef<string | null>(null);
  const applyingRef = useRef(false);

  annotationsRef.current = annotations;
  onChangeRef.current = onChange;
  onContentLoadedRef.current = onContentLoaded;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, code: false, codeBlock: false }),
      Highlight.configure({ multicolor: true }),
      Superscript,
      Subscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ allowBase64: true, inline: false }),
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      AnnotationHighlight.configure({
        getTargets: () => annotationsRef.current,
      }),
    ],
    content: '',
    editable: !readOnly,
    editorProps: {
      attributes: { class: EDITOR_CLASS },
      handleClick: (_view, _pos, event) => {
        const target = (event.target as HTMLElement | null)?.closest?.('[data-comment-id]');
        const commentId = target?.getAttribute('data-comment-id');
        if (!commentId) return false;
        onAnnotationClick?.(commentId);
        return false;
      },
    },
    onTransaction: ({ editor: instance, transaction }) => {
      if (applyingRef.current) return;
      if (!transaction.docChanged) return;
      // setEditable also dispatches a doc-changing transaction that is not an
      // officer edit. Comparing serialised HTML means only genuine content
      // changes are reported, so no phantom change is ever saved.
      const html = instance.getHTML();
      if (html === lastReported.current) return;
      lastReported.current = html;
      onChangeRef.current(html, instance.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable === !readOnly) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!editor) return;
    onReadyRef.current?.(editor);
  }, [editor]);

  useEffect(() => {
    if (!editor || loadedContent.current === content) return;
    loadedContent.current = content;
    // setContent dispatches synchronously, so the guard must be raised first.
    // Replacing the document directly with addToHistory:false keeps the loaded
    // draft out of the undo stack, so the first Ctrl+Z cannot wipe it.
    applyingRef.current = true;
    try {
      const node = createNodeFromContent(content || '', editor.schema, {
        parseOptions: editor.options.parseOptions,
      });
      const replacement = node instanceof Fragment ? node : node.content;
      editor.view.dispatch(
        editor.state.tr
          .replaceWith(0, editor.state.doc.content.size, replacement)
          .setMeta('addToHistory', false),
      );
      lastReported.current = editor.getHTML();
    } finally {
      applyingRef.current = false;
    }
    // Report the document as TipTap actually parsed it, so callers can save
    // without waiting for the first keystroke. Deliberately not routed through
    // onChange, which would schedule a redundant autosave on every open.
    onContentLoadedRef.current?.(editor.getHTML(), editor.getText());
  }, [editor, content]);

  useEffect(() => {
    if (!editor) return;
    refreshAnnotations(editor);
  }, [editor, annotations]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      setShowFind((prev) => !prev);
    }
  }, []);

  const words = editor?.storage.characterCount?.words?.() ?? 0;
  const characters = editor?.storage.characterCount?.characters?.() ?? 0;

  return (
    <div className="flex flex-col h-full" onKeyDown={onKeyDown}>
      {editor && !readOnly && (
        <>
          <EditorToolbar editor={editor} showFind={showFind} onToggleFind={() => setShowFind((prev) => !prev)} />
          {showFind && <FindReplace editor={editor} close={() => setShowFind(false)} />}
        </>
      )}

      {editor && (
        <BubbleMenu editor={editor} className="flex items-center gap-0.5 p-1 bg-white border border-[#c4c5d7] rounded-lg shadow-lg">
          <FormatButtons editor={editor} />
          <ToolbarDivider />
          <ListButtons editor={editor} />
          <ToolbarDivider />
          <button
            type="button"
            onClick={() => editor.chain().focus().setParagraph().run()}
            title="Clear block"
            className={`px-2 py-1 rounded text-[11px] font-semibold ${
              activeBlockLabel(editor) === 'Paragraph' ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            ¶
          </button>
        </BubbleMenu>
      )}

      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      <div className="border-t border-[#c4c5d7] px-4 py-1.5 flex items-center justify-between text-[10px] text-gray-500">
        <span>{words.toLocaleString()} words</span>
        <span>{characters.toLocaleString()} characters</span>
      </div>
    </div>
  );
};

export type { Editor };

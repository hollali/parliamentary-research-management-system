import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
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
  annotations = [],
  onAnnotationClick,
  placeholder = 'Start drafting the research brief…',
  readOnly = false,
}) => {
  const [showFind, setShowFind] = useState(false);
  const annotationsRef = useRef(annotations);
  const onChangeRef = useRef(onChange);
  const loadedContent = useRef<string | null>(null);

  annotationsRef.current = annotations;
  onChangeRef.current = onChange;

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
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(instance.getHTML(), instance.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || loadedContent.current === content) return;
    loadedContent.current = content;
    editor.commands.setContent(content || '', { emitUpdate: false });
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

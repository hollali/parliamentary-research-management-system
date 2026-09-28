import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { AnnotationHighlight, annotationHighlightKey, type AnnotationTarget } from '../components/editor/AnnotationHighlight';

function makeEditor(initialTargets: AnnotationTarget[]) {
  let targets = initialTargets;
  const editor = new Editor({
    extensions: [StarterKit, AnnotationHighlight.configure({ getTargets: () => targets })],
    content: '<p>The <strong>economy</strong> is growing</p><p>Growth is slowing</p>',
  });
  return {
    editor,
    setTargets(next: AnnotationTarget[]) {
      targets = next;
      editor.view.dispatch(editor.state.tr.setMeta(annotationHighlightKey, true));
    },
  };
}

function decorationsOf(editor: Editor) {
  return annotationHighlightKey.getState(editor.state)?.find() ?? [];
}

function decorationCount(editor: Editor) {
  return decorationsOf(editor).length;
}

describe('AnnotationHighlight', () => {
  it('decorates the annotated phrase without altering document content', () => {
    const { editor, setTargets } = makeEditor([{ text: 'economy', commentId: 'c1', author: 'Admin' }]);
    const before = editor.getHTML();

    setTargets([{ text: 'economy', commentId: 'c1', author: 'Admin' }]);

    expect(decorationCount(editor)).toBe(1);
    expect(editor.getHTML()).toBe(before);
  });

  it('preserves bold formatting on the annotated run', () => {
    const { editor, setTargets } = makeEditor([]);
    setTargets([{ text: 'economy', commentId: 'c1' }]);

    expect(editor.getHTML()).toContain('<strong>economy</strong>');
    const firstParagraph = editor.getJSON().content?.[0];
    const runs = (firstParagraph?.content ?? []) as { text?: string; marks?: { type: string }[] }[];
    const boldRun = runs.find((run) => run.text === 'economy');
    expect(boldRun?.marks?.[0]?.type).toBe('bold');
  });

  it('tags decorations with the originating comment id', () => {
    const { editor, setTargets } = makeEditor([]);
    setTargets([{ text: 'Growth', commentId: 'comment-42', author: 'Admin' }]);

    const decorations = decorationsOf(editor);
    expect(decorations).toHaveLength(1);
    const inline = decorations[0] as unknown as { type: { attrs: Record<string, string> } };
    expect(inline.type.attrs['data-comment-id']).toBe('comment-42');
    expect(inline.type.attrs.title).toContain('Admin');
  });

  it('decoration is not part of the document and does not create undo steps', () => {
    const { editor, setTargets } = makeEditor([]);
    const undoDepth = editor.state.doc.content.size;

    setTargets([{ text: 'economy', commentId: 'c1' }]);

    expect(editor.state.doc.content.size).toBe(undoDepth);
    expect(editor.getHTML()).not.toContain('annotation-highlight');
  });

  it('ignores annotations that are too short to be meaningful', () => {
    const { editor, setTargets } = makeEditor([]);
    setTargets([{ text: 'is', commentId: 'c1' }, { text: 'ab', commentId: 'c2' }]);
    expect(decorationCount(editor)).toBe(0);
  });

  it('drops the decoration when the annotated phrase is edited away', () => {
    const { editor, setTargets } = makeEditor([]);
    setTargets([{ text: 'economy', commentId: 'c1' }]);
    expect(decorationCount(editor)).toBe(1);

    editor.commands.setContent('<p>The nation is <em>accelerating</em></p><p>Growth is slowing</p>');

    expect(decorationCount(editor)).toBe(0);
  });

  it('picks up newly typed text that matches an open annotation', () => {
    const { editor, setTargets } = makeEditor([]);
    setTargets([{ text: 'economy', commentId: 'c1' }]);
    expect(decorationCount(editor)).toBe(1);

    editor.commands.setContent('<p>The economy is <em>accelerating</em></p>');

    expect(decorationCount(editor)).toBe(1);
  });

  it('adds a decoration for each repeated occurrence', () => {
    const { editor, setTargets } = makeEditor([]);
    setTargets([{ text: 'economy', commentId: 'c1' }]);
    editor.commands.setContent('<p>economy and economy</p>');
    setTargets([{ text: 'economy', commentId: 'c1' }]);
    expect(decorationCount(editor)).toBe(2);
  });
});

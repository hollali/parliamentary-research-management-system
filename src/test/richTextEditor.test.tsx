import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { RichTextEditor } from '../components/editor/RichTextEditor';

function type(editor: Editor, text: string) {
  act(() => {
    editor.commands.insertContent(text);
  });
}

function getProseMirror(): HTMLElement {
  const el = document.querySelector('.tiptap') as HTMLElement;
  if (!el) throw new Error('editor not mounted');
  return el;
}

describe('RichTextEditor save contract', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('reports normalised HTML on load without firing onChange', () => {
    const onChange = vi.fn();
    const onContentLoaded = vi.fn();

    render(
      <RichTextEditor content="<p>Budget Report</p><p><em>Discuss the allocation.</em></p>" onChange={onChange} onContentLoaded={onContentLoaded} />,
    );

    expect(onContentLoaded).toHaveBeenCalledTimes(1);
    const [html, text] = onContentLoaded.mock.calls[0];
    expect(html).toBe('<p>Budget Report</p><p><em>Discuss the allocation.</em></p>');
    expect(text).toBe('Budget Report\n\nDiscuss the allocation.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('loads a plain-text seed as literal text, not as markdown', () => {
    const onContentLoaded = vi.fn();
    render(
      <RichTextEditor content={'# Budget Report\n\n_Discuss the allocation._'} onChange={vi.fn()} onContentLoaded={onContentLoaded} />,
    );

    const [html] = onContentLoaded.mock.calls[0];
    expect(html).toBe('<p># Budget Report _Discuss the allocation._</p>');
  });

  it('does not schedule an autosave merely by opening a draft', () => {
    const onChange = vi.fn();
    const onContentLoaded = vi.fn();

    render(
      <RichTextEditor
        content="A sufficiently long draft body to clear the autosave threshold."
        onChange={onChange}
        onContentLoaded={onContentLoaded}
      />,
    );

    expect(onContentLoaded).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires onChange with HTML as the officer types', () => {
    const onChange = vi.fn();
    const onContentLoaded = vi.fn();
    let editor: Editor | null = null;

    render(
      <RichTextEditor
        content=""
        onChange={onChange}
        onContentLoaded={onContentLoaded}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );

    type(editor!, 'Appended text');

    expect(onChange).toHaveBeenCalled();
    const [html, text] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(html).toContain('Appended text');
    expect(text).toContain('Appended text');
  });

  it('fires onChange for formatting commands that do not alter the plain text', () => {
    const onChange = vi.fn();
    let editor: Editor | null = null;

    render(
      <RichTextEditor
        content="<p>Revenue rose sharply</p>"
        onChange={onChange}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );

    onChange.mockClear();
    act(() => {
      editor!.chain().selectAll().toggleBold().run();
    });

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0]).toContain('<strong>');
  });

  it('does not fire onChange when an edit is undone back to the loaded state', () => {
    const onChange = vi.fn();
    let editor: Editor | null = null;

    render(
      <RichTextEditor
        content="<p>Stable draft</p>"
        onChange={onChange}
        onReady={(instance) => {
          editor = instance;
        }}
      />,
    );

    onChange.mockClear();
    act(() => {
      editor!.commands.insertContent(' extra');
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => {
      editor!.commands.undo();
    });

    expect(onChange.mock.calls.at(-1)![0]).toBe('<p>Stable draft</p>');
  });

  it('loads content that arrives after mount and does not clobber later edits', () => {
    const onChange = vi.fn();
    const onContentLoaded = vi.fn();
    const { rerender } = render(
      <RichTextEditor content="" onChange={onChange} onContentLoaded={onContentLoaded} />,
    );

    rerender(
      <RichTextEditor
        content="<p>Loaded from the server</p>"
        onChange={onChange}
        onContentLoaded={onContentLoaded}
      />,
    );

    expect(getProseMirror().textContent).toContain('Loaded from the server');
    const [html] = onContentLoaded.mock.calls[onContentLoaded.mock.calls.length - 1];
    expect(html).toBe('<p>Loaded from the server</p>');
  });

  it('does not re-apply the same content prop twice', () => {
    const onContentLoaded = vi.fn();
    const { rerender } = render(
      <RichTextEditor content="<p>Stable body</p>" onChange={vi.fn()} onContentLoaded={onContentLoaded} />,
    );
    rerender(<RichTextEditor content="<p>Stable body</p>" onChange={vi.fn()} onContentLoaded={onContentLoaded} />);

    expect(onContentLoaded).toHaveBeenCalledTimes(1);
  });

  it('preserves rich formatting in the reported HTML', () => {
    const onContentLoaded = vi.fn();
    render(
      <RichTextEditor
        content={'<h2>Findings</h2><ul><li><strong>Revenue</strong> rose</li></ul><p>See <a href="https://x.test">source</a></p>'}
        onChange={vi.fn()}
        onContentLoaded={onContentLoaded}
      />,
    );

    const [html] = onContentLoaded.mock.calls[0];
    expect(html).toContain('<h2>Findings</h2>');
    expect(html).toContain('<strong>Revenue</strong>');
    expect(html).toContain('href="https://x.test"');
  });

  it('renders a table and image without throwing', () => {
    const onContentLoaded = vi.fn();
    render(
      <RichTextEditor
        content={
          '<table><tbody><tr><th><p>Year</p></th><th><p>Total</p></th></tr><tr><td><p>2025</p></td><td><p>GH¢4.2m</p></td></tr></tbody></table>' +
          '<p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Chart"></p>'
        }
        onChange={vi.fn()}
        onContentLoaded={onContentLoaded}
      />,
    );

    expect(document.querySelector('.tiptap table')).toBeTruthy();
    expect(document.querySelector('.tiptap img')).toBeTruthy();
  });

  it('applies reviewer annotations as decorations without touching content', () => {
    const onContentLoaded = vi.fn();
    render(
      <RichTextEditor
        content="<p>The economy is growing</p>"
        onChange={vi.fn()}
        onContentLoaded={onContentLoaded}
        annotations={[{ text: 'economy', commentId: 'c1', author: 'Admin' }]}
      />,
    );

    const [html] = onContentLoaded.mock.calls[0];
    expect(html).toBe('<p>The economy is growing</p>');
    expect(document.querySelector('.annotation-highlight')?.textContent).toBe('economy');
  });

  it('hides the toolbar and is not editable when readOnly', () => {
    render(<RichTextEditor content="<p>Locked</p>" onChange={vi.fn()} readOnly />);

    expect(screen.queryByLabelText('Bold')).toBeNull();
    expect(getProseMirror().getAttribute('contenteditable')).toBe('false');
  });
});

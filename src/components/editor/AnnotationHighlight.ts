import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { collectDocText, findDocRanges } from '../../lib/docText';

export interface AnnotationTarget {
  text: string;
  commentId: string;
  author?: string;
}

export const annotationHighlightKey = new PluginKey<DecorationSet>('annotationHighlight');

export const AnnotationHighlight = Extension.create<{ getTargets: () => AnnotationTarget[] }>({
  name: 'annotationHighlight',

  addOptions() {
    return { getTargets: () => [] };
  },

  addProseMirrorPlugins() {
    const { getTargets } = this.options;

    const build = (doc: ProseMirrorNode): DecorationSet => {
      const docText = collectDocText(doc);
      const decorations: Decoration[] = [];
      const seen = new Set<string>();

      for (const target of getTargets()) {
        const needle = target.text?.trim();
        if (!needle || needle.length < 3) continue;

        for (const range of findDocRanges(docText, needle)) {
          const key = `${range.from}:${range.to}`;
          if (seen.has(key)) continue;
          seen.add(key);

          decorations.push(
            Decoration.inline(range.from, range.to, {
              class: 'annotation-highlight',
              'data-comment-id': target.commentId,
              title: target.author ? `Annotated by ${target.author}` : 'Annotated for review',
            }),
          );
        }
      }

      return DecorationSet.create(doc, decorations);
    };

    return [
      new Plugin({
        key: annotationHighlightKey,
        state: {
          init: (_config, state) => build(state.doc),
          apply: (tr, previous, _oldState, newState) => {
            if (tr.docChanged || tr.getMeta(annotationHighlightKey)) return build(newState.doc);
            return previous;
          },
        },
        props: {
          decorations(state) {
            return annotationHighlightKey.getState(state);
          },
        },
      }),
    ];
  },
});

export function refreshAnnotations(editor: Editor | null) {
  if (!editor) return;
  editor.view.dispatch(editor.state.tr.setMeta(annotationHighlightKey, true));
}

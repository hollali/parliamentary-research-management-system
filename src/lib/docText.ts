import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface DocText {
  text: string;
  positions: (number | null)[];
}

export interface DocRange {
  from: number;
  to: number;
}

export interface FindOptions {
  caseSensitive?: boolean;
}

const BLOCK_SEPARATOR = '\n';

export function collectDocText(doc: ProseMirrorNode): DocText {
  const chars: string[] = [];
  const positions: (number | null)[] = [];
  let currentBlock: ProseMirrorNode | null = null;

  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text) return;
    if (currentBlock !== null && currentBlock !== parent) {
      chars.push(BLOCK_SEPARATOR);
      positions.push(null);
    }
    currentBlock = parent;
    for (let i = 0; i < node.text.length; i += 1) {
      chars.push(node.text[i]);
      positions.push(pos + i);
    }
  });

  return { text: chars.join(''), positions };
}

export function findDocRanges(docText: DocText, query: string, options: FindOptions = {}): DocRange[] {
  if (!query) return [];

  const haystack = options.caseSensitive ? docText.text : docText.text.toLowerCase();
  const term = options.caseSensitive ? query : query.toLowerCase();
  const ranges: DocRange[] = [];

  let index = haystack.indexOf(term);
  while (index !== -1) {
    const range = rangeAt(docText, index, term.length);
    if (range) ranges.push(range);
    index = haystack.indexOf(term, index + term.length);
  }

  return ranges;
}

export function countMatches(docText: DocText, query: string, options: FindOptions = {}): number {
  return findDocRanges(docText, query, options).length;
}

function rangeAt(docText: DocText, start: number, length: number): DocRange | null {
  const from = positionAt(docText, start);
  const to = positionAt(docText, start + length - 1);
  if (from === null || to === null) return null;

  for (let i = start; i <= start + length - 1; i += 1) {
    if (positionAt(docText, i) === null) return null;
  }

  return { from, to: to + 1 };
}

function positionAt(docText: DocText, index: number): number | null {
  if (index < 0 || index >= docText.positions.length) return null;
  return docText.positions[index];
}

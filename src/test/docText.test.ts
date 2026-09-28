import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { collectDocText, findDocRanges, countMatches, type DocText } from '../lib/docText';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    heading: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
  },
});

function makeDoc() {
  return schema.nodeFromJSON({
    type: 'doc',
    content: [
      { type: 'heading', content: [{ type: 'text', text: 'Executive Summary' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The economy is growing' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Growth is slowing' }] },
    ],
  });
}

describe('collectDocText', () => {
  it('joins blocks with a separator so phrases cannot span block boundaries', () => {
    const docText = collectDocText(makeDoc());
    expect(docText.text).toBe('Executive Summary\nThe economy is growing\nGrowth is slowing');
  });

  it('maps every character back to a document position', () => {
    const doc = makeDoc();
    const docText = collectDocText(doc);
    const real = docText.positions.filter((p): p is number => p !== null);
    expect(real.length).toBe(docText.text.replace(/\n/g, '').length);
  });
});

describe('findDocRanges', () => {
  it('returns ranges that resolve back to the searched text', () => {
    const doc = makeDoc();
    const docText = collectDocText(doc);
    const ranges = findDocRanges(docText, 'economy');

    expect(ranges).toHaveLength(1);
    expect(doc.textBetween(ranges[0].from, ranges[0].to)).toBe('economy');
  });

  it('finds every occurrence across separate blocks', () => {
    const docText = collectDocText(makeDoc());
    const ranges = findDocRanges(docText, 'Growth');

    expect(ranges).toHaveLength(1);
    expect(countMatches(docText, 'is')).toBe(2);
  });
  it('is case-insensitive by default and respects caseSensitive', () => {
    const docText = collectDocText(makeDoc());

    expect(findDocRanges(docText, 'ECONOMY')).toHaveLength(1);
    expect(findDocRanges(docText, 'ECONOMY', { caseSensitive: true })).toHaveLength(0);
    expect(findDocRanges(docText, 'economy', { caseSensitive: true })).toHaveLength(1);
  });

  it('matches substrings rather than whole words', () => {
    const docText = collectDocText(makeDoc());
    expect(findDocRanges(docText, 'growth')).toHaveLength(1);
    expect(findDocRanges(docText, 'grow')).toHaveLength(2);
  });

  it('never matches across a block boundary', () => {
    const docText = collectDocText(makeDoc());
    expect(findDocRanges(docText, 'growingGrowth')).toHaveLength(0);
  });

  it('drops ranges whose characters are not addressable', () => {
    const manual: DocText = {
      text: 'hello\nworld',
      positions: [1, 2, 3, 4, 5, null, 7, 8, 9, 10, 11],
    };
    expect(findDocRanges(manual, 'o\nw')).toHaveLength(0);
  });

  it('returns nothing for an empty query', () => {
    const docText = collectDocText(makeDoc());
    expect(findDocRanges(docText, '')).toHaveLength(0);
  });
});

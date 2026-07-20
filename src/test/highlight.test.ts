import { describe, it, expect } from 'vitest';
import { highlightText } from '../lib/highlight';

describe('Inline Annotation Highlighting', () => {
  it('returns plain text when no highlights', () => {
    const result = highlightText('Hello world', []);
    expect(result).toBe('Hello world');
  });

  it('highlights matching text', () => {
    const result = highlightText('The economy is growing rapidly', [
      { highlightedText: 'economy' },
    ]);
    expect(result).toContain('<mark');
    expect(result).toContain('economy');
  });

  it('highlights case-insensitively', () => {
    const result = highlightText('The Economy is growing', [
      { highlightedText: 'economy' },
    ]);
    expect(result).toContain('Economy');
    expect(result.match(/<mark/g)?.length).toBe(1);
  });

  it('highlights multiple occurrences', () => {
    const result = highlightText('tax policy and tax reform', [
      { highlightedText: 'tax' },
    ]);
    expect(result.match(/<mark/g)?.length).toBe(2);
  });

  it('ignores short highlighted text (<=2 chars)', () => {
    const result = highlightText('The economy', [
      { highlightedText: 'ab' },
    ]);
    expect(result).not.toContain('<mark');
  });

  it('escapes HTML in content', () => {
    const result = highlightText('<script>alert("xss")</script>', []);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('highlights multiple different phrases', () => {
    const result = highlightText('economy and education', [
      { highlightedText: 'economy' },
      { highlightedText: 'education' },
    ]);
    expect(result.match(/<mark/g)?.length).toBe(2);
  });
});

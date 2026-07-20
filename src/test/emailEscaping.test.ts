import { describe, it, expect } from 'vitest';
import { esc } from '../../server/lib/email';

describe('Email HTML escaping', () => {
  it('escapes ampersands', () => {
    expect(esc('A & B')).toBe('A &amp; B');
  });

  it('escapes angle brackets', () => {
    expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes single quotes', () => {
    expect(esc("it's a test")).toBe('it&#39;s a test');
  });

  it('handles null/undefined gracefully', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('converts numbers to strings', () => {
    expect(esc(42)).toBe('42');
  });

  it('handles empty string', () => {
    expect(esc('')).toBe('');
  });

  it('preserves safe text', () => {
    expect(esc('Hello World 123')).toBe('Hello World 123');
  });

  it('escapes multiple special characters in one string', () => {
    expect(esc('Tom & Jerry <3 "best" show\'s')).toBe('Tom &amp; Jerry &lt;3 &quot;best&quot; show&#39;s');
  });
});

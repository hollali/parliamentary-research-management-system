import { describe, it, expect } from 'vitest';
import { sanitizeRichText, sanitizePlainText } from '../../server/lib/sanitize';
import { escapeHtml, escapeRegExp } from '../lib/html';

describe('sanitizeRichText — script execution', () => {
  it('removes <script> elements and their contents', () => {
    const out = sanitizeRichText('<p>before</p><script>alert(1)</script><p>after</p>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });

  it('removes event handler attributes', () => {
    const out = sanitizeRichText('<p onclick="steal()">hi</p>');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('steal');
    expect(out).toBe('<p>hi</p>');
  });

  it('removes img onerror payloads', () => {
    const out = sanitizeRichText('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('alert(1)');
  });

  it('escapes stray angle brackets in text', () => {
    expect(sanitizeRichText('a < b and c > d')).toBe('a &lt; b and c &gt; d');
  });

  it('drops javascript: and data:text/html URLs but keeps the element', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeRichText('<a href="data:text/html,<script>">x</a>')).toBe('<a>x</a>');
  });

  it('strips control characters used to smuggle a javascript: scheme', () => {
    const out = sanitizeRichText('<a href="java\tscript:alert(1)">x</a>');
    expect(out).not.toContain('javascript');
    expect(out).toBe('<a>x</a>');
  });

  it('keeps safe URLs', () => {
    expect(sanitizeRichText('<a href="https://parliament.gh/x">x</a>')).toContain('href="https://parliament.gh/x"');
    expect(sanitizeRichText('<a href="/briefs/REQ-2026-1234">x</a>')).toContain('href="/briefs/REQ-2026-1234"');
    expect(sanitizeRichText('<a href="mailto:a@b.gh">x</a>')).toContain('mailto:');
  });

  it('forces noopener noreferrer on every surviving link', () => {
    const out = sanitizeRichText('<a href="https://evil.example" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('drops disallowed elements such as iframe, form and style', () => {
    expect(sanitizeRichText('<iframe src="https://evil.example"></iframe>')).toBe('');
    expect(sanitizeRichText('<form action="/x"><input name="a" /></form>')).toBe('');
    expect(sanitizeRichText('<style>body{display:none}</style>')).toBe('');
  });

  it('drops classes outside the editor allowlist', () => {
    const out = sanitizeRichText('<p class="text-center evil-admin-class">x</p>');
    expect(out).toContain('text-center');
    expect(out).not.toContain('evil-admin-class');
  });

  it('preserves editor formatting markup', () => {
    expect(sanitizeRichText('<p><strong>bold</strong> and <em>italic</em></p>')).toBe(
      '<p><strong>bold</strong> and <em>italic</em></p>',
    );
    expect(sanitizeRichText('<ul><li>one</li><li>two</li></ul>')).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  it('preserves data-annotation-id used by the annotation workflow', () => {
    const out = sanitizeRichText('<span data-annotation-id="abc-123" class="highlight">t</span>');
    expect(out).toContain('data-annotation-id="abc-123"');
    expect(out).toContain('class="highlight"');
  });

  it('drops HTML comments and processing instructions', () => {
    expect(sanitizeRichText('a<!-- <script>alert(1)</script> -->b')).toBe('ab');
  });

  it('returns an empty string for non-string input instead of throwing', () => {
    expect(sanitizeRichText(null)).toBe('');
    expect(sanitizeRichText(undefined)).toBe('');
    expect(sanitizeRichText(42)).toBe('');
    expect(sanitizeRichText({ toString: () => '<script>' })).toBe('');
  });

  it('is not fooled by an unterminated tag', () => {
    expect(sanitizeRichText('<p class="x')).toBe('&lt;p class=&quot;x');
  });
});

describe('sanitizePlainText', () => {
  it('strips all markup', () => {
    expect(sanitizePlainText('<p>hello <strong>world</strong></p>')).toBe('hello world');
  });

  it('strips script content entirely', () => {
    expect(sanitizePlainText('hi<script>alert(1)</script>')).toBe('hi');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizePlainText(null)).toBe('');
  });
});

describe('escapeHtml / escapeRegExp', () => {
  it('escapes the five significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;',
    );
  });

  it('escapes regex metacharacters so user input cannot break a pattern', () => {
    const evil = 'a.*b(c)[d]{e}+?f^g$h|i\\j';
    // The escaped pattern must match its own source text literally...
    expect(new RegExp(escapeRegExp(evil), 'g').test(evil)).toBe(true);
    // ...and must NOT act as a wildcard over other text.
    const text = `before ${evil} after`;
    expect(text.replace(new RegExp(escapeRegExp(evil), 'g'), 'MATCH')).toBe('before MATCH after');
    expect('axxb(c)'.replace(new RegExp(escapeRegExp('a.*b(c)'), 'g'), 'MATCH')).toBe('axxb(c)');
  });
});

import { describe, it, expect } from 'vitest';
import { buildPrintHtml } from '../lib/exportHtml';

const columns = [
  { key: 'requestNumber', label: 'Request' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
];

const XSS = '<img src=x onerror="window.__pwned=1">';

describe('buildPrintHtml', () => {
  it('escapes a malicious request title in both <title> and <h1>', () => {
    const html = buildPrintHtml({ title: XSS, data: [], columns });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('onerror="window.__pwned=1"');
    expect(html).toContain('&lt;img src=x');
  });

  it('escapes malicious cell values', () => {
    const html = buildPrintHtml({
      title: 'Requests',
      data: [{ requestNumber: 'REQ-2026-0001', title: XSS, status: 'SUBMITTED' }],
      columns,
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('escapes a malicious column label', () => {
    const html = buildPrintHtml({
      title: 'Requests',
      data: [],
      columns: [{ key: 'a', label: XSS }],
    });
    expect(html).not.toContain('<img src=x');
  });

  it('neutralises a script tag in a cell', () => {
    const html = buildPrintHtml({
      title: 'Requests',
      data: [{ requestNumber: 'X', title: '</td></tr><script>window.__pwned=1</script>', status: 'A' }],
      columns,
    });
    expect(html).not.toContain('<script>window.__pwned=1</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders null and undefined cells as empty strings', () => {
    const html = buildPrintHtml({
      title: 'Requests',
      data: [{ requestNumber: null, title: undefined, status: 'OK' }],
      columns,
    });
    expect(html).toContain('<td></td>');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
  });

  it('applies a column formatter before escaping', () => {
    const html = buildPrintHtml({
      title: 'Requests',
      data: [{ requestNumber: 'REQ-2026-0001', title: '<b>x</b>', status: 'OK' }],
      columns: [
        { key: 'requestNumber', label: 'Request' },
        { key: 'title', label: 'Title', format: (v) => `[${v}]` },
      ],
    });
    // The formatter's brackets survive, but the markup it wrapped is escaped.
    expect(html).toContain('[&lt;b&gt;x&lt;/b&gt;]');
  });

  it('always includes the print trigger script and nothing else executable', () => {
    const html = buildPrintHtml({ title: 'Requests', data: [], columns });
    const scripts = html.match(/<script>[\s\S]*?<\/script>/g) ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain('window.print()');
  });

  it('renders an empty body for no rows without throwing', () => {
    const html = buildPrintHtml({ title: 'Requests', data: [], columns });
    expect(html).toContain('<tbody></tbody>');
  });
});

import { escapeHtml, escapeRegExp } from "./html";

export function highlightText(text: string, comments: { highlightedText?: string }[]): string {
  const highlights = comments
    .filter(c => c.highlightedText && c.highlightedText.length > 2)
    .map(c => c.highlightedText!);
  if (highlights.length === 0) return escapeHtml(text);
  let html = escapeHtml(text);
  for (const h of highlights) {
    // Escape the needle for regex, then for HTML. The capture group is only
    // ever emitted as element content, never inside an attribute, so escaping
    // the five HTML-significant characters is sufficient.
    const escaped = escapeHtml(escapeRegExp(h));
    const regex = new RegExp(`(${escaped})`, 'gi');
    html = html.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 px-0.5 rounded cursor-pointer" title="Annotated by admin">$1</mark>');
  }
  return html;
}

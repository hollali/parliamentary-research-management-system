export function highlightText(text: string, comments: { highlightedText?: string }[]): string {
  const highlights = comments
    .filter(c => c.highlightedText && c.highlightedText.length > 2)
    .map(c => c.highlightedText!);
  if (highlights.length === 0) return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const h of highlights) {
    const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const regex = new RegExp(`(${escaped})`, 'gi');
    html = html.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 px-0.5 rounded cursor-pointer" title="Annotated by admin">$1</mark>');
  }
  return html;
}

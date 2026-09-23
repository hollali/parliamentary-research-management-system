export const isHtmlContent = (s?: string | null): boolean =>
  typeof s === 'string' &&
  /^\s*</.test(s) &&
  /<\/(p|h[1-6]|div|li|ul|ol|blockquote|hr|strong|em|br)>/i.test(s);

export const stripHtmlTags = (s?: string | null): string => {
  if (!s) return '';
  return String(s)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|h[1-6]|div|li|ul|ol|blockquote|tr|section|article)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const toPlainText = (content?: string | null): string =>
  isHtmlContent(content) ? stripHtmlTags(content) : (content || '');
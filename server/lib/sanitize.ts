/**
 * Server-side HTML sanitization for user-supplied rich text.
 *
 * Report bodies and review comments accept HTML from the TipTap editor. The
 * current client render path happens to escape everything, but the API is the
 * trust boundary: any future consumer that renders `content` as HTML (a PDF
 * pipeline, a mobile client, an export) would otherwise be instantly
 * scriptable, with no second line of defense.
 *
 * Implemented as a strict allowlist sanitizer with no external dependency.
 * Anything not explicitly permitted is dropped.
 */

// Elements the TipTap editor produces, plus the formatting a brief may use.
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "span", "div",
  "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
  "mark",
]);

/**
 * Elements whose *content* is not display text. Dropping only the tag would
 * spill the body straight into the rendered output — `<script>alert(1)</script>`
 * became visible "alert(1)" text, and `<style>body{...}</style>` leaked CSS.
 * For these, the content is discarded along with the tag.
 */
const RAW_TEXT_TAGS = new Set([
  "script", "style", "textarea", "title", "noscript", "iframe",
  "template", "xmp", "plaintext", "listing", "frameset", "noframes",
]);

// Attributes permitted per tag. `class` is limited separately below because
// TipTap uses it for alignment/indent classes.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  col: new Set(["span", "width"]),
  "*": new Set(["class", "data-annotation-id", "data-comment-id"]),
};

// Class names the editor emits. Anything else is dropped so an attacker cannot
// borrow application styling or hook onto existing selectors.
const ALLOWED_CLASSES = new Set([
  "text-left", "text-center", "text-right", "text-justify",
  "highlight", "annotation", "underline", "strike",
  "list-disc", "list-ordered", "indent-1", "indent-2", "indent-3",
  "bg-yellow-200", "text-yellow-900", "px-0.5", "rounded", "cursor-pointer",
]);

const SAFE_URL_SCHEME = /^(https?:|mailto:|tel:|#|\/)/i;

/**
 * Raster images only. `data:image/svg+xml` is deliberately excluded: an SVG
 * payload can carry a <script> block, so "it is an image" is not a safety
 * guarantee.
 */
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i;

function isSafeUrl(value: string): boolean {
  // Strip control characters and whitespace that can be used to smuggle
  // "java\tscript:" past a naive scheme check.
  const cleaned = value.replace(/[\u0000-\u001f\u007f\s]/g, "");
  if (SAFE_DATA_IMAGE.test(cleaned)) return true;
  return SAFE_URL_SCHEME.test(cleaned);
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Index of the `>` that closes the tag opened at `start`, ignoring any `>`
 * inside a quoted attribute value. Without this, `<a href="data:text/html,x">`
 * was cut short at the inner `>` and the remainder leaked as text.
 * Returns -1 when the tag is never closed.
 */
function findTagEnd(input: string, start: number): number {
  let quote: string | null = null;
  for (let i = start + 1; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i;
    }
  }
  return -1;
}

/** Skip past the closing tag of a raw-text element, returning the new index. */
function skipRawTextContent(input: string, afterOpenTag: number, tag: string): number {
  const close = input.toLowerCase().indexOf(`</${tag}`, afterOpenTag);
  if (close === -1) return input.length;
  const end = findTagEnd(input, close);
  return end === -1 ? input.length : end + 1;
}

function sanitizeAttributes(tag: string, raw: string): string {
  const allowed = new Set([...(ALLOWED_ATTRS[tag] ?? []), ...(ALLOWED_ATTRS["*"] ?? [])]);
  const out: string[] = [];
  let hasHref = false;

  for (const match of raw.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>=`]+))/g)) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    if (!allowed.has(name)) continue;

    if (name === "href" || name === "src") {
      if (!isSafeUrl(value)) continue;
      if (name === "href") hasHref = true;
      out.push(`${name}="${escapeText(value)}"`);
      continue;
    }
    if (name === "target") {
      out.push('target="_blank"');
      continue;
    }
    if (name === "rel") {
      // External links get noopener/noreferrer so a crafted link cannot reach
      // back into this application. Added unconditionally below as well.
      continue;
    }
    if (name === "class") {
      const kept = value.split(/\s+/).filter((c) => ALLOWED_CLASSES.has(c));
      if (kept.length) out.push(`class="${escapeText(kept.join(" "))}"`);
      continue;
    }
    out.push(`${name}="${escapeText(value)}"`);
  }

  // Every surviving external link is force-hardened. Relying on the author to
  // have written rel="noopener" left the default (which includes _blank via
  // `target`) reverse-tabnabbable.
  if (tag === "a" && hasHref) {
    out.push('rel="noopener noreferrer"');
  }

  return out.length ? ` ${out.join(" ")}` : "";
}

/**
 * Sanitize an HTML fragment down to the editor's allowed element set.
 * Non-string input yields an empty string rather than throwing.
 */
export function sanitizeRichText(input: unknown): string {
  if (typeof input !== "string") return "";

  let out = "";
  let index = 0;

  while (index < input.length) {
    const lt = input.indexOf("<", index);
    if (lt === -1) {
      out += escapeText(input.slice(index));
      break;
    }
    out += escapeText(input.slice(index, lt));

    // Comments, CDATA and processing instructions are dropped outright.
    if (input.startsWith("<!--", lt)) {
      const end = input.indexOf("-->", lt);
      index = end === -1 ? input.length : end + 3;
      continue;
    }
    if (input.startsWith("<!", lt) || input.startsWith("<?", lt)) {
      const end = findTagEnd(input, lt);
      index = end === -1 ? input.length : end + 1;
      continue;
    }

    // A bare `<` is ordinary text ("a < b"). Only treat it as a tag when it
    // actually looks like one, otherwise everything up to the next `>` was
    // silently deleted.
    if (!/^<(\/?[a-zA-Z][a-zA-Z0-9-]*|\/)/.test(input.slice(lt, lt + 32))) {
      out += "&lt;";
      index = lt + 1;
      continue;
    }

    const gt = findTagEnd(input, lt);
    if (gt === -1) {
      out += escapeText(input.slice(lt));
      break;
    }

    const rawTag = input.slice(lt + 1, gt);
    index = gt + 1;

    const isClosing = rawTag.startsWith("/");
    const selfClosing = rawTag.endsWith("/");
    const body = (isClosing ? rawTag.slice(1) : rawTag).replace(/\/$/, "");
    const nameMatch = body.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
    if (!nameMatch) continue;

    const tag = nameMatch[1].toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      // Discard the body of raw-text elements along with the tag.
      if (!isClosing && !selfClosing && RAW_TEXT_TAGS.has(tag)) {
        index = skipRawTextContent(input, index, tag);
      }
      continue;
    }

    if (isClosing) {
      out += `</${tag}>`;
      continue;
    }

    out += `<${tag}${sanitizeAttributes(tag, body.slice(nameMatch[1].length))}${selfClosing ? " /" : ""}>`;
  }

  return out;
}

/** Strip all markup, leaving plain text. Used for comment bodies and titles. */
export function sanitizePlainText(input: unknown): string {
  if (typeof input !== "string") return "";
  return sanitizeRichText(input).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
}

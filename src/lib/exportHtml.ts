import { escapeHtml } from "./html";

export interface ExportColumn {
  key: string;
  label: string;
  format?: (val: any) => string;
}

/**
 * Builds the standalone HTML document used by the "Print / PDF" export.
 *
 * This is written into a new window with `document.write`, which parses it as
 * HTML. Every interpolated value therefore originates from user-supplied
 * records — request titles, descriptions, comment text, member names — and must
 * be escaped. A request titled `<img src=x onerror=...>` previously executed
 * script in the print context.
 *
 * Kept as a pure function so the escaping is unit-testable.
 */
export function buildPrintHtml(options: {
  title: string;
  data: any[];
  columns: ExportColumn[];
  exportedOn?: string;
}): string {
  const { title, data, columns, exportedOn } = options;

  const safeTitle = escapeHtml(title);
  const dateLabel =
    exportedOn ??
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const headerCells = columns
    .map((c) => `<th>${escapeHtml(c.label)}</th>`)
    .join("");

  const bodyRows = data
    .map((row) => {
      const cells = columns
        .map((c) => {
          let val = row[c.key];
          if (val === null || val === undefined) val = "";
          if (c.format) val = c.format(val);
          return `<td>${escapeHtml(String(val))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <title>${safeTitle}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
    h1 { font-size: 18px; color: #191c1d; margin-bottom: 4px; }
    .subtitle { font-size: 11px; color: #888; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f3f4f5; text-align: left; padding: 8px 12px; border-bottom: 2px solid #c4c5d7; font-weight: 700; color: #191c1d; }
    td { padding: 6px 12px; border-bottom: 1px solid #eee; }
    tr:hover td { background: #f9fafb; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p class="subtitle">Exported on ${escapeHtml(dateLabel)}</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

// PDF export via the browser's own print pipeline: the same approach the
// e-ID cards use. It avoids shipping a PDF library for what is essentially a
// styled table, and "Save as PDF" is already the print destination people reach
// for. Returns false when the window was blocked so callers can say so.
export function exportToPdf(
  rows: Record<string, unknown>[],
  filename: string,
  opts: { title: string; subtitle?: string; meta?: string[] } = { title: 'Report' },
): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const esc = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const head = columns.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = rows.length
    ? rows.map((r) => `<tr>${columns.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty">No rows matched the selected filters.</td></tr>`;

  win.document.write(`<!doctype html>
<html><head><meta charset="utf-8" /><title>${esc(filename)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 28px; color: #131C4E; }
  header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #F56B22; padding-bottom: 12px; margin-bottom: 6px; }
  h1 { font-size: 19px; margin: 0; }
  .sub { font-size: 12px; color: #6B7480; margin-top: 4px; }
  .meta { font-size: 11px; color: #6B7480; margin: 10px 0 16px; }
  .meta span { margin-right: 14px; }
  .count { font-size: 11px; color: #9CA3B8; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #F7F8FC; text-align: left; padding: 7px 8px; border-bottom: 1px solid #E5E7F1;
       font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7480; }
  td { padding: 6px 8px; border-bottom: 1px solid #F0F1F5; }
  tr:nth-child(even) td { background: #FCFCFD; }
  .empty { text-align: center; color: #9CA3B8; padding: 22px; }
  @page { size: A4 landscape; margin: 12mm; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
</style></head>
<body>
  <header>
    <div>
      <h1>${esc(opts.title)}</h1>
      ${opts.subtitle ? `<div class="sub">${esc(opts.subtitle)}</div>` : ''}
    </div>
    <div class="count">${rows.length.toLocaleString()} row${rows.length === 1 ? '' : 's'}<br/>${esc(new Date().toLocaleString('en-GB'))}</div>
  </header>
  ${opts.meta?.length ? `<div class="meta">${opts.meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`);
  win.document.close();
  win.focus();
  // Let the document lay out before invoking print, otherwise Safari prints blank.
  setTimeout(() => win.print(), 250);
  return true;
}

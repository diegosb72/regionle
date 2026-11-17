/** A table as a CSV file that spreadsheets and Anki read. */

/** A cell as it is written: in quotes when it holds the separator, a quote, a line break or spaces at its ends. */
function cell(value: string | number, sep: string): string {
  const s = String(value);
  return s.includes(sep) || /["\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The rows as CSV text (RFC 4180: lines end in CR LF, a quote inside a cell is doubled). It starts with a
 * byte order mark, without which Excel reads the accents wrong.
 */
export function toCsv(rows: readonly (readonly (string | number)[])[], sep: ',' | ';' = ','): string {
  return `\uFEFF${rows.map((row) => row.map((v) => cell(v, sep)).join(sep)).join('\r\n')}\r\n`;
}

/** A moment as a day, "2026-11-17", in the time of whoever reads it; nothing when there is none. */
export function csvDay(t: number): string {
  if (!t || !Number.isFinite(t)) return '';
  const d = new Date(t);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

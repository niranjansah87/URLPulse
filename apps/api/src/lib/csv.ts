import { ValidationError } from "./errors";

/**
 * Minimal RFC 4180-style CSV parser, scoped to what URLPulse needs: extract the
 * list of URL strings from an uploaded file. No CSV dependency is pulled in for
 * this - the grammar we support (quoted fields, embedded commas/quotes/newlines,
 * CRLF or LF) is small and auditable.
 *
 * Column selection: if the first row contains a cell equal to "url"
 * (case-insensitive), that column is the URL column; otherwise the first column
 * is used and the file is treated as headerless. Blank rows are skipped. Values
 * are trimmed; final validation (syntax, scheme) happens in the batch service
 * against the shared schema, so JSON and CSV converge on one validation path.
 *
 * Throws ValidationError on structurally malformed input (e.g. an unterminated
 * quoted field) so a bad upload is rejected rather than partially accepted.
 */
export function parseCsvUrls(text: string): string[] {
  const rows = parseRows(text);
  const header = rows[0];
  if (!header) return [];
  const headerIdx = header.findIndex((cell) => cell.trim().toLowerCase() === "url");
  const hasHeader = headerIdx !== -1;
  const col = hasHeader ? headerIdx : 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const urls: string[] = [];
  for (const row of dataRows) {
    const value = (row[col] ?? "").trim();
    if (value === "") continue; // skip blank rows / empty cells
    urls.push(value);
  }
  return urls;
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let rowHasContent = false;

  const pushField = (): void => {
    row.push(field);
    field = "";
  };
  const pushRow = (): void => {
    pushField();
    // Ignore rows that are entirely empty (e.g. trailing newline).
    if (rowHasContent) rows.push(row);
    row = [];
    rowHasContent = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === undefined) break;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      rowHasContent = true;
    } else if (ch === ",") {
      rowHasContent = true;
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      // handle CRLF and lone CR; the \n (if any) is consumed by the next iter
      if (text[i + 1] === "\n") i += 1;
      pushRow();
    } else {
      field += ch;
      if (ch.trim() !== "") rowHasContent = true;
    }
  }

  if (inQuotes) {
    throw new ValidationError("Malformed CSV: unterminated quoted field");
  }

  // Flush the last field/row if the file did not end with a newline.
  if (field !== "" || row.length > 0) pushRow();

  return rows;
}

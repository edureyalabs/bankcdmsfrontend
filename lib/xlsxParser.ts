// FILE PATH: bank_cdms_dashboard/lib/xlsxParser.ts — NEW FILE
//
// Parses one brand collection file (xlsx or csv) per the fixed layout:
//   - "Bill From Date:" and "Bill To Date:" are label cells; the actual
//     date VALUE sits in the cell immediately to the right (same row),
//     e.g. E5="Bill From Date:" / F5="01/01/2026". We search for the
//     labels within the metadata block (first ~15 rows) rather than
//     trusting a fixed cell address, since label text is stable but its
//     exact row/column has been seen to vary slightly between exports.
//   - Header row is row 13 (1-indexed), data starts row 14.
//   - Data continues until the first fully blank row (Sr No is blank).
//   - "Bill No" -> invoice_no, "Coll. Amt" -> collected_amount.
//   - Only rows whose "Status" is in validStatuses are summed.
//   - Coll. Amt may arrive as text (e.g. "5,587.00") — must be coerced to
//     a clean number before summing.

import * as XLSX from "xlsx";

const HEADER_ROW_1INDEXED = 13; // row containing column titles (Sr No, Collection Refr, ...)
const DATA_START_ROW_1INDEXED = HEADER_ROW_1INDEXED + 1;
const METADATA_SEARCH_ROW_LIMIT = HEADER_ROW_1INDEXED; // labels live above the header row

export interface ParsedFile {
  fileName: string;
  billFromDate: Date | null;
  billToDate: Date | null;
  // invoice_no -> summed collected amount (only rows matching validStatuses)
  invoiceTotals: Map<string, number>;
}

function coerceNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // Excel serial date
    const parsed = XLSX.SSF?.parse_date_code?.(value);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Expecting DD/MM/YYYY per the sample (e.g. 01/01/2026)
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }
    const fallback = new Date(trimmed);
    if (!isNaN(fallback.getTime())) return fallback;
  }
  return null;
}

function findColumnIndex(headerRow: unknown[], columnName: string): number {
  return headerRow.findIndex(
    cell => typeof cell === "string" && cell.trim().toLowerCase() === columnName.toLowerCase()
  );
}

// Searches the metadata block (rows above the header row) for a cell whose
// text matches `labelText` (case-insensitive, ignoring trailing colon/
// whitespace), then returns the value in the cell immediately to its
// right on the same row.
function findLabeledValue(grid: unknown[][], labelText: string): unknown {
  const normalizedTarget = labelText.trim().toLowerCase().replace(/:$/, "");

  for (let r = 0; r < Math.min(grid.length, METADATA_SEARCH_ROW_LIMIT); r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell !== "string") continue;
      const normalizedCell = cell.trim().toLowerCase().replace(/:$/, "");
      if (normalizedCell === normalizedTarget) {
        return row[c + 1];
      }
    }
  }
  return undefined;
}

export function parseBrandFile(filePath: string, validStatuses: string[]): ParsedFile {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  let workbook: XLSX.WorkBook;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");

    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Node's fs.existsSync reports this path as missing: ${filePath}. ` +
        `This points to a filename mismatch (hidden Unicode characters, ` +
        `trailing space, or similar), not a permissions/sync issue.`
      );
    }

    // Read bytes via Node's fs directly and hand them to XLSX.read, rather
    // than XLSX.readFile (which does its own internal path-access check
    // that has been seen to fail on some OneDrive-synced Windows paths even
    // when Node's own fs has no trouble with the same path).
    const fileBuffer = fs.readFileSync(filePath);
    workbook = XLSX.read(fileBuffer, { cellDates: true, raw: false, type: "buffer" });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to open "${fileName}". This usually means the file is still ` +
      `"cloud-only" in OneDrive (not downloaded locally), or it's currently ` +
      `open in Excel. Right-click the file in File Explorer and choose ` +
      `"Always keep on this device", close it in Excel if open, then retry. ` +
      `Underlying error: ${reason}`
    );
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Full grid, including blank cells, so row/column indices line up with the
  // spec's absolute positions.
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const billFromDate = coerceDate(findLabeledValue(grid, "Bill From Date:"));
  const billToDate = coerceDate(findLabeledValue(grid, "Bill To Date:"));

  const headerRow = grid[HEADER_ROW_1INDEXED - 1] ?? [];

  const billNoIdx = findColumnIndex(headerRow, "Bill No");
  const collAmtIdx = findColumnIndex(headerRow, "Coll. Amt");
  const statusIdx = findColumnIndex(headerRow, "Status");

  if (billNoIdx === -1 || collAmtIdx === -1 || statusIdx === -1) {
    throw new Error(
      `${fileName}: could not locate required columns (Bill No / Coll. Amt / Status) ` +
      `in header row ${HEADER_ROW_1INDEXED}. Found headers: ${JSON.stringify(headerRow)}`
    );
  }

  const validStatusSet = new Set(validStatuses.map(s => s.trim().toUpperCase()));
  const invoiceTotals = new Map<string, number>();

  for (let i = DATA_START_ROW_1INDEXED - 1; i < grid.length; i++) {
    const row = grid[i];
    if (!row || row.length === 0) break;

    const srNo = row[0];
    const isBlankRow =
      (srNo === undefined || srNo === null || String(srNo).trim() === "") &&
      row.every(c => c === undefined || c === null || String(c).trim() === "");

    if (isBlankRow) break; // hit the trailing metadata/blank section

    const billNo = String(row[billNoIdx] ?? "").trim();
    const status = String(row[statusIdx] ?? "").trim().toUpperCase();

    if (!billNo) continue; // skip stray rows with no invoice number
    if (!validStatusSet.has(status)) continue;

    const amount = coerceNumber(row[collAmtIdx]);
    invoiceTotals.set(billNo, (invoiceTotals.get(billNo) ?? 0) + amount);
  }

  return { fileName, billFromDate, billToDate, invoiceTotals };
}

export interface ParsedFolder {
  billFromDate: Date | null; // min across all files
  billToDate: Date | null;   // max across all files
  invoiceTotals: Map<string, number>; // concatenated + summed across all files
  fileCount: number;
}

export function parseBrandFolder(filePaths: string[], validStatuses: string[]): ParsedFolder {
  const parsedFiles = filePaths.map(fp => parseBrandFile(fp, validStatuses));

  let billFromDate: Date | null = null;
  let billToDate: Date | null = null;
  const invoiceTotals = new Map<string, number>();

  for (const pf of parsedFiles) {
    if (pf.billFromDate && (!billFromDate || pf.billFromDate < billFromDate)) {
      billFromDate = pf.billFromDate;
    }
    if (pf.billToDate && (!billToDate || pf.billToDate > billToDate)) {
      billToDate = pf.billToDate;
    }
    for (const [invoiceNo, amount] of pf.invoiceTotals) {
      invoiceTotals.set(invoiceNo, (invoiceTotals.get(invoiceNo) ?? 0) + amount);
    }
  }

  return { billFromDate, billToDate, invoiceTotals, fileCount: parsedFiles.length };
}
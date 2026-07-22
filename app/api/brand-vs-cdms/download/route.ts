// FILE PATH: bank_cdms_dashboard/app/api/brand-vs-cdms/download/route.ts — REPLACE EXISTING
//
// Download is now instant: reads invoice rows stored in the cache file by the
// last "Run all FCs" call — no Athena queries, no xlsx parsing, no runFcReport.
// Supports both all-FCs (GET ?brand=X) and single-FC (GET ?brand=X&fc=Y).

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCachedBrandInvoices } from "@/lib/runCache";
import type { TaggedInvoiceRow } from "@/lib/reportBuilder";

function buildWorkbookBuffer(rows: TaggedInvoiceRow[], includeFcColumn: boolean): Uint8Array {
  const baseColumns = [
    "Invoice No",
    "CDMS Total",
    "Pending Cheque Clearance",
    "CDMS Adj. (Excl. Cheque Pending)",
    "Brand Collection",
    "Excess",
    "Short",
    "Net Difference",
  ];
  const columns = includeFcColumn ? ["FC Name", ...baseColumns] : baseColumns;

  const aoa: (string | number)[][] = [columns];

  for (const row of rows) {
    const excess = row.netDifference > 0 ? row.netDifference : 0;
    const short = row.netDifference < 0 ? Math.abs(row.netDifference) : 0;
    const base = [
      row.invoiceNo,
      row.cdmsTotalCollection ?? "",
      row.excludedCdmsAmount ?? "",
      row.cdmsAdjustedCollection ?? "",
      row.brandCollection ?? "",
      excess || "",
      short || "",
      row.netDifference,
    ];
    aoa.push(includeFcColumn ? [row.fcName, ...base] : base);
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Report");

  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out as unknown as Uint8Array;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brandFolder = searchParams.get("brand");
  const fcFolder = searchParams.get("fc"); // optional — omit for all FCs

  if (!brandFolder) {
    return NextResponse.json({ error: "Missing 'brand' query param" }, { status: 400 });
  }

  const allRows = getCachedBrandInvoices(brandFolder);

  if (!allRows) {
    return NextResponse.json(
      { error: `No cached run found for '${brandFolder}'. Please run "Run all FCs" first.` },
      { status: 404 }
    );
  }

  const rows = fcFolder ? allRows.filter(r => r.fcName === fcFolder) : allRows;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: fcFolder
          ? `No cached invoice rows for FC '${fcFolder}'. Run "Run all FCs" first.`
          : `No cached invoice rows found. Run "Run all FCs" first.`
      },
      { status: 404 }
    );
  }

  const includeFcColumn = !fcFolder;
  const buffer = buildWorkbookBuffer(rows, includeFcColumn);
  const filename = fcFolder
    ? `${brandFolder}_${fcFolder}_report.xlsx`
    : `${brandFolder}_all_fc_report.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
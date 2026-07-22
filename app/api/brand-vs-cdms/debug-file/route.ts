// FILE PATH: bank_cdms_dashboard/app/api/brand-vs-cdms/debug-file/route.ts — NEW FILE (TEMPORARY DIAGNOSTIC)

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  const ROOT = process.env.BRAND_CDMS_ROOT;
  if (!ROOT) {
    return NextResponse.json({ error: "BRAND_CDMS_ROOT not set" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand");
  const fc = searchParams.get("fc");
  const file = searchParams.get("file"); // exact filename, optional — defaults to first file found

  if (!brand || !fc) {
    return NextResponse.json({ error: "Provide ?brand=...&fc=..." }, { status: 400 });
  }

  const fcPath = path.join(ROOT, brand, fc);
  if (!fs.existsSync(fcPath)) {
    return NextResponse.json({ error: `Not found: ${fcPath}` }, { status: 404 });
  }

  const allFiles = fs
    .readdirSync(fcPath, { withFileTypes: true })
    .filter(e => e.isFile() && /\.(xlsx|xls|csv)$/i.test(e.name))
    .map(e => e.name);

  const targetFile = file ?? allFiles[0];
  if (!targetFile) {
    return NextResponse.json({ error: "No xlsx/csv files in this folder", allFiles }, { status: 404 });
  }

  const fullPath = path.join(fcPath, targetFile);

  try {
    const buf = fs.readFileSync(fullPath);
    const workbook = XLSX.read(buf, { cellDates: true, raw: false, type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    // Dump rows 1–16 (1-indexed) in full, every column, so we can see the
    // exact label/value layout around the Bill From/To Date cells and the
    // header row.
    const firstRows = grid.slice(0, 16).map((row, i) => ({
      excelRow: i + 1,
      cells: row.map((cell, j) => ({
        col: XLSX.utils.encode_col(j),
        value: cell,
      })),
    }));

    return NextResponse.json({
      allFilesInFolder: allFiles,
      fileInspected: targetFile,
      sheetName,
      totalRows: grid.length,
      firstRows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read file", file: targetFile },
      { status: 500 }
    );
  }
}
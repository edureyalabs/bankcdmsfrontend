// FILE PATH: bank_cdms_dashboard/app/api/brand-vs-cdms/run-all/route.ts — REPLACE EXISTING

import { NextResponse } from "next/server";
import { runFcReport } from "@/lib/fcReportService";
import { getFcsForBrand } from "@/lib/config";
import { getCachedBrandSummary, saveCachedBrandRun } from "@/lib/runCache";
import type { FcSummary, TaggedInvoiceRow } from "@/lib/reportBuilder";

interface FcRowResult {
  fcName: string;
  summary?: FcSummary;
  resolvedFromDate?: string;
  resolvedToDate?: string;
  fileCount?: number;
  error?: string;
}

// GET: return only the cached FC-level summaries (no invoice rows) — fast.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brandFolder = searchParams.get("brand");

  if (!brandFolder) {
    return NextResponse.json({ error: "Missing 'brand' query param" }, { status: 400 });
  }

  const cached = getCachedBrandSummary(brandFolder);
  return NextResponse.json({ brandFolder, cached });
}

export async function POST(req: Request) {
  const ROOT = process.env.BRAND_CDMS_ROOT;

  if (!ROOT) {
    return NextResponse.json(
      { error: "BRAND_CDMS_ROOT is not set in .env.local" },
      { status: 500 }
    );
  }

  let body: { brandFolder?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { brandFolder } = body;

  if (!brandFolder) {
    return NextResponse.json({ error: "brandFolder is required" }, { status: 400 });
  }

  const fcs = getFcsForBrand(brandFolder);

  if (fcs.length === 0) {
    return NextResponse.json(
      { error: `No configured FCs found for brand '${brandFolder}'` },
      { status: 404 }
    );
  }

  const results: FcRowResult[] = [];
  const allInvoiceRows: TaggedInvoiceRow[] = []; // accumulated for instant download

  // Sequential, not Promise.all — Athena queries are already polling loops;
  // running many concurrently against the same account risks throttling,
  // and sequential keeps error attribution per FC simple and predictable.
  for (const fc of fcs) {
    try {
      const result = await runFcReport({
        root: ROOT,
        brandFolder,
        fcFolder: fc.folderName,
      });

      results.push({
        fcName: fc.folderName,
        summary: result.fcReport.summary,
        resolvedFromDate: result.resolvedFromDate.toISOString(),
        resolvedToDate: result.resolvedToDate.toISOString(),
        fileCount: result.fileCount,
      });

      // Tag each invoice row with its FC name and accumulate for cache
      for (const row of result.fcReport.invoices) {
        allInvoiceRows.push({ ...row, fcName: fc.folderName });
      }
    } catch (err) {
      results.push({
        fcName: fc.folderName,
        error: err instanceof Error ? err.message : "Failed to run report",
      });
    }
  }

  // Grand total only sums FCs that succeeded — a failed FC contributes
  // nothing rather than silently zeroing out into the total.
  const succeeded = results.filter(r => r.summary);

  const grandTotal = succeeded.reduce(
    (acc, r) => {
      const s = r.summary!;
      acc.brandCollectionTotal += s.brandCollectionTotal;
      acc.cdmsTotalCollectionTotal += s.cdmsTotalCollectionTotal;
      acc.cdmsAdjustedCollectionTotal += s.cdmsAdjustedCollectionTotal;
      acc.pendingChequeValue += s.pendingChequeValue;
      acc.excessCollectionValue += s.excessCollectionValue;
      acc.shortCollectionValue += s.shortCollectionValue;
      acc.invoiceCount += s.invoiceCount;
      return acc;
    },
    {
      brandCollectionTotal: 0,
      cdmsTotalCollectionTotal: 0,
      cdmsAdjustedCollectionTotal: 0,
      pendingChequeValue: 0,
      excessCollectionValue: 0,
      shortCollectionValue: 0,
      invoiceCount: 0,
    }
  );

  const netDifference = grandTotal.excessCollectionValue - grandTotal.shortCollectionValue;
  const netDifferenceSign = (netDifference > 0 ? "+" : netDifference < 0 ? "-" : "0") as "+" | "-" | "0";

  const summaryBody = {
    brandFolder,
    fcCount: fcs.length,
    succeededCount: succeeded.length,
    failedCount: results.length - succeeded.length,
    results,
    grandTotal: { ...grandTotal, netDifference, netDifferenceSign },
  };

  // Save summaries and invoice rows into separate cache files so the
  // summary load on brand selection is instant (small file), while the
  // invoice rows are only read when building a download.
  saveCachedBrandRun(brandFolder, summaryBody, allInvoiceRows);

  return NextResponse.json(summaryBody);
}
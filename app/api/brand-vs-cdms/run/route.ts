// FILE PATH: bank_cdms_dashboard/app/api/brand-vs-cdms/run/route.ts — NEW FILE

import { NextResponse } from "next/server";
import { runFcReport } from "@/lib/fcReportService";

export async function POST(req: Request) {
  const ROOT = process.env.BRAND_CDMS_ROOT;

  if (!ROOT) {
    return NextResponse.json(
      { error: "BRAND_CDMS_ROOT is not set in .env.local" },
      { status: 500 }
    );
  }

  let body: {
    brandFolder?: string;
    fcFolder?: string;
    fromDate?: string; // ISO date string, optional override
    toDate?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { brandFolder, fcFolder, fromDate, toDate } = body;

  if (!brandFolder || !fcFolder) {
    return NextResponse.json(
      { error: "brandFolder and fcFolder are required" },
      { status: 400 }
    );
  }

  try {
    const result = await runFcReport({
      root: ROOT,
      brandFolder,
      fcFolder,
      overrideFromDate: fromDate ? new Date(fromDate) : undefined,
      overrideToDate: toDate ? new Date(toDate) : undefined,
    });

    return NextResponse.json({
      fcFolder,
      brandFolder,
      fileCount: result.fileCount,
      resolvedFromDate: result.resolvedFromDate.toISOString(),
      resolvedToDate: result.resolvedToDate.toISOString(),
      summary: result.fcReport.summary,
      invoices: result.fcReport.invoices,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run report" },
      { status: 500 }
    );
  }
}
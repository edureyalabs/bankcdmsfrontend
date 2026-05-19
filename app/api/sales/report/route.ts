// FILE PATH: app/api/sales/report/route.ts

import { NextResponse } from "next/server";
import { dbQuery }      from "@/lib/db";

export const dynamic = "force-dynamic";

export interface ReportRow {
  location:    string;
  fc:          string;
  asm:         string;
  brand:       string;
  salesTarget: number;
  mtdTarget:   number;
  mtdAchieved: number;
  difference:  number;
  diffPct:     number | null;
  lakeFcCode:  string;
  lakeBrdCode: string;
}

export interface BrandSummaryRow {
  brand:          string;
  lakeBrdCode:    string;
  salesTarget:    number;
  mtdTarget:      number;
  mtdAchieved:    number;
  achievementPct: number | null;
  difference:     number;
  diffPct:        number | null;
  status:         "On track" | "At risk" | "Critical" | "No target";
  fcCount:        number;
}

export interface ReportResponse {
  rows:               ReportRow[];
  brandSummary:       BrandSummaryRow[];
  fromDate:           string;
  toDate:             string;
  workingDaysElapsed: number;
  workingDaysInMonth: number;
  configMonth:        string;
  syncedAt:           string;
  error?:             string;
}

function achievementStatus(pct: number | null): BrandSummaryRow["status"] {
  if (pct === null) return "No target";
  if (pct >= 90)   return "On track";
  if (pct >= 70)   return "At risk";
  return "Critical";
}

export async function GET() {
  try {
    const configRows = await dbQuery(
      `SELECT config_type, config_json FROM sales_config ORDER BY id ASC`
    );
    if (!configRows.length) {
      return NextResponse.json(
        { error: "No sales config found. Run sales_sync.py then sync_to_turso.py." },
        { status: 404 }
      );
    }

    let targets: Record<string, unknown>[]   = [];
    let monthConfig: Record<string, unknown> = {};
    for (const row of configRows) {
      try {
        const parsed = JSON.parse(row.config_json as string);
        if (row.config_type === "targets")      targets     = parsed;
        if (row.config_type === "month_config") monthConfig = parsed;
      } catch { /* skip */ }
    }

    const fromDate    = (monthConfig.from_date as string) ?? "";
    const toDate      = (monthConfig.to_date   as string) ?? "";
    const configMonth = (monthConfig.month      as string) ?? "";

    let actualsRows: Record<string, unknown>[] = [];
    if (fromDate && toDate) {
      // Select fc + brand (human names) — these are now the unique key
      actualsRows = await dbQuery(
        `SELECT fc, brand, total_sum, synced_at
         FROM sales_actuals WHERE from_date = ? AND to_date = ?`,
        [fromDate, toDate]
      );
    }

    // Key: "fc::brand" — guaranteed unique, matches exactly one target row
    const actualsMap = new Map<string, number>();
    let latestSync   = "";
    for (const row of actualsRows) {
      actualsMap.set(`${row.fc}::${row.brand}`, Number(row.total_sum ?? 0));
      if (!latestSync) latestSync = (row.synced_at as string) ?? "";
    }

    // Detail rows — each target row gets its own unique actuals value
    const rows: ReportRow[] = targets.map(t => {
      const key         = `${t.fc}::${t.brand}`;
      const mtdAchieved = Math.round(actualsMap.get(key) ?? 0);
      const mtdTarget   = Math.round((t.mtd_target as number) ?? 0);
      const salesTarget = (t.sales_target as number) ?? 0;
      const difference  = mtdAchieved - mtdTarget;
      const diffPct     = mtdTarget !== 0
        ? parseFloat(((difference / mtdTarget) * 100).toFixed(2)) : null;
      return {
        location: (t.location as string) ?? "", fc: (t.fc as string) ?? "",
        asm: (t.asm as string) ?? "", brand: (t.brand as string) ?? "",
        salesTarget, mtdTarget, mtdAchieved, difference, diffPct,
        lakeFcCode:  (t.lake_fc_code  as string) ?? "",
        lakeBrdCode: (t.lake_brd_code as string) ?? "",
      };
    });

    // Brand summary — aggregate across all FCs
    // Key by lowercased brand name to merge case variants (e.g. "NESTLE" + "Nestle")
    const brandMap = new Map<string, {
      displayName: string;
      lakeBrdCode: string;
      salesTarget: number; mtdTarget: number; mtdAchieved: number;
      fcs: Set<string>;
    }>();
    for (const r of rows) {
      const normKey = r.brand.trim().toLowerCase();
      if (!brandMap.has(normKey)) {
        brandMap.set(normKey, {
          displayName: r.brand,
          lakeBrdCode: r.lakeBrdCode,
          salesTarget: 0, mtdTarget: 0, mtdAchieved: 0, fcs: new Set(),
        });
      }
      const b = brandMap.get(normKey)!;
      b.salesTarget += r.salesTarget;
      b.mtdTarget   += r.mtdTarget;
      b.mtdAchieved += r.mtdAchieved;
      b.fcs.add(r.fc);
    }

    const brandSummary: BrandSummaryRow[] = Array.from(brandMap.entries())
      .map(([, b]) => {
        const achievementPct = b.mtdTarget > 0
          ? parseFloat(((b.mtdAchieved / b.mtdTarget) * 100).toFixed(1)) : null;
        const difference = b.mtdAchieved - b.mtdTarget;
        const diffPct    = b.mtdTarget > 0
          ? parseFloat(((difference / b.mtdTarget) * 100).toFixed(2)) : null;
        return {
          brand: b.displayName, lakeBrdCode: b.lakeBrdCode,
          salesTarget: b.salesTarget, mtdTarget: b.mtdTarget,
          mtdAchieved: b.mtdAchieved, achievementPct, difference, diffPct,
          status: achievementStatus(achievementPct), fcCount: b.fcs.size,
        };
      })
      .sort((a, b) => b.mtdAchieved - a.mtdAchieved);

    return NextResponse.json({
      rows, brandSummary, fromDate, toDate,
      workingDaysElapsed: (monthConfig.working_days_elapsed as number) ?? 0,
      workingDaysInMonth: (monthConfig.working_days         as number) ?? 0,
      configMonth, syncedAt: latestSync,
    } as ReportResponse);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
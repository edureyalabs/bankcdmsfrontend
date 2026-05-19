// FILE PATH: app/api/sales/command/route.ts

import { NextRequest, NextResponse } from "next/server";
import { dbQuery }                   from "@/lib/db";

export const dynamic = "force-dynamic";

export type Health = "Healthy" | "Watch" | "Critical" | "No Target";

export interface BrandRow {
  brand:           string;
  lake_brd_code:   string;
  sales_target:    number;
  mtd_target:      number;
  mtd_achieved:    number;
  achievement_pct: number | null;
  difference:      number;
  health:          Health;
}

export interface FcCard {
  // fc is the display name from sales_config — guaranteed unique as a business entity
  fc:               string;
  // A single FC display name may map to multiple lake_fc_codes (e.g. Begur Road → BGRD + BTM)
  lake_fc_codes:    string[];
  location:         string;
  total_target:     number;
  total_mtd_target: number;
  total_achieved:   number;
  achievement_pct:  number | null;
  health:           Health;
  brands:           BrandRow[];
  // from salesman_actuals
  salesman_count:   number;
  bills:            number;
  lines:            number;
  outlets:          number;
  sku_count:        number;
}

export interface BrandSummaryRow {
  brand:           string;
  lake_brd_code:   string;
  sales_target:    number;
  mtd_target:      number;
  mtd_achieved:    number;
  achievement_pct: number | null;
  difference:      number;
  diff_pct:        number | null;
  status:          string;
  fc_count:        number;
}

export interface KpiStrip {
  total_net:        number;
  total_target:     number;
  total_mtd_target: number;
  achievement_pct:  number | null;
  total_bills:      number;
  total_lines:      number;
  total_outlets:    number;
  total_sku_count:  number;
  salesman_count:   number;
  fc_count:         number;
  healthy:          number;
  watch:            number;
  critical:         number;
  lines_per_bill:   number | null;
}

export interface CommandResponse {
  fc_cards:             FcCard[];
  brand_summary:        BrandSummaryRow[];
  kpi:                  KpiStrip;
  from_date:            string;
  to_date:              string;
  current_month:        string;
  working_days_elapsed: number;
  working_days:         number;
  config_month:         string;
  synced_at:            string;
  filter_opts: {
    locations: string[];
    brands:    string[];
    fcs:       string[];
  };
  error?: string;
}

function toHealth(pct: number | null): Health {
  if (pct === null) return "No Target";
  if (pct >= 90)   return "Healthy";
  if (pct >= 60)   return "Watch";
  return "Critical";
}

function toStatus(pct: number | null): string {
  if (pct === null) return "No target";
  if (pct >= 90)   return "On track";
  if (pct >= 70)   return "At risk";
  return "Critical";
}

export async function GET(req: NextRequest) {
  try {
    const params    = new URL(req.url).searchParams;
    const locations = params.getAll("location");
    const brands    = params.getAll("brand");
    const fcs       = params.getAll("fc");

    // ── 1. Sales config ──────────────────────────────────────────────────────
    const configRows = await dbQuery(
      `SELECT config_type, config_json FROM sales_config ORDER BY id ASC`
    );
    if (!configRows.length) {
      return NextResponse.json(
        { error: "No sales config. Run sales_sync.py then sync_to_turso.py." },
        { status: 404 }
      );
    }

    let targets: Record<string, unknown>[]   = [];
    let monthConfig: Record<string, unknown> = {};
    for (const row of configRows) {
      try {
        const p = JSON.parse(row.config_json as string);
        if (row.config_type === "targets")      targets     = p;
        if (row.config_type === "month_config") monthConfig = p;
      } catch { /* skip */ }
    }

    const fromDate    = (monthConfig.from_date as string) ?? "";
    const toDate      = (monthConfig.to_date   as string) ?? "";
    const configMonth = (monthConfig.month      as string) ?? "";
    const wdElapsed   = Number(monthConfig.working_days_elapsed ?? 0);
    const wdTotal     = Number(monthConfig.working_days         ?? 0);

    // ── 2. sales_actuals keyed by "fc::brand" (display names) ───────────────
    let actualsRows: Record<string, unknown>[] = [];
    if (fromDate && toDate) {
      actualsRows = await dbQuery(
        `SELECT fc, brand, total_sum, synced_at
         FROM sales_actuals WHERE from_date = ? AND to_date = ?`,
        [fromDate, toDate]
      );
    }
    const actualsMap = new Map<string, number>();
    let latestSync   = "";
    for (const row of actualsRows) {
      actualsMap.set(`${row.fc}::${row.brand}`, Number(row.total_sum ?? 0));
      if (!latestSync) latestSync = String(row.synced_at ?? "");
    }

    // ── 3. salesman_actuals for current month, aggregated by lake_fc_code ────
    const smRows = configMonth ? await dbQuery(
      `SELECT fc_code, salesman_code, bills, lines, outlets, sku_count
       FROM salesman_actuals WHERE month = ?`,
      [configMonth]
    ) : [];

    interface SmAgg { bills: number; lines: number; outlets: number; sku: number; sm: Set<string>; }
    const smByFcCode = new Map<string, SmAgg>();
    for (const r of smRows) {
      const fc = String(r.fc_code ?? "");
      if (!smByFcCode.has(fc))
        smByFcCode.set(fc, { bills: 0, lines: 0, outlets: 0, sku: 0, sm: new Set() });
      const a = smByFcCode.get(fc)!;
      a.bills += Number(r.bills     ?? 0);
      a.lines += Number(r.lines     ?? 0);
      a.outlets+= Number(r.outlets  ?? 0);
      a.sku   += Number(r.sku_count ?? 0);
      const sc = String(r.salesman_code ?? "");
      if (sc && sc !== "__UNKNOWN__") a.sm.add(sc);
    }

    // ── 4. Build FC cards — group by fc DISPLAY NAME ─────────────────────────
    // This is the same grouping key used by sales_actuals, so numbers reconcile.
    interface FcEntry {
      fc:            string;
      lake_fc_codes: Set<string>;
      location:      string;
      brands:        Map<string, { brand: string; lbrd: string; st: number; mt: number }>;
    }
    const fcMap = new Map<string, FcEntry>();

    for (const t of targets) {
      const fcName   = String(t.fc          ?? "");
      const brand    = String(t.brand       ?? "");
      const lfc      = String(t.lake_fc_code ?? "");
      const lbrd     = String(t.lake_brd_code ?? "");
      const location = String(t.location    ?? "");
      const st       = Number(t.sales_target ?? 0);
      const mt       = Number(t.mtd_target   ?? 0);

      // Apply filters
      if (locations.length && !locations.includes(location)) continue;
      if (brands.length    && !brands.includes(brand))       continue;
      if (fcs.length       && !fcs.includes(fcName))         continue;

      if (!fcMap.has(fcName)) {
        fcMap.set(fcName, {
          fc: fcName, lake_fc_codes: new Set([lfc]),
          location, brands: new Map(),
        });
      }
      const entry = fcMap.get(fcName)!;
      entry.lake_fc_codes.add(lfc);

      // Brands keyed by display name — sum targets if same brand appears twice
      if (!entry.brands.has(brand)) {
        entry.brands.set(brand, { brand, lbrd, st: 0, mt: 0 });
      }
      const b = entry.brands.get(brand)!;
      b.st += st;
      b.mt += mt;
    }

    // ── 5. Resolve SM agg for an FC entry (may span multiple lake_fc_codes) ──
    function smForFc(entry: FcEntry): SmAgg {
      const merged: SmAgg = { bills: 0, lines: 0, outlets: 0, sku: 0, sm: new Set() };
      for (const lfc of entry.lake_fc_codes) {
        const a = smByFcCode.get(lfc);
        if (!a) continue;
        merged.bills   += a.bills;
        merged.lines   += a.lines;
        merged.outlets += a.outlets;
        merged.sku     += a.sku;
        a.sm.forEach(s => merged.sm.add(s));
      }
      return merged;
    }

    // ── 6. Build FcCard objects ───────────────────────────────────────────────
    const fcCards: FcCard[] = [];

    for (const [, entry] of fcMap) {
      const sm = smForFc(entry);

      let fcTotalSt  = 0;
      let fcTotalMt  = 0;
      let fcAchieved = 0;

      const brandRows: BrandRow[] = [];
      for (const [, b] of entry.brands) {
        const achieved = Math.round(actualsMap.get(`${entry.fc}::${b.brand}`) ?? 0);
        const achPct   = b.mt > 0
          ? parseFloat(((achieved / b.mt) * 100).toFixed(1))
          : null;
        brandRows.push({
          brand:           b.brand,
          lake_brd_code:   b.lbrd,
          sales_target:    b.st,
          mtd_target:      Math.round(b.mt),
          mtd_achieved:    achieved,
          achievement_pct: achPct,
          difference:      achieved - Math.round(b.mt),
          health:          toHealth(achPct),
        });
        fcTotalSt  += b.st;
        fcTotalMt  += b.mt;
        fcAchieved += achieved;
      }

      brandRows.sort((a, b) => b.mtd_achieved - a.mtd_achieved);

      const fcAchPct = fcTotalMt > 0
        ? parseFloat(((fcAchieved / fcTotalMt) * 100).toFixed(1))
        : null;

      fcCards.push({
        fc:               entry.fc,
        lake_fc_codes:    [...entry.lake_fc_codes],
        location:         entry.location,
        total_target:     fcTotalSt,
        total_mtd_target: Math.round(fcTotalMt),
        total_achieved:   fcAchieved,
        achievement_pct:  fcAchPct,
        health:           toHealth(fcAchPct),
        brands:           brandRows,
        salesman_count:   sm.sm.size,
        bills:            sm.bills,
        lines:            sm.lines,
        outlets:          sm.outlets,
        sku_count:        sm.sku,
      });
    }

    // Sort: Healthy → Watch → Critical → No Target, then achieved desc within group
    const hOrder: Record<Health, number> = { Healthy: 0, Watch: 1, Critical: 2, "No Target": 3 };
    fcCards.sort((a, b) => {
      const hd = hOrder[a.health] - hOrder[b.health];
      return hd !== 0 ? hd : b.total_achieved - a.total_achieved;
    });

    // ── 7. Brand summary — aggregate across all visible FCs ──────────────────
    const brandMap = new Map<string, {
      brand: string; lbrd: string; st: number; mt: number; achieved: number; fcs: Set<string>;
    }>();

    for (const fc of fcCards) {
      for (const b of fc.brands) {
        const norm = b.brand.trim().toLowerCase();
        if (!brandMap.has(norm)) {
          brandMap.set(norm, { brand: b.brand, lbrd: b.lake_brd_code, st: 0, mt: 0, achieved: 0, fcs: new Set() });
        }
        const bm = brandMap.get(norm)!;
        bm.st      += b.sales_target;
        bm.mt      += b.mtd_target;
        bm.achieved+= b.mtd_achieved;
        bm.fcs.add(fc.fc);
      }
    }

    const brandSummary: BrandSummaryRow[] = [...brandMap.values()]
      .map(b => {
        const achPct  = b.mt > 0 ? parseFloat(((b.achieved / b.mt) * 100).toFixed(1)) : null;
        const diff    = b.achieved - b.mt;
        const diffPct = b.mt > 0 ? parseFloat(((diff / b.mt) * 100).toFixed(2)) : null;
        return {
          brand:           b.brand,
          lake_brd_code:   b.lbrd,
          sales_target:    b.st,
          mtd_target:      Math.round(b.mt),
          mtd_achieved:    b.achieved,
          achievement_pct: achPct,
          difference:      Math.round(diff),
          diff_pct:        diffPct,
          status:          toStatus(achPct),
          fc_count:        b.fcs.size,
        };
      })
      .sort((a, b) => b.mtd_achieved - a.mtd_achieved);

    // ── 8. KPI strip ──────────────────────────────────────────────────────────
    const totalBills  = fcCards.reduce((s, f) => s + f.bills,          0);
    const totalLines  = fcCards.reduce((s, f) => s + f.lines,          0);
    const totalNet    = fcCards.reduce((s, f) => s + f.total_achieved,  0);
    const totalMtdTgt = fcCards.reduce((s, f) => s + f.total_mtd_target,0);

    const kpi: KpiStrip = {
      total_net:        totalNet,
      total_target:     fcCards.reduce((s, f) => s + f.total_target,     0),
      total_mtd_target: totalMtdTgt,
      achievement_pct:  totalMtdTgt > 0
        ? parseFloat(((totalNet / totalMtdTgt) * 100).toFixed(1)) : null,
      total_bills:      totalBills,
      total_lines:      totalLines,
      total_outlets:    fcCards.reduce((s, f) => s + f.outlets,    0),
      total_sku_count:  fcCards.reduce((s, f) => s + f.sku_count,  0),
      salesman_count:   fcCards.reduce((s, f) => s + f.salesman_count, 0),
      fc_count:         fcCards.length,
      healthy:          fcCards.filter(f => f.health === "Healthy").length,
      watch:            fcCards.filter(f => f.health === "Watch").length,
      critical:         fcCards.filter(f => f.health === "Critical").length,
      lines_per_bill:   totalBills > 0
        ? parseFloat((totalLines / totalBills).toFixed(1)) : null,
    };

    // ── 9. Filter options (always from full unfiltered targets) ───────────────
    const [allLoc, allBrands, allFcs] = [
      [...new Set(targets.map(t => String(t.location ?? "")).filter(Boolean))].sort(),
      [...new Set(targets.map(t => String(t.brand    ?? "")).filter(Boolean))].sort(),
      [...new Set(targets.map(t => String(t.fc       ?? "")).filter(Boolean))].sort(),
    ];

    return NextResponse.json({
      fc_cards:             fcCards,
      brand_summary:        brandSummary,
      kpi,
      from_date:            fromDate,
      to_date:              toDate,
      current_month:        configMonth,
      working_days_elapsed: wdElapsed,
      working_days:         wdTotal,
      config_month:         configMonth,
      synced_at:            latestSync,
      filter_opts: { locations: allLoc, brands: allBrands, fcs: allFcs },
    } as CommandResponse);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
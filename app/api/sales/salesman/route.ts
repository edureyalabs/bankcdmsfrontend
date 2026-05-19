// FILE PATH: app/api/sales/salesman/route.ts  — REPLACE EXISTING

import { NextRequest, NextResponse } from "next/server";
import { dbQuery }                   from "@/lib/db";

export const dynamic = "force-dynamic";

// ── helpers ───────────────────────────────────────────────────────────────────

function monthsBetween(from: string, to: string): string[] {
  // Returns ["2026-01","2026-02",…] inclusive, sorted asc
  const result: string[] = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

type Trend = "green" | "yellow" | "red" | "none";

function dotColor(value: number, avgMonthly: number): Trend {
  if (avgMonthly === 0) return "none";
  const pct = value / avgMonthly;
  if (pct >= 0.90) return "green";
  if (pct >= 0.60) return "yellow";
  return "red";
}

// ── types ─────────────────────────────────────────────────────────────────────

interface DbRow {
  month:          string;
  days_covered:   number;
  total_days:     number;
  salesman_code:  string;
  salesman_name:  string;
  fc_code:        string;
  brand_code:     string;
  fc_name:        string;
  brand_name:     string;
  city:           string;
  bills:          number;
  lines:          number;
  outlets:        number;
  sku_count:      number;
  net_amount:     number;
}

export interface SalesmanReportRow {
  salesman_code:  string;
  salesman_name:  string;
  fc_code:        string;
  brand_code:     string;
  fc_name:        string;
  brand_name:     string;
  city:           string;
  // MTD (current partial month)
  mtd_achieved:   number;
  mtd_target:     number;       // prorated from avg
  mtd_vs_target:  number | null; // pct
  // History
  avg_monthly:    number;       // mean of full past months
  monthly_values: Record<string, number>; // month → net_amount
  monthly_bills:  Record<string, number>;
  monthly_outlets:Record<string, number>;
  // Sparkline colours per month dot
  dot_colors:     Record<string, Trend>;
  // Overall trend = colour of current month dot
  trend:          Trend;
  // Current month metrics (bills, outlets, skus)
  cur_bills:      number;
  cur_outlets:    number;
  cur_sku_count:  number;
}

export interface SalesmanReportResponse {
  rows:           SalesmanReportRow[];
  all_months:     string[];         // all months in range, asc
  past_months:    string[];         // all months except current
  current_month:  string;
  filter_opts: {
    brands:       string[];
    fcs:          string[];
    salesmen:     string[];
  };
  from_date:      string;
  to_date:        string;
  error?:         string;
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const params   = new URL(req.url).searchParams;
    const fromDate = params.get("from") || "";
    const toDate   = params.get("to")   || "";
    const brands   = params.getAll("brand");
    const fcs      = params.getAll("fc");
    const salesmen = params.getAll("salesman");

    // ── 1. Resolve date range & months ──────────────────────────────────────
    let effectiveFrom = fromDate;
    let effectiveTo   = toDate;

    if (!effectiveFrom || !effectiveTo) {
      // Default: all available months in DB
      const bounds = await dbQuery(
        `SELECT MIN(month) AS mn, MAX(month) AS mx FROM salesman_actuals`
      );
      if (!bounds.length || !bounds[0].mn) {
        return NextResponse.json(
          { error: "No salesman data found. Run salesman_sync.py first." },
          { status: 404 }
        );
      }
      const minMonth = bounds[0].mn as string;
      const maxMonth = bounds[0].mx as string;
      effectiveFrom  = `${minMonth}-01`;
      // For the max month use its days_covered end date
      const maxRow = await dbQuery(
        `SELECT days_covered, total_days FROM salesman_actuals WHERE month = ? LIMIT 1`,
        [maxMonth]
      );
      const dc = maxRow[0]?.days_covered as number ?? daysInMonth(maxMonth);
      effectiveTo = `${maxMonth}-${String(dc).padStart(2, "0")}`;
    }

    // Parse months from the date range
    const fromMonth   = effectiveFrom.slice(0, 7);  // "2026-01"
    const toMonth     = effectiveTo.slice(0, 7);    // "2026-05"
    const allMonths   = monthsBetween(fromMonth, toMonth);
    const currentMonth = allMonths[allMonths.length - 1];
    const pastMonths  = allMonths.slice(0, -1);

    if (allMonths.length === 0) {
      return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
    }

    // ── 2. Fetch raw rows for all months ────────────────────────────────────
    const monthPlaceholders = allMonths.map(() => "?").join(",");
    const binds: unknown[]  = [...allMonths];

    const extraWhere: string[] = [];
    if (brands.length) {
      extraWhere.push(`brand_name IN (${brands.map(() => "?").join(",")})`);
      binds.push(...brands);
    }
    if (fcs.length) {
      extraWhere.push(`fc_name IN (${fcs.map(() => "?").join(",")})`);
      binds.push(...fcs);
    }
    if (salesmen.length) {
      extraWhere.push(`salesman_name IN (${salesmen.map(() => "?").join(",")})`);
      binds.push(...salesmen);
    }

    const extraClause = extraWhere.length ? " AND " + extraWhere.join(" AND ") : "";

    const rawRows = await dbQuery(
      `SELECT month, days_covered, total_days,
              salesman_code, salesman_name,
              fc_code, brand_code, fc_name, brand_name, city,
              bills, outlets, sku_count, net_amount
       FROM salesman_actuals
       WHERE month IN (${monthPlaceholders})${extraClause}
       ORDER BY month ASC`,
      binds
    ) as unknown as DbRow[];

    // ── 3. Group into (salesman_code, fc_code, brand_code) map ──────────────
    type Key = string; // "salesman_code::fc_code::brand_code"
    interface Agg {
      salesman_code:  string;
      salesman_name:  string;
      fc_code:        string;
      brand_code:     string;
      fc_name:        string;
      brand_name:     string;
      city:           string;
      monthly:        Record<string, { net: number; bills: number; outlets: number; sku: number }>;
      days_covered:   Record<string, number>;  // month → days_covered
      total_days:     Record<string, number>;  // month → total_days
    }

    const map = new Map<Key, Agg>();

    for (const r of rawRows) {
      const key: Key = `${r.salesman_code}::${r.fc_code}::${r.brand_code}`;
      if (!map.has(key)) {
        map.set(key, {
          salesman_code: r.salesman_code,
          salesman_name: r.salesman_name,
          fc_code:       r.fc_code,
          brand_code:    r.brand_code,
          fc_name:       r.fc_name,
          brand_name:    r.brand_name,
          city:          r.city,
          monthly:       {},
          days_covered:  {},
          total_days:    {},
        });
      }
      const agg = map.get(key)!;
      agg.monthly[r.month] = {
        net:     Number(r.net_amount),
        bills:   Number(r.bills),
        outlets: Number(r.outlets),
        sku:     Number(r.sku_count),
      };
      agg.days_covered[r.month] = Number(r.days_covered);
      agg.total_days[r.month]   = Number(r.total_days);
    }

    // ── 4. Compute report rows ───────────────────────────────────────────────
    const rows: SalesmanReportRow[] = [];

    for (const agg of map.values()) {
      // Past months with actual data
      const pastWithData = pastMonths.filter(m => agg.monthly[m] !== undefined);
      const avgMonthly   = pastWithData.length > 0
        ? pastWithData.reduce((s, m) => s + agg.monthly[m].net, 0) / pastWithData.length
        : 0;

      // MTD target: avg / total_days_in_current_month * days_covered_current
      const curDaysCovered = agg.days_covered[currentMonth] ?? 0;
      const curTotalDays   = agg.total_days[currentMonth]   ?? daysInMonth(currentMonth);
      const mtdTarget      = curTotalDays > 0
        ? Math.round((avgMonthly / curTotalDays) * curDaysCovered)
        : 0;

      const curData      = agg.monthly[currentMonth];
      const mtdAchieved  = curData ? Math.round(curData.net) : 0;
      const mtdVsTarget  = mtdTarget > 0
        ? parseFloat(((mtdAchieved / mtdTarget) * 100).toFixed(1))
        : null;

      // Monthly values for table columns
      const monthly_values:  Record<string, number> = {};
      const monthly_bills:   Record<string, number> = {};
      const monthly_outlets: Record<string, number> = {};

      for (const m of allMonths) {
        const d = agg.monthly[m];
        monthly_values[m]  = d ? Math.round(d.net)     : 0;
        monthly_bills[m]   = d ? d.bills   : 0;
        monthly_outlets[m] = d ? d.outlets : 0;
      }

      // Dot colours: past months vs avgMonthly; current month vs MTD target
      const dot_colors: Record<string, Trend> = {};
      for (const m of pastMonths) {
        dot_colors[m] = dotColor(monthly_values[m], avgMonthly);
      }
      // Current month dot vs MTD target
      if (mtdTarget > 0) {
        const pct = mtdAchieved / mtdTarget;
        dot_colors[currentMonth] = pct >= 0.90 ? "green" : pct >= 0.60 ? "yellow" : "red";
      } else {
        dot_colors[currentMonth] = "none";
      }

      const trend: Trend = dot_colors[currentMonth] ?? "none";

      rows.push({
        salesman_code:  agg.salesman_code,
        salesman_name:  agg.salesman_name,
        fc_code:        agg.fc_code,
        brand_code:     agg.brand_code,
        fc_name:        agg.fc_name,
        brand_name:     agg.brand_name,
        city:           agg.city,
        mtd_achieved:   mtdAchieved,
        mtd_target:     mtdTarget,
        mtd_vs_target:  mtdVsTarget,
        avg_monthly:    Math.round(avgMonthly),
        monthly_values,
        monthly_bills,
        monthly_outlets,
        dot_colors,
        trend,
        cur_bills:      curData?.bills   ?? 0,
        cur_outlets:    curData?.outlets ?? 0,
        cur_sku_count:  curData?.sku     ?? 0,
      });
    }

    // Sort: green first, then yellow, then red, then none; within each by mtd_achieved desc
    const trendOrder: Record<Trend, number> = { green: 0, yellow: 1, red: 2, none: 3 };
    rows.sort((a, b) => {
      const td = trendOrder[a.trend] - trendOrder[b.trend];
      return td !== 0 ? td : b.mtd_achieved - a.mtd_achieved;
    });

    // ── 5. Filter options (unfiltered, for the full range) ──────────────────
    const [optBrands, optFcs, optSalesmen] = await Promise.all([
      dbQuery(
        `SELECT DISTINCT brand_name FROM salesman_actuals
         WHERE month IN (${allMonths.map(() => "?").join(",")})
           AND brand_name != '__UNKNOWN__' ORDER BY brand_name`,
        allMonths
      ),
      dbQuery(
        `SELECT DISTINCT fc_name FROM salesman_actuals
         WHERE month IN (${allMonths.map(() => "?").join(",")})
           AND fc_name != '__UNKNOWN__' ORDER BY fc_name`,
        allMonths
      ),
      dbQuery(
        `SELECT DISTINCT salesman_name FROM salesman_actuals
         WHERE month IN (${allMonths.map(() => "?").join(",")})
           AND salesman_name != 'Unassigned' ORDER BY salesman_name`,
        allMonths
      ),
    ]);

    return NextResponse.json({
      rows,
      all_months:    allMonths,
      past_months:   pastMonths,
      current_month: currentMonth,
      filter_opts: {
        brands:   optBrands.map(r => r.brand_name as string),
        fcs:      optFcs.map(r => r.fc_name as string),
        salesmen: optSalesmen.map(r => r.salesman_name as string),
      },
      from_date: effectiveFrom,
      to_date:   effectiveTo,
    } as SalesmanReportResponse);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
// FILE PATH: bank_cdms_dashboard/app/api/summary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildWhere(params: URLSearchParams) {
  const where: string[] = [];
  const binds: string[] = [];

  const addIn = (col: string, vals: string[]) => {
    if (!vals.length) return;
    where.push(`"${col}" IN (${vals.map(() => "?").join(", ")})`);
    binds.push(...vals);
  };

  addIn("FC",             params.getAll("fc"));
  addIn("Brand",          params.getAll("brand"));
  addIn("Match_Status",   params.getAll("status"));
  addIn("Collected_Mode", params.getAll("mode"));

  const ref      = params.get("ref")      || "";
  const invoice  = params.get("invoice")  || "";
  const dateFrom = params.get("dateFrom") || "";
  const dateTo   = params.get("dateTo")   || "";

  if (ref)      { where.push('Reference_no LIKE ?');              binds.push(`%${ref}%`); }
  if (invoice)  { where.push('Invoice_Number LIKE ?');            binds.push(`%${invoice}%`); }
  if (dateFrom) { where.push('SUBSTR(collected_date,1,10) >= ?'); binds.push(dateFrom); }
  if (dateTo)   { where.push('SUBSTR(collected_date,1,10) <= ?'); binds.push(dateTo); }

  return {
    W:      where.length ? "WHERE " + where.join(" AND ") : "",
    binds,
  };
}

export async function GET(req: NextRequest) {
  try {
    const db     = getDb();
    const params = new URL(req.url).searchParams;
    const { W, binds } = buildWhere(params);

    const run = <T>(sql: string): T =>
      binds.length
        ? (db.prepare(sql).all(...binds) as T)
        : (db.prepare(sql).all()        as T);

    const runGet = <T>(sql: string): T =>
      binds.length
        ? (db.prepare(sql).get(...binds) as T)
        : (db.prepare(sql).get()        as T);

    const pivotSql = (groupExpr: string, orderExpr: string) => `
      SELECT
        (${groupExpr}) AS grp_key,
        COALESCE(SUM(Collected_Amount), 0)                                                        AS total,
        COALESCE(SUM(CASE WHEN Match_Status='Full Match'    THEN Collected_Amount ELSE 0 END), 0) AS full_match,
        COALESCE(SUM(CASE WHEN Match_Status='Partial Match' THEN Collected_Amount ELSE 0 END), 0) AS partial,
        COALESCE(SUM(CASE WHEN Match_Status='Unmatched'     THEN Collected_Amount ELSE 0 END), 0) AS unmatched,
        COUNT(*)                                                                                   AS total_count,
        COUNT(CASE WHEN Match_Status='Full Match'    THEN 1 END)                                  AS full_count,
        COUNT(CASE WHEN Match_Status='Partial Match' THEN 1 END)                                  AS partial_count,
        COUNT(CASE WHEN Match_Status='Unmatched'     THEN 1 END)                                  AS unmatched_count
      FROM cdms_data ${W}
      GROUP BY (${groupExpr})
      ORDER BY ${orderExpr}
    `;

    const totalsSql = `
      SELECT
        COALESCE(SUM(Collected_Amount), 0)                                                        AS total,
        COALESCE(SUM(CASE WHEN Match_Status='Full Match'    THEN Collected_Amount ELSE 0 END), 0) AS full_match,
        COALESCE(SUM(CASE WHEN Match_Status='Partial Match' THEN Collected_Amount ELSE 0 END), 0) AS partial,
        COALESCE(SUM(CASE WHEN Match_Status='Unmatched'     THEN Collected_Amount ELSE 0 END), 0) AS unmatched,
        COUNT(*)                                                                                   AS total_count,
        COUNT(CASE WHEN Match_Status='Full Match'    THEN 1 END)                                  AS full_count,
        COUNT(CASE WHEN Match_Status='Partial Match' THEN 1 END)                                  AS partial_count,
        COUNT(CASE WHEN Match_Status='Unmatched'     THEN 1 END)                                  AS unmatched_count
      FROM cdms_data ${W}
    `;

    console.log("SUMMARY SQL binds:", binds);
    console.log("SUMMARY W:", W);

    const byFc    = run<Record<string, number | string>[]>(pivotSql("FC", "total DESC"));
    const byMonth = run<Record<string, number | string>[]>(pivotSql("SUBSTR(collected_date,1,7)", "grp_key ASC"));
    const totals  = runGet<Record<string, number>>(totalsSql);

    const distinct = (col: string): string[] =>
      (db.prepare(
        `SELECT DISTINCT "${col}" AS v FROM cdms_data
         WHERE "${col}" IS NOT NULL AND "${col}" != ''
         ORDER BY "${col}" ASC`
      ).all() as { v: string }[]).map(r => r.v);

    return NextResponse.json({
      by_fc:    byFc,
      by_month: byMonth,
      totals,
      filter_opts: {
        fc:     distinct("FC"),
        brand:  distinct("Brand"),
        mode:   distinct("Collected_Mode"),
        status: ["Full Match", "Partial Match", "Unmatched"],
      },
      _debug: {
        fcVals:     params.getAll("fc"),
        brandVals:  params.getAll("brand"),
        statusVals: params.getAll("status"),
        modeVals:   params.getAll("mode"),
        binds,
        W,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
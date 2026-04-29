// FILE PATH: bank_cdms_dashboard/app/api/summary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildWhere(params: URLSearchParams) {
  const where: string[] = [];
  const binds: unknown[] = [];

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

  if (ref)      { where.push("Reference_no LIKE ?");              binds.push(`%${ref}%`); }
  if (invoice)  { where.push("Invoice_Number LIKE ?");            binds.push(`%${invoice}%`); }
  if (dateFrom) { where.push("SUBSTR(collected_date,1,10) >= ?"); binds.push(dateFrom); }
  if (dateTo)   { where.push("SUBSTR(collected_date,1,10) <= ?"); binds.push(dateTo); }

  return {
    W: where.length ? "WHERE " + where.join(" AND ") : "",
    binds,
  };
}

const pivotSql = (W: string, groupExpr: string, orderExpr: string) => `
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

const totalsSql = (W: string) => `
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

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const { W, binds } = buildWhere(params);

    const [byFc, byMonth, totalsRows, fcRows, brandRows, modeRows] = await Promise.all([
      dbQuery(pivotSql(W, "FC", "total DESC"), binds),
      dbQuery(pivotSql(W, "SUBSTR(collected_date,1,7)", "grp_key ASC"), binds),
      dbQuery(totalsSql(W), binds),
      dbQuery(`SELECT DISTINCT FC AS v FROM cdms_data WHERE FC IS NOT NULL AND FC != '' ORDER BY FC ASC`),
      dbQuery(`SELECT DISTINCT Brand AS v FROM cdms_data WHERE Brand IS NOT NULL AND Brand != '' ORDER BY Brand ASC`),
      dbQuery(`SELECT DISTINCT Collected_Mode AS v FROM cdms_data WHERE Collected_Mode IS NOT NULL AND Collected_Mode != '' ORDER BY Collected_Mode ASC`),
    ]);

    return NextResponse.json({
      by_fc:    byFc,
      by_month: byMonth,
      totals:   totalsRows[0] ?? {},
      filter_opts: {
        fc:     fcRows.map(r => r.v),
        brand:  brandRows.map(r => r.v),
        mode:   modeRows.map(r => r.v),
        status: ["Full Match", "Partial Match", "Unmatched"],
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
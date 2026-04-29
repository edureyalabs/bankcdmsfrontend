// FILE PATH: bank_cdms_dashboard/app/api/summary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

// Normalise collected_date to YYYY-MM regardless of input format:
//   DD/MM/YYYY  ->  YYYY-MM
//   DD-MM-YYYY  ->  YYYY-MM
//   YYYY-MM-DD  ->  YYYY-MM  (already correct)
//   YYYY-MM-DD HH:MM:SS -> YYYY-MM
const MONTH_EXPR = `
  CASE
    -- ISO: starts with 4-digit year  e.g. 2024-03-15 or 2024-03-15 12:00:00
    WHEN SUBSTR(collected_date, 5, 1) IN ('-', '/')
      THEN SUBSTR(collected_date, 1, 7)

    -- DD/MM/YYYY  or  DD-MM-YYYY
    WHEN INSTR(collected_date, '/') > 0
      THEN SUBSTR(collected_date, INSTR(collected_date,'/')+INSTR(SUBSTR(collected_date,INSTR(collected_date,'/')+1),'/')+1, 4)
        || '-'
        || SUBSTR(
             '0' || SUBSTR(collected_date, INSTR(collected_date,'/')+1,
               INSTR(SUBSTR(collected_date, INSTR(collected_date,'/')+1), '/') - 1
             ),
             -2
           )

    WHEN INSTR(collected_date, '-') > 0
         AND SUBSTR(collected_date, 5, 1) != '-'
      THEN SUBSTR(collected_date, INSTR(collected_date,'-')+INSTR(SUBSTR(collected_date,INSTR(collected_date,'-')+1),'-')+1, 4)
        || '-'
        || SUBSTR(
             '0' || SUBSTR(collected_date, INSTR(collected_date,'-')+1,
               INSTR(SUBSTR(collected_date, INSTR(collected_date,'-')+1), '-') - 1
             ),
             -2
           )

    ELSE NULL
  END
`;

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

  if (ref)      { where.push("Reference_no LIKE ?");                        binds.push(`%${ref}%`); }
  if (invoice)  { where.push("Invoice_Number LIKE ?");                      binds.push(`%${invoice}%`); }
  if (dateFrom) { where.push(`(${MONTH_EXPR}) >= SUBSTR(?,1,7)`);           binds.push(dateFrom); }
  if (dateTo)   { where.push(`(${MONTH_EXPR}) <= SUBSTR(?,1,7)`);           binds.push(dateTo); }

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

      // Group by normalised YYYY-MM, filter out nulls, sort chronologically
      dbQuery(pivotSql(
        W,
        MONTH_EXPR,
        "CASE WHEN grp_key IS NULL THEN 1 ELSE 0 END, grp_key ASC"
      ), binds),

      dbQuery(totalsSql(W), binds),
      dbQuery(`SELECT DISTINCT FC AS v FROM cdms_data WHERE FC IS NOT NULL AND FC != '' ORDER BY FC ASC`),
      dbQuery(`SELECT DISTINCT Brand AS v FROM cdms_data WHERE Brand IS NOT NULL AND Brand != '' ORDER BY Brand ASC`),
      dbQuery(`SELECT DISTINCT Collected_Mode AS v FROM cdms_data WHERE Collected_Mode IS NOT NULL AND Collected_Mode != '' ORDER BY Collected_Mode ASC`),
    ]);

    // Filter out null/invalid month keys from by_month
    const byMonthClean = byMonth.filter(r => r.grp_key && String(r.grp_key).match(/^\d{4}-\d{2}$/));

    return NextResponse.json({
      by_fc:    byFc,
      by_month: byMonthClean,
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
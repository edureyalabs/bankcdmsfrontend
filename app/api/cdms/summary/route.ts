// FILE PATH: bank_cdms_dashboard/app/api/summary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

// Normalises Cashier_verification_date to YYYY-MM-DD (for range filtering)
// and to YYYY-MM (for the by-month pivot grouping).
// Two possible formats in the column:
//   YYYY-MM-DD HH:MM:SS  →  ISO, just take first 10 / first 7 chars
//   MM/DD/YYYY           →  need to reconstruct
//
// Detection: if char 5 is '-' it's ISO, otherwise MM/DD/YYYY.

// Full date (YYYY-MM-DD) — used for dateFrom / dateTo range filter
const CVD_ISO = `
  CASE
    WHEN SUBSTR(Cashier_verification_date, 5, 1) = '-'
    THEN SUBSTR(Cashier_verification_date, 1, 10)
    ELSE printf('%04d-%02d-%02d',
      CAST(SUBSTR(Cashier_verification_date,
        INSTR(Cashier_verification_date,'/')+
        INSTR(SUBSTR(Cashier_verification_date,INSTR(Cashier_verification_date,'/')+1),'/')+1
      ) AS INTEGER),
      CAST(SUBSTR(Cashier_verification_date,1,INSTR(Cashier_verification_date,'/')-1) AS INTEGER),
      CAST(SUBSTR(SUBSTR(Cashier_verification_date,INSTR(Cashier_verification_date,'/')+1),1,
        INSTR(SUBSTR(Cashier_verification_date,INSTR(Cashier_verification_date,'/')+1),'/')-1
      ) AS INTEGER)
    )
  END
`;

// Month only (YYYY-MM) — used for the by-month pivot grouping
const CVD_MONTH = `
  CASE
    WHEN SUBSTR(Cashier_verification_date, 5, 1) = '-'
    THEN SUBSTR(Cashier_verification_date, 1, 7)
    ELSE
      SUBSTR(Cashier_verification_date,
        INSTR(Cashier_verification_date, '/') +
        INSTR(SUBSTR(Cashier_verification_date, INSTR(Cashier_verification_date, '/') + 1), '/') + 1,
        4
      )
      || '-'
      || SUBSTR(
           '0' || SUBSTR(Cashier_verification_date, 1, INSTR(Cashier_verification_date, '/') - 1),
           -2
         )
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

  if (ref)      { where.push("Reference_no LIKE ?");        binds.push(`%${ref}%`); }
  if (invoice)  { where.push("Invoice_Number LIKE ?");      binds.push(`%${invoice}%`); }
  if (dateFrom) { where.push(`(${CVD_ISO}) >= ?`);          binds.push(dateFrom); }
  if (dateTo)   { where.push(`(${CVD_ISO}) <= ?`);          binds.push(dateTo); }

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
      dbQuery(pivotSql(W, CVD_MONTH, "grp_key ASC"), binds),
      dbQuery(totalsSql(W), binds),
      dbQuery(`SELECT DISTINCT FC AS v FROM cdms_data WHERE FC IS NOT NULL AND FC != '' ORDER BY FC ASC`),
      dbQuery(`SELECT DISTINCT Brand AS v FROM cdms_data WHERE Brand IS NOT NULL AND Brand != '' ORDER BY Brand ASC`),
      dbQuery(`SELECT DISTINCT Collected_Mode AS v FROM cdms_data WHERE Collected_Mode IS NOT NULL AND Collected_Mode != '' ORDER BY Collected_Mode ASC`),
    ]);

    // Filter out any rows where grp_key is not a valid YYYY-MM
    const byMonthClean = byMonth.filter(
      r => r.grp_key && String(r.grp_key).match(/^\d{4}-\d{2}$/)
    );

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
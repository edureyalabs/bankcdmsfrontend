// FILE PATH: bank_cdms_dashboard/app/api/bank/summary/route.ts — NEW FILE

import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

// Normalise bank Date column to YYYY-MM
// Two formats observed:
//   YYYY-MM-DD HH:MM:SS  -> SUBSTR(,1,7) gives YYYY-MM
//   MM/DD/YYYY           -> rearrange
//   DD-Mon-YYYY          -> e.g. 01-Jan-2024  (HDFC branch statements)
const MONTH_EXPR = `
  CASE
    WHEN SUBSTR(Date, 5, 1) = '-'
    THEN SUBSTR(Date, 1, 7)
    WHEN INSTR(Date, '/') > 0
    THEN
      SUBSTR(Date,
        INSTR(Date, '/') +
        INSTR(SUBSTR(Date, INSTR(Date, '/') + 1), '/') + 1,
        4
      )
      || '-'
      || SUBSTR(
           '0' || SUBSTR(Date, 1, INSTR(Date, '/') - 1),
           -2
         )
    ELSE SUBSTR(Date, 1, 7)
  END
`;

function buildWhere(params: URLSearchParams) {
  const where: string[] = ["Row_Category = 'Distribution'"];
  const binds: unknown[] = [];

  const addIn = (col: string, vals: string[]) => {
    if (!vals.length) return;
    where.push(`"${col}" IN (${vals.map(() => "?").join(", ")})`);
    binds.push(...vals);
  };

  addIn("Bank_Account",   params.getAll("account"));
  addIn("Match_Status",   params.getAll("status"));
  addIn("FC",             params.getAll("fc"));
  addIn("Brand",          params.getAll("brand"));
  addIn("Narration_Type", params.getAll("narrType"));

  const ref      = params.get("ref")      || "";
  const dateFrom = params.get("dateFrom") || "";
  const dateTo   = params.get("dateTo")   || "";

  if (ref)      { where.push("Narration LIKE ?");              binds.push(`%${ref}%`); }
  if (dateFrom) { where.push(`(${MONTH_EXPR}) >= SUBSTR(?,1,7)`); binds.push(dateFrom); }
  if (dateTo)   { where.push(`(${MONTH_EXPR}) <= SUBSTR(?,1,7)`); binds.push(dateTo); }

  return {
    W: "WHERE " + where.join(" AND "),
    binds,
  };
}

const pivotSql = (W: string, groupExpr: string, orderExpr: string) => `
  SELECT
    (${groupExpr}) AS grp_key,
    COALESCE(SUM(Deposit_Amt), 0)                                                              AS total,
    COALESCE(SUM(CASE WHEN Match_Status='Full Match'    THEN Deposit_Amt ELSE 0 END), 0)       AS full_match,
    COALESCE(SUM(CASE WHEN Match_Status='Partial Match' THEN Deposit_Amt ELSE 0 END), 0)       AS partial,
    COALESCE(SUM(CASE WHEN Match_Status='Unmatched'     THEN Deposit_Amt ELSE 0 END), 0)       AS unmatched,
    COUNT(*)                                                                                   AS total_count,
    COUNT(CASE WHEN Match_Status='Full Match'    THEN 1 END)                                   AS full_count,
    COUNT(CASE WHEN Match_Status='Partial Match' THEN 1 END)                                   AS partial_count,
    COUNT(CASE WHEN Match_Status='Unmatched'     THEN 1 END)                                   AS unmatched_count
  FROM bank_data ${W}
  GROUP BY (${groupExpr})
  ORDER BY ${orderExpr}
`;

const totalsSql = (W: string) => `
  SELECT
    COALESCE(SUM(Deposit_Amt), 0)                                                              AS total,
    COALESCE(SUM(CASE WHEN Match_Status='Full Match'    THEN Deposit_Amt ELSE 0 END), 0)       AS full_match,
    COALESCE(SUM(CASE WHEN Match_Status='Partial Match' THEN Deposit_Amt ELSE 0 END), 0)       AS partial,
    COALESCE(SUM(CASE WHEN Match_Status='Unmatched'     THEN Deposit_Amt ELSE 0 END), 0)       AS unmatched,
    COUNT(*)                                                                                   AS total_count,
    COUNT(CASE WHEN Match_Status='Full Match'    THEN 1 END)                                   AS full_count,
    COUNT(CASE WHEN Match_Status='Partial Match' THEN 1 END)                                   AS partial_count,
    COUNT(CASE WHEN Match_Status='Unmatched'     THEN 1 END)                                   AS unmatched_count
  FROM bank_data ${W}
`;

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const { W, binds } = buildWhere(params);

    const [byAccount, byMonth, totalsRows, accountRows, fcRows, brandRows, narrTypeRows] =
      await Promise.all([
        dbQuery(pivotSql(W, "Bank_Account", "total DESC"), binds),
        dbQuery(pivotSql(W, MONTH_EXPR, "grp_key ASC"), binds),
        dbQuery(totalsSql(W), binds),
        dbQuery(`SELECT DISTINCT Bank_Account AS v FROM bank_data WHERE Bank_Account IS NOT NULL AND Bank_Account != '' AND Row_Category = 'Distribution' ORDER BY Bank_Account ASC`),
        dbQuery(`SELECT DISTINCT FC AS v FROM bank_data WHERE FC IS NOT NULL AND FC != '' AND Row_Category = 'Distribution' ORDER BY FC ASC`),
        dbQuery(`SELECT DISTINCT Brand AS v FROM bank_data WHERE Brand IS NOT NULL AND Brand != '' AND Row_Category = 'Distribution' ORDER BY Brand ASC`),
        dbQuery(`SELECT DISTINCT Narration_Type AS v FROM bank_data WHERE Narration_Type IS NOT NULL AND Narration_Type != '' AND Row_Category = 'Distribution' ORDER BY Narration_Type ASC`),
      ]);

    const byMonthClean = byMonth.filter(
      r => r.grp_key && String(r.grp_key).match(/^\d{4}-\d{2}$/)
    );

    return NextResponse.json({
      by_account: byAccount,
      by_month:   byMonthClean,
      totals:     totalsRows[0] ?? {},
      filter_opts: {
        account:   accountRows.map(r => r.v),
        fc:        fcRows.map(r => r.v),
        brand:     brandRows.map(r => r.v),
        narrType:  narrTypeRows.map(r => r.v),
        status:    ["Full Match", "Partial Match", "Unmatched"],
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
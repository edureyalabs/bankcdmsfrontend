// FILE PATH: app/api/cheque-clearance/raw/route.ts — REPLACE EXISTING

import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

const CHEQUE_MODE_FILTER = `UPPER(Collected_Mode) IN ('CHEQUE', 'CBM_CHEQUE', 'PDC')`;

// Cheque_Due_Date: stored as M/D/YYYY e.g. '5/19/2026' → YYYY-MM-DD
const DUE_DATE_ISO = `
  CASE
    WHEN Cheque_Due_Date IS NULL OR Cheque_Due_Date = '' THEN ''
    WHEN INSTR(Cheque_Due_Date, '/') = 0 THEN SUBSTR(Cheque_Due_Date, 1, 10)
    ELSE printf('%04d-%02d-%02d',
      CAST(SUBSTR(Cheque_Due_Date,
        INSTR(Cheque_Due_Date,'/')+
        INSTR(SUBSTR(Cheque_Due_Date,INSTR(Cheque_Due_Date,'/')+1),'/')+1
      ) AS INTEGER),
      CAST(SUBSTR(Cheque_Due_Date,1,INSTR(Cheque_Due_Date,'/')-1) AS INTEGER),
      CAST(SUBSTR(SUBSTR(Cheque_Due_Date,INSTR(Cheque_Due_Date,'/')+1),1,
        INSTR(SUBSTR(Cheque_Due_Date,INSTR(Cheque_Due_Date,'/')+1),'/')-1
      ) AS INTEGER))
  END
`;

// Cashier_verification_date: also M/D/YYYY e.g. '6/14/2025' → YYYY-MM
const CVD_MONTH = `
  CASE
    WHEN Cashier_verification_date IS NULL OR Cashier_verification_date = '' THEN ''
    WHEN INSTR(Cashier_verification_date, '/') = 0
    THEN SUBSTR(Cashier_verification_date, 1, 7)
    ELSE printf('%04d-%02d',
      CAST(SUBSTR(Cashier_verification_date,
        INSTR(Cashier_verification_date,'/')+
        INSTR(SUBSTR(Cashier_verification_date,INSTR(Cashier_verification_date,'/')+1),'/')+1
      ) AS INTEGER),
      CAST(SUBSTR(Cashier_verification_date,1,INSTR(Cashier_verification_date,'/')-1) AS INTEGER))
  END
`;

const BASE_WHERE = `${CHEQUE_MODE_FILTER} AND Match_Status = 'Unmatched'`;

function buildWhere(params: URLSearchParams): { W: string; binds: unknown[] } {
  const where: string[] = [BASE_WHERE];
  const binds: unknown[] = [];

  const addIn = (col: string, vals: string[]) => {
    if (!vals.length) return;
    if (col === "Collected_Mode") {
      where.push(`UPPER("${col}") IN (${vals.map(() => "UPPER(?)").join(", ")})`);
    } else {
      where.push(`"${col}" IN (${vals.map(() => "?").join(", ")})`);
    }
    binds.push(...vals);
  };

  addIn("FC",             params.getAll("fc"));
  addIn("Brand",          params.getAll("brand"));
  addIn("Collected_Mode", params.getAll("mode"));

  const ref      = params.get("ref")      || "";
  const retailer = params.get("retailer") || "";
  const dueTo    = params.get("dueTo")    || "";

  if (ref)      { where.push(`Reference_no LIKE ?`);  binds.push(`%${ref}%`); }
  if (retailer) { where.push(`Retailer_Name LIKE ?`); binds.push(`%${retailer}%`); }
  if (dueTo) {
    where.push(`(${DUE_DATE_ISO}) != '' AND (${DUE_DATE_ISO}) <= ?`);
    binds.push(dueTo);
  }

  return { W: "WHERE " + where.join(" AND "), binds };
}

export async function GET(req: NextRequest) {
  try {
    const params       = new URL(req.url).searchParams;
    const { W, binds } = buildWhere(params);
    const limit        = Math.min(Math.max(parseInt(params.get("limit")  || "100", 10), 1), 500);
    const offset       = Math.max(parseInt(params.get("offset") || "0",  10), 0);

    // Explicit aliases ensure consistent casing in JSON response keys
    // regardless of how SQLite stored the column name.
    const selectCols = `
      FC,
      Brand,
      Collected_Mode,
      Reference_no,
      Invoice_Number,
      Retailer_Name,
      Retailer_Code,
      Collected_Amount,
      Cheque_Due_Date,
      Cashier_verification_date,
      collected_date,
      Bank_Account,
      Match_Remark
    `;

    const BASE_W = `WHERE ${BASE_WHERE}`;

    const [countRows, rows, byFc, byMonth, totalsRows, fcOpts, brandOpts, modeOpts] =
      await Promise.all([
        dbQuery(`SELECT COUNT(*) AS total FROM cdms_data ${W}`, binds),
        dbQuery(
          `SELECT ${selectCols} FROM cdms_data ${W}
           ORDER BY (${DUE_DATE_ISO}) ASC, FC ASC
           LIMIT ? OFFSET ?`,
          [...binds, limit, offset]
        ),
        dbQuery(
          `SELECT FC AS grp_key,
             COALESCE(SUM(Collected_Amount), 0) AS total,
             COUNT(*) AS total_count
           FROM cdms_data ${W}
           GROUP BY FC ORDER BY total DESC`,
          binds
        ),
        dbQuery(
          `SELECT (${CVD_MONTH}) AS grp_key,
             COALESCE(SUM(Collected_Amount), 0) AS total,
             COUNT(*) AS total_count
           FROM cdms_data ${W}
           GROUP BY (${CVD_MONTH}) ORDER BY grp_key ASC`,
          binds
        ),
        dbQuery(
          `SELECT COALESCE(SUM(Collected_Amount), 0) AS total,
             COUNT(*) AS total_count
           FROM cdms_data ${W}`,
          binds
        ),
        dbQuery(`SELECT DISTINCT FC AS v FROM cdms_data ${BASE_W} AND FC IS NOT NULL AND FC != '' ORDER BY FC ASC`),
        dbQuery(`SELECT DISTINCT Brand AS v FROM cdms_data ${BASE_W} AND Brand IS NOT NULL AND Brand != '' ORDER BY Brand ASC`),
        dbQuery(`SELECT DISTINCT Collected_Mode AS v FROM cdms_data ${BASE_W} AND Collected_Mode IS NOT NULL AND Collected_Mode != '' ORDER BY Collected_Mode ASC`),
      ]);

    const total        = (countRows[0]?.total as number) ?? 0;
    const byMonthClean = (byMonth as { grp_key: string }[]).filter(
      r => r.grp_key && String(r.grp_key).match(/^\d{4}-\d{2}$/)
    );

    return NextResponse.json({
      rows,
      count:   rows.length,
      total,
      limit,
      offset,
      hasMore:  offset + limit < total,
      by_fc:    byFc,
      by_month: byMonthClean,
      totals:   totalsRows[0] ?? {},
      filter_opts: {
        fc:    fcOpts.map(r  => r.v),
        brand: brandOpts.map(r => r.v),
        mode:  modeOpts.map(r  => r.v),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
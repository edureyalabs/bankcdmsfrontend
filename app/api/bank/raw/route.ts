// FILE PATH: bank_cdms_dashboard/app/api/bank/raw/route.ts — REPLACE EXISTING

import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;

    // No hard Row_Category filter — all rows visible by default.
    // UI passes ?rowCategory=Distribution and/or ?rowCategory=Excluded to filter.
    const where: string[] = [];
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
    addIn("Row_Category",   params.getAll("rowCategory"));

    const ref      = params.get("ref")      || "";
    const dateFrom = params.get("dateFrom") || "";
    const dateTo   = params.get("dateTo")   || "";

    if (ref)      { where.push("Extracted_Ref LIKE ?");                  binds.push(`%${ref}%`); }
    if (dateFrom) { where.push(`(${MONTH_EXPR}) >= SUBSTR(?,1,7)`);  binds.push(dateFrom); }
    if (dateTo)   { where.push(`(${MONTH_EXPR}) <= SUBSTR(?,1,7)`);  binds.push(dateTo); }

    const W      = where.length ? "WHERE " + where.join(" AND ") : "";
    const limit  = Math.min(Math.max(parseInt(params.get("limit")  || "100", 10), 1), 500);
    const offset = Math.max(parseInt(params.get("offset") || "0",  10), 0);

    const selectCols = `
      Bank_Account, Date, Match_Status, Row_Category, FC, Brand,
      Narration, Chq_Ref, Narration_Type,
      Deposit_Amt, Withdrawal_Amt,
      Extracted_Ref, Matched_Retailer, Invoice_Numbers,
      CDMS_Sum, Diff, Remark
    `;

    const [countRows, rows] = await Promise.all([
      dbQuery(`SELECT COUNT(*) AS total FROM bank_data ${W}`, binds),
      dbQuery(
        `SELECT ${selectCols} FROM bank_data ${W} ORDER BY Date DESC, Bank_Account ASC LIMIT ? OFFSET ?`,
        [...binds, limit, offset]
      ),
    ]);

    const total = (countRows[0]?.total as number) ?? 0;

    return NextResponse.json({
      rows,
      count:   rows.length,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
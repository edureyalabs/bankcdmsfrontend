// FILE PATH: bank_cdms_dashboard/app/api/bank/download/route.ts — REPLACE EXISTING

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

    // No hard Row_Category filter — all rows exported by default.
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

    const W = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbQuery(
      `SELECT
         Bank_Account, Date, Match_Status, Row_Category, FC, Brand,
         Narration, Chq_Ref, Narration_Type,
         Deposit_Amt, Withdrawal_Amt,
         Extracted_Ref, Matched_Retailer, Invoice_Numbers,
         CDMS_Sum, Diff, Remark
       FROM bank_data ${W}
       ORDER BY Date DESC, Bank_Account ASC`,
      binds
    );

    if (!rows.length) return new NextResponse("No data", { status: 204 });

    const headers = Object.keys(rows[0]);
    const escape  = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };

    const csv =
      headers.join(",") + "\n" +
      rows.map(r => headers.map(h => escape(r[h])).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type":        "text/csv",
        "Content-Disposition": 'attachment; filename="bank_export.csv"',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
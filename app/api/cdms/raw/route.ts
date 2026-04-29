// FILE PATH: app/api/cdms/raw/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const db     = getDb();
    const params = new URL(req.url).searchParams;

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

    const cvdIso = `
      CASE
        WHEN SUBSTR(Cashier_verification_date,5,1) = '-'
        THEN SUBSTR(Cashier_verification_date,1,10)
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

    if (dateFrom) { where.push(`(${cvdIso}) >= ?`); binds.push(dateFrom); }
    if (dateTo)   { where.push(`(${cvdIso}) <= ?`); binds.push(dateTo); }

    const W = where.length ? "WHERE " + where.join(" AND ") : "";

    // Pagination params
    const limit  = Math.min(Math.max(parseInt(params.get("limit")  || "100", 10), 1), 500);
    const offset = Math.max(parseInt(params.get("offset") || "0",   10), 0);

    const selectCols = `
      FC, Brand, Match_Status, Collected_Mode,
      Reference_no, Invoice_Number, Retailer_Name, Retailer_Code,
      Collected_Amount, Cashier_verification_date,
      Bank_Ref_Extracted, Bank_Narration_Type, Bank_Account,
      Bank_Date, Bank_Deposit_Amt, CDMS_Sum, Diff, Match_Remark
    `;

    const countSql = `SELECT COUNT(*) AS total FROM cdms_data ${W}`;
    const rowsSql  = `
      SELECT ${selectCols}
      FROM cdms_data
      ${W}
      ORDER BY FC, collected_date DESC
      LIMIT ? OFFSET ?
    `;

    const countBinds = [...binds];
    const rowsBinds  = [...binds, limit, offset];

    const { total } = (
      countBinds.length
        ? db.prepare(countSql).get(...countBinds)
        : db.prepare(countSql).get()
    ) as { total: number };

    const rows = rowsBinds.length
      ? db.prepare(rowsSql).all(...rowsBinds)
      : db.prepare(rowsSql).all();

    return NextResponse.json({
      rows,
      count:  (rows as unknown[]).length,
      total,            // total matching rows (for "X of Y" display)
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
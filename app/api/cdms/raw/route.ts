// FILE PATH: app/api/cdms/raw/route.ts

import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

// Normalises Cashier_verification_date to YYYY-MM-DD for range filtering.
// Two possible formats: "YYYY-MM-DD HH:MM:SS" or "MM/DD/YYYY".
// Detection: if char 5 is '-' it's ISO, otherwise MM/DD/YYYY.
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

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;

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

    if (ref)      { where.push("Reference_no LIKE ?");   binds.push(`%${ref}%`); }
    if (invoice)  { where.push("Invoice_Number LIKE ?"); binds.push(`%${invoice}%`); }
    if (dateFrom) { where.push(`(${CVD_ISO}) >= ?`);     binds.push(dateFrom); }
    if (dateTo)   { where.push(`(${CVD_ISO}) <= ?`);     binds.push(dateTo); }

    const W      = where.length ? "WHERE " + where.join(" AND ") : "";
    const limit  = Math.min(Math.max(parseInt(params.get("limit")  || "100", 10), 1), 500);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10), 0);

    const selectCols = `
      FC, Brand, Match_Status, Collected_Mode,
      Reference_no, Invoice_Number, Retailer_Name, Retailer_Code,
      Collected_Amount, Cashier_verification_date,
      Bank_Ref_Extracted, Bank_Narration_Type, Bank_Account,
      Bank_Date, Bank_Deposit_Amt, CDMS_Sum, Diff, Match_Remark
    `;

    const [countRows, rows] = await Promise.all([
      dbQuery(`SELECT COUNT(*) AS total FROM cdms_data ${W}`, binds),
      dbQuery(
        `SELECT ${selectCols} FROM cdms_data ${W} ORDER BY FC, (${CVD_ISO}) DESC LIMIT ? OFFSET ?`,
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
// FILE PATH: app/api/cheque-clearance/download/route.ts — REPLACE EXISTING

import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

const CHEQUE_MODE_FILTER = `UPPER(Collected_Mode) IN ('CHEQUE', 'CBM_CHEQUE', 'PDC')`;

const DUE_DATE_ISO = `
  CASE
    WHEN Cheque_Due_Date IS NULL OR Cheque_Due_Date = '' THEN ''
    WHEN INSTR(Cheque_Due_Date, '/') = 0 THEN SUBSTR(Cheque_Due_Date, 1, 10)
    ELSE
      printf('%04d-%02d-%02d',
        CAST(SUBSTR(Cheque_Due_Date,
          INSTR(Cheque_Due_Date, '/') +
          INSTR(SUBSTR(Cheque_Due_Date, INSTR(Cheque_Due_Date, '/') + 1), '/') + 1
        ) AS INTEGER),
        CAST(SUBSTR(Cheque_Due_Date, 1, INSTR(Cheque_Due_Date, '/') - 1) AS INTEGER),
        CAST(SUBSTR(
          SUBSTR(Cheque_Due_Date, INSTR(Cheque_Due_Date, '/') + 1),
          1,
          INSTR(SUBSTR(Cheque_Due_Date, INSTR(Cheque_Due_Date, '/') + 1), '/') - 1
        ) AS INTEGER)
      )
  END
`;

const BASE_WHERE = `${CHEQUE_MODE_FILTER} AND Match_Status = 'Unmatched'`;

export async function GET(req: NextRequest) {
  try {
    const params   = new URL(req.url).searchParams;
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

    const W = "WHERE " + where.join(" AND ");

    const rawRows = await dbQuery(
      `SELECT
         collected_date, FC, Brand, Retailer_Code, Retailer_Name,
         Invoice_Number, Collected_Amount, Collected_Mode,
         Cheque_Due_Date, Reference_no, Bank_Account,
         Cashier_verification_date, Match_Remark
       FROM cdms_data ${W}
       ORDER BY (${DUE_DATE_ISO}) ASC, FC ASC`,
      binds
    );

    if (!rawRows.length) return new NextResponse("No data", { status: 204 });

    const headers = Object.keys(rawRows[0]);
    const escape  = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };

    const csv =
      headers.join(",") + "\n" +
      rawRows.map(r => headers.map(h => escape(r[h])).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type":        "text/csv",
        "Content-Disposition": 'attachment; filename="cheque_clearance_export.csv"',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
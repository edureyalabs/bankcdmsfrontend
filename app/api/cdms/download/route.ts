// FILE PATH: bank_cdms_dashboard/app/api/cdms/download/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const DATE_STRIP = `CASE WHEN INSTR(Cashier_verification_date,' ')>0 THEN SUBSTR(Cashier_verification_date,1,INSTR(Cashier_verification_date,' ')-1) ELSE Cashier_verification_date END`;
const DATE_ISO   = `CASE WHEN SUBSTR(d,5,1)='-' THEN SUBSTR(d,1,10) ELSE printf('%04d-%02d-%02d',CAST(SUBSTR(d,INSTR(d,'/')+1+INSTR(SUBSTR(d,INSTR(d,'/')+1),'/')) AS INTEGER),CAST(SUBSTR(d,1,INSTR(d,'/')-1) AS INTEGER),CAST(SUBSTR(SUBSTR(d,INSTR(d,'/')+1),1,INSTR(SUBSTR(d,INSTR(d,'/')+1),'/')-1) AS INTEGER)) END`;

const BASE_CTE = `
  WITH s1 AS (SELECT *, (${DATE_STRIP}) AS d FROM cdms_data),
       dated AS (SELECT *, (${DATE_ISO}) AS cvd_iso FROM s1)
`;

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

    const account  = params.get("account")  || "";
    const invoice  = params.get("invoice")  || "";
    const ref      = params.get("ref")      || "";
    const dateFrom = params.get("dateFrom") || "";
    const dateTo   = params.get("dateTo")   || "";

    if (account)  { where.push('Bank_Account = ?');      binds.push(account); }
    if (invoice)  { where.push('Invoice_Number LIKE ?'); binds.push(`%${invoice}%`); }
    if (ref)      { where.push('Reference_no LIKE ?');   binds.push(`%${ref}%`); }
    if (dateFrom) { where.push('cvd_iso >= ?');          binds.push(dateFrom); }
    if (dateTo)   { where.push('cvd_iso <= ?');          binds.push(dateTo); }

    const wc = where.length ? "WHERE " + where.join(" AND ") : "";

    const rawRows = (
      binds.length
        ? db.prepare(`${BASE_CTE} SELECT * FROM dated ${wc} ORDER BY id ASC`).all(...binds)
        : db.prepare(`${BASE_CTE} SELECT * FROM dated ORDER BY id ASC`).all()
    ) as Record<string, unknown>[];

    if (!rawRows.length) return new NextResponse("No data", { status: 204 });

    const skipCols = new Set(["d", "cvd_iso"]);
    const headers  = Object.keys(rawRows[0]).filter(k => k !== "id" && !skipCols.has(k));

    const escape = (v: unknown) => {
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
        "Content-Disposition": 'attachment; filename="cdms_export.csv"',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
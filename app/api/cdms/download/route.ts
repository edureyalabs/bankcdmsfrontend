// FILE PATH: bank_cdms_dashboard/app/api/cdms/download/route.ts

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

    const invoice  = params.get("invoice")  || "";
    const ref      = params.get("ref")      || "";
    const dateFrom = params.get("dateFrom") || "";
    const dateTo   = params.get("dateTo")   || "";

    if (invoice)  { where.push("Invoice_Number LIKE ?"); binds.push(`%${invoice}%`); }
    if (ref)      { where.push("Reference_no LIKE ?");   binds.push(`%${ref}%`); }
    if (dateFrom) { where.push(`(${CVD_ISO}) >= ?`);     binds.push(dateFrom); }
    if (dateTo)   { where.push(`(${CVD_ISO}) <= ?`);     binds.push(dateTo); }

    const W = where.length ? "WHERE " + where.join(" AND ") : "";

    const rawRows = await dbQuery(
      `SELECT * FROM cdms_data ${W} ORDER BY id ASC`,
      binds
    );

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
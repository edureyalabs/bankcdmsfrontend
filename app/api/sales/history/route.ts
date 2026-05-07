// FILE PATH: app/api/sales/history/route.ts
// Returns daily sales_history rows filtered by date range, fc, brand.
// Frontend does all chart aggregation — this just serves filtered raw daily data.

import { NextRequest, NextResponse } from "next/server";
import { dbQuery }                   from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params   = new URL(req.url).searchParams;
    const dateFrom = params.get("dateFrom") || "";
    const dateTo   = params.get("dateTo")   || "";
    const fcs      = params.getAll("fc");
    const brands   = params.getAll("brand");

    const where: string[] = [];
    const binds: unknown[] = [];

    if (dateFrom) { where.push("bill_date >= ?"); binds.push(dateFrom); }
    if (dateTo)   { where.push("bill_date <= ?"); binds.push(dateTo);   }

    if (fcs.length) {
      where.push(`fc_code IN (${fcs.map(() => "?").join(",")})`);
      binds.push(...fcs);
    }
    if (brands.length) {
      where.push(`brand_code IN (${brands.map(() => "?").join(",")})`);
      binds.push(...brands);
    }

    const W = where.length ? "WHERE " + where.join(" AND ") : "";

    const [rows, metaFc, metaBrand, metaDateRange] = await Promise.all([
      dbQuery(
        `SELECT bill_date, fc_code, brand_code, total_sum
         FROM sales_history ${W}
         ORDER BY bill_date ASC, fc_code ASC, brand_code ASC`,
        binds
      ),
      // Filter options
      dbQuery(`SELECT DISTINCT fc_code AS v FROM sales_history ORDER BY fc_code ASC`),
      dbQuery(`SELECT DISTINCT brand_code AS v FROM sales_history ORDER BY brand_code ASC`),
      dbQuery(`SELECT MIN(bill_date) AS min_date, MAX(bill_date) AS max_date FROM sales_history`),
    ]);

    return NextResponse.json({
      rows,
      filter_opts: {
        fc:        metaFc.map(r => r.v),
        brand:     metaBrand.map(r => r.v),
        min_date:  metaDateRange[0]?.min_date ?? "",
        max_date:  metaDateRange[0]?.max_date ?? "",
      },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
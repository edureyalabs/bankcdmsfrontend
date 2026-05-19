// FILE PATH: app/api/sales/salesman/drill/route.ts
// Returns brand-level and FC-level breakdown for a specific salesman + date range.

import { NextRequest, NextResponse } from "next/server";
import { dbQuery }                   from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params         = new URL(req.url).searchParams;
    const salesman_code  = params.get("salesman_code") || "";
    const from_date      = params.get("from_date")     || "";
    const to_date        = params.get("to_date")       || "";

    if (!salesman_code || !from_date || !to_date) {
      return NextResponse.json({ error: "salesman_code, from_date, to_date are required" }, { status: 400 });
    }

    const binds = [salesman_code, from_date, to_date];

    const [byBrand, byFc] = await Promise.all([
      dbQuery(
        `SELECT brand_name, brand_code,
                SUM(net_amount) AS net_amount,
                SUM(bills)      AS bills,
                SUM(outlets)    AS outlets,
                SUM(sku_count)  AS sku_count
         FROM salesman_actuals
         WHERE salesman_code = ? AND from_date = ? AND to_date = ?
         GROUP BY brand_name, brand_code
         ORDER BY net_amount DESC`,
        binds
      ),
      dbQuery(
        `SELECT fc_name, fc_code, city,
                SUM(net_amount) AS net_amount,
                SUM(bills)      AS bills,
                SUM(outlets)    AS outlets
         FROM salesman_actuals
         WHERE salesman_code = ? AND from_date = ? AND to_date = ?
         GROUP BY fc_name, fc_code, city
         ORDER BY net_amount DESC`,
        binds
      ),
    ]);

    return NextResponse.json({ byBrand, byFc });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
// FILE PATH: app/api/sales/targets/route.ts

import { NextResponse } from "next/server";
import { dbQuery }      from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await dbQuery(
      `SELECT config_type, config_json, updated_at
       FROM sales_config
       ORDER BY id ASC`
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: "No sales config found. Run sales_sync.py then sync_to_turso.py." },
        { status: 404 }
      );
    }

    let targets     = null;
    let monthConfig = null;

    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.config_json as string);
        if (row.config_type === "targets")      targets     = parsed;
        if (row.config_type === "month_config") monthConfig = parsed;
      } catch {
        // malformed JSON — skip
      }
    }

    return NextResponse.json({ targets, monthConfig });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
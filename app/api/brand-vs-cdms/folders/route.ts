// FILE PATH: bank_cdms_dashboard/app/api/brand-vs-cdms/folders/route.ts — NEW FILE

import { NextResponse } from "next/server";
import fs from "fs";

export async function GET() {
  const ROOT = process.env.BRAND_CDMS_ROOT;

  if (!ROOT) {
    return NextResponse.json(
      { error: "BRAND_CDMS_ROOT is not set in .env.local" },
      { status: 500 }
    );
  }

  if (!fs.existsSync(ROOT)) {
    return NextResponse.json(
      { error: `Path not found: ${ROOT}` },
      { status: 404 }
    );
  }

  try {
    const entries = fs.readdirSync(ROOT, { withFileTypes: true });
    const folders = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ root: ROOT, folders });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read directory" },
      { status: 500 }
    );
  }
}
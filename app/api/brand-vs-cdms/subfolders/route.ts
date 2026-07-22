// FILE PATH: bank_cdms_dashboard/app/api/brand-vs-cdms/subfolders/route.ts — REPLACE EXISTING

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getFcsForBrand, getBrand } from "@/lib/config";

export async function GET(req: Request) {
  const ROOT = process.env.BRAND_CDMS_ROOT;

  if (!ROOT) {
    return NextResponse.json(
      { error: "BRAND_CDMS_ROOT is not set in .env.local" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const brandFolder = searchParams.get("brand");

  if (!brandFolder) {
    return NextResponse.json({ error: "Missing 'brand' query param" }, { status: 400 });
  }

  if (brandFolder.includes("..") || brandFolder.includes("/") || brandFolder.includes("\\")) {
    return NextResponse.json({ error: "Invalid brand folder name" }, { status: 400 });
  }

  const brandConfig = getBrand(brandFolder);
  if (!brandConfig) {
    return NextResponse.json(
      { error: `'${brandFolder}' is not a configured brand in config/brand-fc.json` },
      { status: 404 }
    );
  }

  const brandPath = path.join(ROOT, brandFolder);
  if (!fs.existsSync(brandPath) || !fs.statSync(brandPath).isDirectory()) {
    return NextResponse.json({ error: `Brand folder not found: ${brandFolder}` }, { status: 404 });
  }

  try {
    const diskEntries = fs
      .readdirSync(brandPath, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);

    const diskSet = new Set(diskEntries);

    // Only FCs that exist BOTH in config AND on disk are returned, per spec
    // ("list only fc names which are present in the config file and
    // excludes the others even if present in the brand folder").
    const configuredFcs = getFcsForBrand(brandFolder).filter(fc => diskSet.has(fc.folderName));

    const fcs = configuredFcs
      .map(fc => ({ folderName: fc.folderName, fcId: fc.fcId }))
      .sort((a, b) => a.folderName.localeCompare(b.folderName));

    return NextResponse.json({ brandFolder, brandId: brandConfig.brandId, fcs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read brand folder" },
      { status: 500 }
    );
  }
}
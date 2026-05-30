// FILE PATH: app/api/auth/me/route.ts — REPLACE EXISTING

import { NextRequest, NextResponse } from "next/server";

const ROLE_PAGES: Record<string, string[]> = {
  admin: [
    "/cdms", "/bank",
    "/sales/targets", "/sales/report", "/sales/command", "/sales/salesman",
    "/cheque-clearance",
  ],
  commercial_executive: [
    "/cdms", "/bank",
    "/cheque-clearance",
  ],
  venkatesh: [
    "/sales/report", "/sales/targets", "/sales/command", "/sales/salesman",
  ],
};

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("cdms_session")?.value ?? "";

  let role: string | null = null;

  const newFormat = cookie.match(/^role:(.+)$/);
  if (newFormat) {
    role = newFormat[1];
  } else if (cookie === "authenticated") {
    role = "admin";
  }

  if (!role) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const pages = ROLE_PAGES[role] ?? [];
  return NextResponse.json({ role, pages });
}
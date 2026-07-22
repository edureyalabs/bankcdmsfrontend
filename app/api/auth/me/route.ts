// app/api/auth/me/route.ts

import { NextRequest, NextResponse } from "next/server";

const ROLE_PAGES: Record<string, string[]> = {
  admin: [
    "/cdms", "/bank",
  ],
  commercial_executive: [
    "/cdms", "/bank",
  ],
  venkatesh: [
    "/cdms", "/bank",
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
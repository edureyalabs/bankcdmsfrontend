// FILE PATH: middleware.ts — REPLACE EXISTING

import { NextRequest, NextResponse } from "next/server";

const ROLE_PAGE_MAP: Record<string, string[]> = {
  admin: [
    "/cdms", "/bank", "/sales", "/cheque-clearance",
    "/api/cdms", "/api/bank", "/api/sales", "/api/summary", "/api/cheque-clearance",
  ],
  commercial_executive: [
    "/cdms", "/bank", "/cheque-clearance",
    "/api/cdms", "/api/bank", "/api/summary", "/api/cheque-clearance",
  ],
  venkatesh: [
    "/sales/targets", "/sales/report", "/sales/command", "/sales/salesman",
    "/api/sales",
  ],
};

function getRoleFromCookie(cookie: string): string | null {
  const match = cookie.match(/^role:(.+)$/);
  if (match) return match[1];
  if (cookie === "authenticated") return "admin";
  return null;
}

function canAccess(role: string, pathname: string): boolean {
  if (role === "admin") return true;
  const allowed = ROLE_PAGE_MAP[role] ?? [];
  return allowed.some(prefix => pathname.startsWith(prefix));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  const isProtected =
    pathname.startsWith("/cdms")        ||
    pathname.startsWith("/bank")        ||
    pathname.startsWith("/sales")       ||
    pathname.startsWith("/api/cdms")    ||
    pathname.startsWith("/api/bank")    ||
    pathname.startsWith("/api/sales")   ||
    pathname.startsWith("/api/summary");

  if (!isProtected) return NextResponse.next();

  const cookie = req.cookies.get("cdms_session")?.value ?? "";
  const role   = getRoleFromCookie(cookie);

  if (!role) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!canAccess(role, pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const allowed = (ROLE_PAGE_MAP[role] ?? []).filter(p => !p.startsWith("/api/"));
    const url = req.nextUrl.clone();
    url.pathname = allowed[0] ?? "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/cdms/:path*",
    "/bank/:path*",
    "/sales/:path*",
    "/api/cdms/:path*",
    "/api/bank/:path*",
    "/api/sales/:path*",
    "/api/summary/:path*",
    "/api/auth/me",
  ],
};
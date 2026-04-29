// FILE PATH: middleware.ts  (project root, next to package.json)

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const session = req.cookies.get("cdms_session")?.value;
  const { pathname } = req.nextUrl;

  // Protect /cdms and /api/cdms/* and /api/summary
  const isProtected =
    pathname.startsWith("/cdms") ||
    pathname.startsWith("/api/cdms") ||
    pathname.startsWith("/api/summary");

  if (isProtected && session !== "authenticated") {
    // API routes → 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    // Pages → redirect to login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/cdms/:path*", "/api/cdms/:path*", "/api/summary/:path*"],
};
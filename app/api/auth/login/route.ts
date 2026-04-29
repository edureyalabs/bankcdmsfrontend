// FILE PATH: app/api/auth/login/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const validUser = process.env.ADMIN_USERNAME;
    const validPass = process.env.ADMIN_PASSWORD;

    if (!validUser || !validPass) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (username !== validUser || password !== validPass) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });

    // Set a simple session cookie (httpOnly so JS can't read it)
    res.cookies.set("cdms_session", "authenticated", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // No maxAge = session cookie (cleared when browser closes)
      // Add maxAge: 60 * 60 * 8  for 8-hour persistence if you want
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
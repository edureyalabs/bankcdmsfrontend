import { NextRequest, NextResponse } from "next/server";

const ROLE_PAGE_MAP: Record<string, string[]> = {
  admin:                ["/cdms", "/bank", "/sales/targets", "/sales/report"],
  commercial_executive: ["/cdms", "/bank"],
  sam:                  ["/sales/report"],
};

function getRoles(): { name: string; password: string }[] {
  const roles: { name: string; password: string }[] = [];

  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(/^ROLE_(.+)_PASSWORD$/);
    if (!match || !value) continue;
    const roleName = match[1].toLowerCase();
    roles.push({ name: roleName, password: value });
  }

  return roles;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    // ── Admin check ──────────────────────────────────────────────────────────
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (!adminUser || !adminPass) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (username === adminUser && password === adminPass) {
      const res = NextResponse.json({
        ok: true,
        role: "admin",
        pages: ROLE_PAGE_MAP["admin"],
      });
      res.cookies.set("cdms_session", "role:admin", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }

    // ── Role-based check ─────────────────────────────────────────────────────
    const roles       = getRoles();
    const matchedRole = roles.find(
      r => r.name === username.toLowerCase() && r.password === password
    );

    if (matchedRole) {
      const pages = ROLE_PAGE_MAP[matchedRole.name] ?? [];
      const res   = NextResponse.json({
        ok: true,
        role: matchedRole.name,
        pages,
      });
      res.cookies.set("cdms_session", `role:${matchedRole.name}`, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }

    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
// components/Nav.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ALL_TABS = [
  { label: "CDMS Mapping",              path: "/cdms"          },
  { label: "Bank Mapping",              path: "/bank"          },
  { label: "Brand v/s CDMS Collections", path: "/brand-vs-cdms" },
  { label: "GST Checker",               path: "/gst-checker"   },
];

interface AuthInfo {
  role:  string;
  pages: string[];
}

export default function Nav() {
  const pathname = usePathname();
  const router   = useRouter();

  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);

  const isAuth =
    pathname.startsWith("/cdms")          ||
    pathname.startsWith("/bank")          ||
    pathname.startsWith("/brand-vs-cdms") ||
    pathname.startsWith("/gst-checker");

  useEffect(() => {
    if (!isAuth) return;
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => (d?.pages ? setAuthInfo(d) : setAuthInfo(null)))
      .catch(() => setAuthInfo(null));
  }, [isAuth]);

  if (!isAuth) return null;

  const allowedPages = authInfo?.pages ?? null;
  const role         = authInfo?.role  ?? "";

  const visibleTabs = ALL_TABS.filter(tab =>
    allowedPages === null
      ? true
      : allowedPages.some(p =>
          tab.path === p ||
          tab.path.startsWith(p + "/") ||
          p.startsWith(tab.path)
        )
  );

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0 16px",
    height: "100%",
    display: "flex",
    alignItems: "center",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    background: "none",
    letterSpacing: "0.01em",
    color: active ? "#f8fafc" : "#94a3b8",
    borderBottom: active ? "2px solid #60a5fa" : "2px solid transparent",
    transition: "color 0.15s, border-color 0.15s",
  });

  const roleLabel = role
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <nav style={{
      background: "#0f172a",
      borderBottom: "1px solid #1e293b",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: "1600px",
        margin: "0 auto",
        padding: "0 20px",
        height: "52px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginRight: "24px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "7px",
              background: "#2563eb",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" fill="white"/>
                <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.5"/>
                <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.5"/>
                <rect x="9" y="9" width="5" height="5" rx="1" fill="white"/>
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: "15px", color: "#f8fafc", letterSpacing: "-0.02em" }}>
              Data<span style={{ color: "#60a5fa" }}> Analytics</span>
            </span>
          </div>
          <div style={{ width: "1px", height: "22px", background: "#1e293b", marginRight: "8px" }} />
          <div style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
            {visibleTabs.map(tab => (
              <button
                key={tab.path}
                style={tabStyle(pathname.startsWith(tab.path))}
                onClick={() => router.push(tab.path)}
                onMouseEnter={e => {
                  if (!pathname.startsWith(tab.path))
                    (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0";
                }}
                onMouseLeave={e => {
                  if (!pathname.startsWith(tab.path))
                    (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {role && (
            <span style={{
              fontSize: "10px", fontWeight: 700,
              padding: "3px 10px", borderRadius: "99px",
              background: "rgba(96,165,250,0.1)", color: "#7dd3fc",
              border: "1px solid rgba(96,165,250,0.2)",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              {roleLabel}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(255,255,255,0.07)", color: "#94a3b8",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "7px",
              padding: "5px 14px", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", transition: "background 0.15s, color 0.15s",
              letterSpacing: "0.01em",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.color = "#f1f5f9";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
              (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
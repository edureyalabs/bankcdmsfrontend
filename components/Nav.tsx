"use client";

import { usePathname, useRouter } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();
  const router   = useRouter();

  // Only show nav on authenticated pages (anything under /cdms)
  if (!pathname.startsWith("/cdms")) return null;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

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
        {/* Left: logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "7px",
            background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white"/>
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.5"/>
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.5"/>
              <rect x="9" y="9" width="5" height="5" rx="1" fill="white"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: "15px", color: "#f8fafc", letterSpacing: "-0.02em" }}>
            Commercial<span style={{ color: "#60a5fa" }}> Analytics</span>
          </span>
          <span style={{
            fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px",
            background: "rgba(96,165,250,0.15)", color: "#93c5fd",
            border: "1px solid rgba(96,165,250,0.25)", letterSpacing: "0.08em",
          }}>CDMS</span>
        </div>

        {/* Right: sign out */}
        <button
          onClick={handleLogout}
          style={{
            background: "rgba(255,255,255,0.07)",
            color: "#94a3b8",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "7px",
            padding: "5px 14px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
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
    </nav>
  );
}
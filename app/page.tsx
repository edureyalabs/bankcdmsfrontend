// app/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid credentials");
        return;
      }
      router.push(data.pages?.[0] ?? "/cdms");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* ── Left panel — 58% ───────────────────────────────────── */}
      <div
        style={{
          width: "58%",
          flexShrink: 0,
          background: "linear-gradient(135deg, #1d4ed8 0%, #1e3a5f 40%, #0c2340 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          padding: "44px 52px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle geometric accent — large faint circle top-right */}
        <div style={{
          position: "absolute", top: "-120px", right: "-120px",
          width: "420px", height: "420px", borderRadius: "50%",
          border: "1px solid rgba(56,189,248,0.10)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "-60px", right: "-60px",
          width: "280px", height: "280px", borderRadius: "50%",
          border: "1px solid rgba(56,189,248,0.07)",
          pointerEvents: "none",
        }} />
        {/* Small accent dot bottom-left */}
        <div style={{
          position: "absolute", bottom: "80px", left: "-40px",
          width: "180px", height: "180px", borderRadius: "50%",
          background: "rgba(56,189,248,0.05)",
          pointerEvents: "none",
        }} />

        {/* Logo + Headline grouped together near the top */}
        <div style={{ position: "relative" }}>
          {/* Logo */}
          <div style={{ marginBottom: "36px" }}>
            <img
              src="/logo.jpg"
              alt="Ripplr"
              style={{ width: "70px", height: "70px", borderRadius: "24px", objectFit: "cover" }}
            />
          </div>

          {/* Headline */}
          <p style={{
            fontSize: "11px", fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(56,189,248,0.7)", marginBottom: "16px",
          }}>
            Internal Tool
          </p>
          <h1 style={{
            fontSize: "38px", fontWeight: 700, color: "#fff",
            lineHeight: 1.15, letterSpacing: "-0.03em", margin: "0 0 16px",
          }}>
            Ripplr Analytics Console
          </h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", lineHeight: 1.75, maxWidth: "340px" }}>
            Unified for Ripplr Team
          </p>
        </div>

        {/* Spacer to push footer down */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.22)", position: "relative" }}>
          Ripplr Internal Tools · Authorised access only
        </p>
      </div>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          background: "#f0f9ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 32px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "380px" }}>
          <div style={{
            background: "#ffffff",
            border: "1px solid #bae6fd",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 2px 16px rgba(29,78,216,0.08)",
          }}>
            {/* Lockup */}
            <div style={{ marginBottom: "26px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0c2340" }}>
                Ripplr Internal Tools
              </div>
              <div style={{ fontSize: "12px", color: "#0284c7", marginTop: "2px" }}>
                Analytics Dashboard
              </div>
            </div>

            <h2 style={{
              fontSize: "19px", fontWeight: 700, color: "#0c2340",
              letterSpacing: "-0.02em", margin: "0 0 4px",
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "22px" }}>
              Sign in to continue to your dashboard
            </p>

            {/* Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "16px" }}>
              <div>
                <label style={{
                  display: "block", fontSize: "11px", fontWeight: 600,
                  color: "#1e3a5f", marginBottom: "6px",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="username"
                  placeholder="Enter your username"
                  style={{
                    width: "100%", padding: "10px 13px",
                    fontSize: "13px", color: "#0c2340",
                    background: "#f0f9ff", border: "1.5px solid #bae6fd",
                    borderRadius: "9px", outline: "none",
                    boxSizing: "border-box", fontFamily: "inherit",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#1d4ed8"; e.currentTarget.style.background = "#fff"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#bae6fd"; e.currentTarget.style.background = "#f0f9ff"; }}
                />
              </div>

              <div>
                <label style={{
                  display: "block", fontSize: "11px", fontWeight: 600,
                  color: "#1e3a5f", marginBottom: "6px",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  style={{
                    width: "100%", padding: "10px 13px",
                    fontSize: "13px", color: "#0c2340",
                    background: "#f0f9ff", border: "1.5px solid #bae6fd",
                    borderRadius: "9px", outline: "none",
                    boxSizing: "border-box", fontFamily: "inherit",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#1d4ed8"; e.currentTarget.style.background = "#fff"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#bae6fd"; e.currentTarget.style.background = "#f0f9ff"; }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: "#fff1f2", border: "1px solid #fecdd3",
                borderRadius: "8px", padding: "9px 13px",
                fontSize: "12px", color: "#be123c", marginBottom: "14px",
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: "100%", padding: "11px 0",
                background: loading ? "#93c5fd" : "#1d4ed8",
                color: "#fff",
                border: "none", borderRadius: "9px",
                fontSize: "13px", fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>

            <div style={{
              marginTop: "22px", paddingTop: "18px",
              borderTop: "1px solid #e0f2fe",
              textAlign: "center", fontSize: "11px", color: "#94a3b8",
            }}>
              Access restricted to authorised Ripplr personnel
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        router.push(data.pages?.[0] ?? "/cdms");
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f1f5f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "380px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}>

        {/* Logo + brand */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "14px",
            background: "#2563eb",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
            boxShadow: "0 4px 16px rgba(37,99,235,0.35)",
          }}>
            <svg width="26" height="26" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white"/>
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.5"/>
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.5"/>
              <rect x="9" y="9" width="5" height="5" rx="1" fill="white"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: "20px", fontWeight: 800, color: "#0f172a",
            letterSpacing: "-0.03em", margin: 0,
          }}>
            Data<span style={{ color: "#2563eb" }}> Analytics</span>
          </h1>
          <p style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, marginTop: "4px" }}>
            CDMS Mapping · Bank Mapping · Sales
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#ffffff",
          border: "1.5px solid #cbd5e1",
          borderRadius: "14px",
          boxShadow: "0 4px 16px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)",
          padding: "28px 28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Sign in to your account
          </p>

          {/* Username */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{
              fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#475569",
            }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter username"
              autoComplete="username"
              style={{
                background: "#f8fafc", border: "1.5px solid #94a3b8",
                borderRadius: "8px", padding: "9px 12px",
                fontSize: "13px", fontWeight: 500, color: "#0f172a",
                outline: "none", width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{
              fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#475569",
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter password"
              autoComplete="current-password"
              style={{
                background: "#f8fafc", border: "1.5px solid #94a3b8",
                borderRadius: "8px", padding: "9px 12px",
                fontSize: "13px", fontWeight: 500, color: "#0f172a",
                outline: "none", width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "#fee2e2", border: "1.5px solid #fca5a5",
              borderRadius: "8px", padding: "8px 12px",
              fontSize: "12px", fontWeight: 600, color: "#991b1b",
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={loading || !username || !password}
            style={{
              background: loading || !username || !password ? "#93c5fd" : "#2563eb",
              color: "#fff", border: "none", borderRadius: "8px",
              padding: "10px 0", fontSize: "13px", fontWeight: 700,
              cursor: loading || !username || !password ? "not-allowed" : "pointer",
              width: "100%",
              boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>
          Internal tool · Unauthorised access is prohibited
        </p>
      </div>
    </div>
  );
}
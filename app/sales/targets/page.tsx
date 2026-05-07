// FILE PATH: app/sales/targets/page.tsx
"use client";

import { useEffect, useState } from "react";

const C = {
  cardBg: "#ffffff", cardBorder: "#cbd5e1",
  headerBg: "#1e293b", headerText: "#e2e8f0",
  sectionBg: "#f8fafc", sectionBorder: "#e2e8f0",
  rowOdd: "#ffffff", rowEven: "#f8fafc", rowHover: "#eff6ff",
  text1: "#0f172a", text2: "#1e293b", text3: "#475569", text4: "#94a3b8",
};

const card: React.CSSProperties = {
  background: C.cardBg, border: `1.5px solid ${C.cardBorder}`,
  borderRadius: "12px", boxShadow: "0 2px 6px rgba(15,23,42,0.07)", overflow: "hidden",
};

const fmt = (n: number) =>
  n === 0 ? "—" : "₹" + Math.round(n).toLocaleString("en-IN");

interface Target {
  location: string; fc: string; asm: string; brand: string;
  sales_target: number; lake_fc_code: string; lake_brd_code: string;
  mtd_target?: number;
}
interface MonthConfig {
  month: string; total_days: number; sundays: number;
  additional_holidays: number; working_days: number;
  working_days_elapsed?: number; from_date?: string; to_date?: string; notes: string;
}

export default function TargetsPage() {
  const [targets,     setTargets]     = useState<Target[]>([]);
  const [monthConfig, setMonthConfig] = useState<MonthConfig | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");

  useEffect(() => {
    fetch("/api/sales/targets")
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); }
        else { setTargets(d.targets ?? []); setMonthConfig(d.monthConfig ?? null); }
        setLoading(false);
      })
      .catch(() => { setError("Failed to load config."); setLoading(false); });
  }, []);

  const locations   = [...new Set(targets.map(t => t.location))];
  const totalTarget = targets.reduce((s, t) => s + t.sales_target, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: C.text1, letterSpacing: "-0.03em", margin: 0 }}>
            Sales Targets
          </h1>
          <p style={{ fontSize: "12px", color: C.text3, marginTop: "3px", fontWeight: 500 }}>
            Read-only · Edit <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>v_sales_config.py</code> → run <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>sales_sync.py</code> → <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>sync_to_turso.py</code>
          </p>
        </div>
        {!loading && !error && (
          <div style={{ fontSize: "12px", fontWeight: 700, color: C.text2, background: "#e2e8f0", padding: "4px 14px", borderRadius: "99px" }}>
            {targets.length} rows · Total {fmt(totalTarget)}
          </div>
        )}
      </div>

      {/* Month config card */}
      {monthConfig && (
        <div style={{ ...card, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text3 }}>
              Active Month Config
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", padding: "2px 10px", borderRadius: "99px" }}>
              {monthConfig.month}
            </span>
            {monthConfig.from_date && (
              <span style={{ fontSize: "11px", fontWeight: 600, color: C.text4 }}>
                Last synced: {monthConfig.from_date} → {monthConfig.to_date}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "32px", marginTop: "12px", flexWrap: "wrap" }}>
            {([
              ["Total Days",          monthConfig.total_days],
              ["Sundays",             monthConfig.sundays],
              ["Extra Holidays",      monthConfig.additional_holidays],
              ["Working Days",        monthConfig.working_days],
              ...(monthConfig.working_days_elapsed !== undefined
                ? [["Days Elapsed", monthConfig.working_days_elapsed]] : []),
            ] as [string, number][]).map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: C.text1, letterSpacing: "-0.03em" }}>{val}</div>
              </div>
            ))}
          </div>
          {monthConfig.notes && (
            <p style={{ fontSize: "11px", color: C.text3, fontStyle: "italic", marginTop: "10px" }}>
              {monthConfig.notes}
            </p>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: "13px" }}>Loading…</div>
      ) : error ? (
        <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: "10px", padding: "14px 18px", fontSize: "13px", fontWeight: 600, color: "#991b1b" }}>
          {error}
        </div>
      ) : (
        <div style={card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
              <thead>
                <tr>
                  {["Location", "FC", "ASM", "Brand", "Lake FC", "Lake Brand", "Sales Target", "MTD Target"].map((h, i) => (
                    <th key={h} style={{
                      background: C.headerBg, color: C.headerText,
                      fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                      textAlign: i >= 6 ? "right" : "left",
                      padding: "9px 14px", whiteSpace: "nowrap",
                      position: "sticky", top: 0, zIndex: 10,
                      borderBottom: "2px solid #0f172a",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {locations.map(loc => {
                  const locRows = targets.filter(t => t.location === loc);
                  return locRows.map((t, i) => {
                    const bg = i % 2 === 0 ? C.rowOdd : C.rowEven;
                    return (
                      <tr key={`${t.fc}-${t.brand}`}
                        style={{ background: bg, borderBottom: `1px solid ${C.sectionBorder}`, transition: "background 0.1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = bg)}
                      >
                        <td style={{ padding: "7px 14px", fontSize: "12px", fontWeight: i === 0 ? 700 : 400, color: i === 0 ? C.text1 : "transparent" }}>
                          {i === 0 ? loc : loc /* keep for copy-paste, just hide visually */}
                        </td>
                        <td style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 500, color: C.text2 }}>{t.fc}</td>
                        <td style={{ padding: "7px 14px", fontSize: "12px", color: C.text3 }}>{t.asm}</td>
                        <td style={{ padding: "7px 14px", fontSize: "12px", color: C.text2 }}>{t.brand}</td>
                        <td style={{ padding: "7px 14px", fontSize: "11px", fontWeight: 600, color: C.text4, fontFamily: "monospace" }}>{t.lake_fc_code}</td>
                        <td style={{ padding: "7px 14px", fontSize: "11px", fontWeight: 600, color: C.text4, fontFamily: "monospace" }}>{t.lake_brd_code}</td>
                        <td style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 700, color: t.sales_target === 0 ? C.text4 : C.text1, textAlign: "right" }}>
                          {fmt(t.sales_target)}
                        </td>
                        <td style={{ padding: "7px 14px", fontSize: "12px", fontWeight: 600, color: C.text3, textAlign: "right" }}>
                          {t.mtd_target !== undefined ? fmt(t.mtd_target) : "—"}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: C.sectionBg, borderTop: `2px solid ${C.cardBorder}` }}>
                  <td colSpan={6} style={{ padding: "9px 14px", fontSize: "11px", fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Grand Total
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: "13px", fontWeight: 800, color: C.text1, textAlign: "right" }}>
                    {fmt(totalTarget)}
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: "13px", fontWeight: 800, color: C.text1, textAlign: "right" }}>
                    {fmt(targets.reduce((s, t) => s + (t.mtd_target ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
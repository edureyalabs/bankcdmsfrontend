// FILE PATH: app/sales/command/BrandSummaryTable.tsx
"use client";

import { useState, useMemo, useCallback } from "react";

// ── Types (mirrored from api/sales/report/route.ts) ───────────────────────────
export interface BrandSummaryRow {
  brand:          string;
  lakeBrdCode:    string;
  salesTarget:    number;
  mtdTarget:      number;
  mtdAchieved:    number;
  achievementPct: number | null;
  difference:     number;
  diffPct:        number | null;
  status:         "On track" | "At risk" | "Critical" | "No target";
  fcCount:        number;
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  cardBg:       "#ffffff", cardBorder:   "#cbd5e1",
  headerBg:     "#1e293b", headerText:   "#e2e8f0",
  sectionBg:    "#f8fafc", sectionBorder:"#e2e8f0",
  rowOdd:       "#ffffff", rowEven:      "#f8fafc", rowHover: "#eff6ff",
  text1:        "#0f172a", text2:        "#1e293b",
  text3:        "#475569", text4:        "#94a3b8",
  green:        "#15803d", amber: "#92400e", red: "#991b1b",
};

const card: React.CSSProperties = {
  background: C.cardBg, border: `1.5px solid ${C.cardBorder}`,
  borderRadius: "12px",
  boxShadow: "0 2px 6px rgba(15,23,42,0.07), 0 8px 24px rgba(15,23,42,0.04)",
  overflow: "hidden",
};

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtRaw = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtAbs = (n: number) => "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");

// ── Status styles ─────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "On track":  { color: C.green, bg: "#dcfce7", border: "#86efac" },
  "At risk":   { color: C.amber, bg: "#fef3c7", border: "#fcd34d" },
  "Critical":  { color: C.red,   bg: "#fee2e2", border: "#fca5a5" },
  "No target": { color: C.text4, bg: "#f1f5f9", border: "#cbd5e1" },
};

// ── Sort hook ─────────────────────────────────────────────────────────────────
type SortDir = "asc" | "desc" | null;

function useSort<T>(data: T[]) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const toggle = useCallback((key: keyof T) => {
    setSortKey(prev => {
      if (prev !== key) { setSortDir("desc"); return key; }
      setSortDir(d => d === "desc" ? "asc" : d === "asc" ? null : "desc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [data, sortKey, sortDir]);

  const indicator = (key: keyof T) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : sortDir === "desc" ? " ▼" : "") : "";

  return { sorted, toggle, indicator };
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ThCell({
  label, rightAlign, center, onClick, indicator,
}: { label: string; rightAlign?: boolean; center?: boolean; onClick?: () => void; indicator?: string }) {
  return (
    <th onClick={onClick} style={{
      background: C.headerBg, color: C.headerText,
      fontSize: "10px", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.06em",
      textAlign: center ? "center" : rightAlign ? "right" : "left",
      padding: "8px 12px", whiteSpace: "nowrap",
      position: "sticky", top: 0, zIndex: 10,
      borderBottom: "2px solid #0f172a",
      cursor: onClick ? "pointer" : "default",
      userSelect: "none",
    }}>
      {label}{indicator ?? ""}
    </th>
  );
}

function DiffCell({ difference, diffPct }: { difference: number; diffPct: number | null }) {
  const isPos = difference >= 0;
  return (
    <td style={{ padding: "6px 12px", textAlign: "right", background: isPos ? "#f0fdf4" : "#fef2f2" }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: isPos ? C.green : C.red }}>
        {isPos ? "▲" : "▼"} {fmtAbs(difference)}
        {diffPct !== null ? ` (${Math.abs(diffPct).toFixed(1)}%)` : ""}
      </span>
    </td>
  );
}

function ProgressBar({ pct, status }: { pct: number | null; status: string }) {
  const fill = Math.min(100, Math.max(0, pct ?? 0));
  const s    = STATUS_STYLE[status] ?? STATUS_STYLE["No target"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "120px" }}>
      <div style={{ flex: 1, height: "6px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{ width: `${fill}%`, height: "100%", background: s.color, borderRadius: "99px", transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "11px", fontWeight: 700, color: s.color, minWidth: "34px" }}>
        {pct !== null ? `${pct.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BrandSummaryTable({ rows }: { rows: BrandSummaryRow[] }) {
  // Filter out brands with no target and zero actuals — universally applied
  const activeRows = useMemo(
    () => rows.filter(r => r.salesTarget > 0 || r.mtdAchieved > 0),
    [rows]
  );

  const { sorted, toggle, indicator } = useSort(activeRows);

  // Totals computed from activeRows only
  const grandTarget   = activeRows.reduce((s, r) => s + r.salesTarget,  0);
  const grandMtdTgt   = activeRows.reduce((s, r) => s + r.mtdTarget,    0);
  const grandAchieved = activeRows.reduce((s, r) => s + r.mtdAchieved,  0);
  const grandDiff     = grandAchieved - grandMtdTgt;

  const tfootTdBase: React.CSSProperties = {
    position: "sticky", bottom: 0, zIndex: 5,
    background: C.sectionBg,
  };

  return (
    <div style={card}>
      {/* Section header */}
      <div style={{
        padding: "10px 16px", background: C.sectionBg,
        borderBottom: `1.5px solid ${C.sectionBorder}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2 }}>
          Brand Summary — MTD
        </span>
        <span style={{ fontSize: "11px", color: C.text4, fontWeight: 500 }}>
          {activeRows.length} brand{activeRows.length !== 1 ? "s" : ""} · all FCs aggregated
        </span>
      </div>

      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "400px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
          <thead>
            <tr>
              <ThCell label="Brand"        onClick={() => toggle("brand")}          indicator={indicator("brand")}          />
              <ThCell label="FCs"          onClick={() => toggle("fcCount")}        indicator={indicator("fcCount")}        center />
              <ThCell label="Sales Target" onClick={() => toggle("salesTarget")}    indicator={indicator("salesTarget")}    rightAlign />
              <ThCell label="MTD Target"   onClick={() => toggle("mtdTarget")}      indicator={indicator("mtdTarget")}      rightAlign />
              <ThCell label="MTD Achieved" onClick={() => toggle("mtdAchieved")}    indicator={indicator("mtdAchieved")}    rightAlign />
              <ThCell label="Difference"   onClick={() => toggle("difference")}     indicator={indicator("difference")}     rightAlign />
              <ThCell label="Progress"     />
              <ThCell label="Status"       onClick={() => toggle("status")}         indicator={indicator("status")}         />
            </tr>
          </thead>
          <tbody>
            {sorted.map((b, i) => {
              const bg = i % 2 === 0 ? C.rowOdd : C.rowEven;
              const ss = STATUS_STYLE[b.status] ?? STATUS_STYLE["No target"];
              return (
                <tr key={`${b.brand}::${b.lakeBrdCode}`}
                  style={{ background: bg, borderBottom: `1px solid ${C.sectionBorder}`, transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = bg)}
                >
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: C.text1 }}>{b.brand}</div>
                    <div style={{ fontSize: "10px", color: C.text4, fontFamily: "monospace", marginTop: "1px" }}>{b.lakeBrdCode}</div>
                  </td>
                  <td style={{ padding: "8px 12px", fontSize: "12px", color: C.text3, textAlign: "center" }}>{b.fcCount}</td>
                  <td style={{ padding: "8px 12px", fontSize: "12px", textAlign: "right", color: C.text3 }}>{fmtRaw(b.salesTarget)}</td>
                  <td style={{ padding: "8px 12px", fontSize: "12px", textAlign: "right", color: C.text3 }}>{fmtRaw(b.mtdTarget)}</td>
                  <td style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 700, textAlign: "right", color: C.text1 }}>{fmtRaw(b.mtdAchieved)}</td>
                  <DiffCell difference={b.difference} diffPct={b.diffPct} />
                  <td style={{ padding: "8px 12px" }}>
                    <ProgressBar pct={b.achievementPct} status={b.status} />
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      background: ss.bg, color: ss.color,
                      border: `1px solid ${ss.border}`,
                      fontSize: "10px", fontWeight: 700,
                      padding: "2px 8px", borderRadius: "99px", whiteSpace: "nowrap",
                    }}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${C.cardBorder}` }}>
              <td style={{ ...tfootTdBase, padding: "9px 12px", fontSize: "11px", fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Total
              </td>
              <td style={{ ...tfootTdBase }} />
              <td style={{ ...tfootTdBase, padding: "9px 12px", textAlign: "right", fontSize: "12px", fontWeight: 800, color: C.text1 }}>{fmtRaw(grandTarget)}</td>
              <td style={{ ...tfootTdBase, padding: "9px 12px", textAlign: "right", fontSize: "12px", fontWeight: 800, color: C.text1 }}>{fmtRaw(grandMtdTgt)}</td>
              <td style={{ ...tfootTdBase, padding: "9px 12px", textAlign: "right", fontSize: "13px", fontWeight: 800, color: C.text1 }}>{fmtRaw(grandAchieved)}</td>
              <td style={{
                ...tfootTdBase,
                padding: "9px 12px", textAlign: "right",
                background: grandDiff >= 0 ? "#f0fdf4" : "#fef2f2",
              }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: grandDiff >= 0 ? C.green : C.red }}>
                  {grandDiff >= 0 ? "▲" : "▼"} {fmtAbs(grandDiff)}
                </span>
              </td>
              <td style={{ ...tfootTdBase }} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
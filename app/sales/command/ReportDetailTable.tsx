// FILE PATH: app/sales/command/ReportDetailTable.tsx
"use client";

import { useState, useMemo, useCallback } from "react";

// ── Types (mirrored from api/sales/report/route.ts) ───────────────────────────
export interface ReportRow {
  location:    string;
  fc:          string;
  asm:         string;
  brand:       string;
  salesTarget: number;
  mtdTarget:   number;
  mtdAchieved: number;
  difference:  number;
  diffPct:     number | null;
  lakeFcCode:  string;
  lakeBrdCode: string;
}

// ── Palette (matches report page exactly) ─────────────────────────────────────
const C = {
  cardBg:       "#ffffff", cardBorder:   "#cbd5e1",
  headerBg:     "#1e293b", headerText:   "#e2e8f0",
  sectionBg:    "#f8fafc", sectionBorder:"#e2e8f0",
  rowOdd:       "#ffffff", rowEven:      "#f8fafc", rowHover: "#eff6ff",
  text1:        "#0f172a", text2:        "#1e293b",
  text3:        "#475569", text4:        "#94a3b8",
  green:        "#15803d", greenBg:      "#dcfce7", greenBorder: "#86efac",
  amber:        "#92400e", amberBg:      "#fef3c7", amberBorder: "#fcd34d",
  red:          "#991b1b", redBg:        "#fee2e2", redBorder:   "#fca5a5",
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

// ── Status helpers (same thresholds as report page) ───────────────────────────
const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "On track":  { color: C.green, bg: "#dcfce7", border: "#86efac" },
  "At risk":   { color: C.amber, bg: "#fef3c7", border: "#fcd34d" },
  "Critical":  { color: C.red,   bg: "#fee2e2", border: "#fca5a5" },
  "No target": { color: C.text4, bg: "#f1f5f9", border: "#cbd5e1" },
};

function achievementStatus(mtdAchieved: number, mtdTarget: number): string {
  if (mtdTarget === 0) return "No target";
  const pct = (mtdAchieved / mtdTarget) * 100;
  if (pct >= 90) return "On track";
  if (pct >= 70) return "At risk";
  return "Critical";
}

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
  label, rightAlign, onClick, indicator,
}: { label: string; rightAlign?: boolean; onClick?: () => void; indicator?: string }) {
  return (
    <th onClick={onClick} style={{
      background: C.headerBg, color: C.headerText,
      fontSize: "10px", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.06em",
      textAlign: rightAlign ? "right" : "left",
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
export function ReportDetailTable({
  rows, syncedAt, fromDate, toDate,
}: {
  rows:      ReportRow[];
  syncedAt:  string;
  fromDate:  string;
  toDate:    string;
}) {
  const { sorted, toggle, indicator } = useSort(rows);

  const grandTarget   = rows.reduce((s, r) => s + r.salesTarget,  0);
  const grandMtdTgt   = rows.reduce((s, r) => s + r.mtdTarget,    0);
  const grandAchieved = rows.reduce((s, r) => s + r.mtdAchieved,  0);
  const grandDiff     = grandAchieved - grandMtdTgt;

  return (
    <div style={card}>
      {/* Section header */}
      <div style={{
        padding: "10px 16px", background: C.sectionBg,
        borderBottom: `1.5px solid ${C.sectionBorder}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2 }}>
          FC · Brand Detail — MTD
        </span>
        <span style={{ fontSize: "11px", color: C.text4, fontWeight: 500 }}>
          {fromDate} → {toDate}
          {syncedAt ? `  ·  synced ${syncedAt.slice(0, 16)}` : ""}
          {"  ·  "}{rows.length} rows
        </span>
      </div>

      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "520px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "960px" }}>
          <thead>
            <tr>
              <ThCell label="Location"     onClick={() => toggle("location")}   indicator={indicator("location")}   />
              <ThCell label="FC"           onClick={() => toggle("fc")}         indicator={indicator("fc")}         />
              <ThCell label="ASM"          onClick={() => toggle("asm")}        indicator={indicator("asm")}        />
              <ThCell label="Brand"        onClick={() => toggle("brand")}      indicator={indicator("brand")}      />
              <ThCell label="Sales Target" onClick={() => toggle("salesTarget")} indicator={indicator("salesTarget")} rightAlign />
              <ThCell label="MTD Target"   onClick={() => toggle("mtdTarget")}  indicator={indicator("mtdTarget")}  rightAlign />
              <ThCell label="MTD Achieved" onClick={() => toggle("mtdAchieved")} indicator={indicator("mtdAchieved")} rightAlign />
              <ThCell label="Difference"   onClick={() => toggle("difference")} indicator={indicator("difference")} rightAlign />
              <ThCell label="Progress"     />
              <ThCell label="Status"       />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const bg     = i % 2 === 0 ? C.rowOdd : C.rowEven;
              const pct    = r.mtdTarget > 0 ? (r.mtdAchieved / r.mtdTarget) * 100 : null;
              const status = achievementStatus(r.mtdAchieved, r.mtdTarget);
              const ss     = STATUS_STYLE[status];
              return (
                <tr key={`${r.fc}::${r.brand}::${i}`}
                  style={{ background: bg, borderBottom: `1px solid ${C.sectionBorder}`, transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = bg)}
                >
                  <td style={{ padding: "7px 12px", fontSize: "12px", color: C.text3 }}>{r.location}</td>
                  <td style={{ padding: "7px 12px", fontSize: "12px", fontWeight: 600, color: C.text2, whiteSpace: "nowrap" }}>{r.fc}</td>
                  <td style={{ padding: "7px 12px", fontSize: "11px", color: C.text3, whiteSpace: "nowrap" }}>{r.asm}</td>
                  <td style={{ padding: "7px 12px", fontSize: "12px", color: C.text2 }}>{r.brand}</td>
                  <td style={{ padding: "7px 12px", fontSize: "12px", textAlign: "right", color: C.text3 }}>{fmtRaw(r.salesTarget)}</td>
                  <td style={{ padding: "7px 12px", fontSize: "12px", textAlign: "right", color: C.text3 }}>{fmtRaw(r.mtdTarget)}</td>
                  <td style={{ padding: "7px 12px", fontSize: "12px", fontWeight: 700, textAlign: "right", color: C.text1 }}>{fmtRaw(r.mtdAchieved)}</td>
                  <DiffCell difference={r.difference} diffPct={r.diffPct} />
                  <td style={{ padding: "7px 12px" }}>
                    <ProgressBar pct={pct} status={status} />
                  </td>
                  <td style={{ padding: "7px 12px" }}>
                    <span style={{
                      background: ss.bg, color: ss.color,
                      border: `1px solid ${ss.border}`,
                      fontSize: "10px", fontWeight: 700,
                      padding: "2px 8px", borderRadius: "99px", whiteSpace: "nowrap",
                    }}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: C.sectionBg, borderTop: `2px solid ${C.cardBorder}` }}>
              <td colSpan={4} style={{ padding: "9px 12px", fontSize: "11px", fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Grand Total
              </td>
              <td style={{ padding: "9px 12px", textAlign: "right", fontSize: "12px", fontWeight: 800, color: C.text1 }}>{fmtRaw(grandTarget)}</td>
              <td style={{ padding: "9px 12px", textAlign: "right", fontSize: "12px", fontWeight: 800, color: C.text1 }}>{fmtRaw(grandMtdTgt)}</td>
              <td style={{ padding: "9px 12px", textAlign: "right", fontSize: "13px", fontWeight: 800, color: C.text1 }}>{fmtRaw(grandAchieved)}</td>
              <td style={{
                padding: "9px 12px", textAlign: "right",
                background: grandDiff >= 0 ? "#f0fdf4" : "#fef2f2",
              }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: grandDiff >= 0 ? C.green : C.red }}>
                  {grandDiff >= 0 ? "▲" : "▼"} {fmtAbs(grandDiff)}
                </span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
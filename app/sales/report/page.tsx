// FILE PATH: app/sales/report/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { ReportRow, ReportResponse, BrandSummaryRow } from "@/app/api/sales/report/route";

// ── COLOURS ──────────────────────────────────────────────────────────────────
const C = {
  cardBg: "#ffffff", cardBorder: "#cbd5e1",
  headerBg: "#1e293b", headerText: "#e2e8f0",
  sectionBg: "#f8fafc", sectionBorder: "#e2e8f0",
  rowOdd: "#ffffff", rowEven: "#f8fafc", rowHover: "#eff6ff",
  text1: "#0f172a", text2: "#1e293b", text3: "#475569", text4: "#94a3b8",
  blue: "#2563eb", red: "#991b1b", redBg: "#fef2f2",
  green: "#15803d", greenBg: "#f0fdf4",
  amber: "#92400e", amberBg: "#fffbeb",
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "On track":  { color: C.green,  bg: "#dcfce7", border: "#86efac" },
  "At risk":   { color: C.amber,  bg: "#fef3c7", border: "#fcd34d" },
  "Critical":  { color: C.red,    bg: "#fee2e2", border: "#fca5a5" },
  "No target": { color: C.text4,  bg: "#f1f5f9", border: "#cbd5e1" },
};

const PIE_COLORS = [
  "#2563eb","#dc2626","#16a34a","#d97706","#7c3aed",
  "#0891b2","#be185d","#84cc16","#ea580c","#6366f1",
  "#0d9488","#f43f5e","#3b82f6","#a16207","#10b981",
  "#8b5cf6","#ef4444","#06b6d4","#f97316","#14b8a6",
  "#ec4899","#22c55e","#6d28d9","#fb923c",
];

const card: React.CSSProperties = {
  background: C.cardBg, border: `1.5px solid ${C.cardBorder}`,
  borderRadius: "12px", boxShadow: "0 2px 6px rgba(15,23,42,0.07)", overflow: "hidden",
};

const fmtRaw = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtAbs = (n: number) => "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");
const fmtL   = (n: number) => {
  if (Math.abs(n) >= 10000000) return "₹" + (n / 10000000).toFixed(1) + "Cr";
  if (Math.abs(n) >= 100000)   return "₹" + (n / 100000).toFixed(1) + "L";
  return "₹" + Math.round(n).toLocaleString("en-IN");
};

// ── SORT HOOK ─────────────────────────────────────────────────────────────────
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

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────
function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{
      padding: "10px 16px", background: C.sectionBg,
      borderBottom: `1.5px solid ${C.sectionBorder}`,
      display: "flex", alignItems: "center", gap: "10px",
    }}>
      <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2 }}>
        {title}
      </span>
      {badge && (
        <span style={{ fontSize: "11px", fontWeight: 600, color: C.text2, background: "#e2e8f0", padding: "2px 9px", borderRadius: "99px" }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function ThCell({
  label, rightAlign, onClick, indicator,
}: { label: string; rightAlign?: boolean; onClick?: () => void; indicator?: string }) {
  return (
    <th
      onClick={onClick}
      style={{
        background: C.headerBg, color: C.headerText,
        fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
        textAlign: rightAlign ? "right" : "left",
        padding: "8px 12px", whiteSpace: "nowrap",
        position: "sticky", top: 0, zIndex: 10,
        borderBottom: "2px solid #0f172a",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {label}{indicator ?? ""}
    </th>
  );
}

function DiffCell({ difference, diffPct }: { difference: number; diffPct: number | null }) {
  const isPos = difference >= 0;
  return (
    <td style={{ padding: "6px 12px", textAlign: "right", background: isPos ? C.greenBg : C.redBg }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: isPos ? C.green : C.red }}>
        {isPos ? "▲" : "▼"} {fmtAbs(difference)}
        {diffPct !== null ? ` (${Math.abs(diffPct).toFixed(1)}%)` : ""}
      </span>
    </td>
  );
}

const selectStyle: React.CSSProperties = {
  background: "#f8fafc", border: "1.5px solid #94a3b8", borderRadius: "7px",
  padding: "6px 26px 6px 9px", fontSize: "12px", color: C.text1,
  outline: "none", cursor: "pointer", appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 7px center",
};

const inputStyle: React.CSSProperties = {
  background: "#f8fafc", border: "1.5px solid #94a3b8", borderRadius: "7px",
  padding: "6px 9px", fontSize: "12px", color: C.text1, outline: "none",
};

// ── PROGRESS BAR ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, status }: { pct: number | null; status: string }) {
  const fill = Math.min(100, Math.max(0, pct ?? 0));
  const s    = STATUS_STYLE[status] ?? STATUS_STYLE["No target"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "120px" }}>
      <div style={{
        flex: 1, height: "6px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden",
      }}>
        <div style={{
          width: `${fill}%`, height: "100%",
          background: s.color, borderRadius: "99px", transition: "width 0.3s",
        }} />
      </div>
      <span style={{ fontSize: "11px", fontWeight: 700, color: s.color, minWidth: "34px" }}>
        {pct !== null ? `${pct.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}

// ── CSV DOWNLOAD ──────────────────────────────────────────────────────────────
function downloadCSV(rows: ReportRow[], fromDate: string, toDate: string) {
  const headers = ["Location","FC","ASM","Brand","Sales Target","MTD Target","MTD Achieved","Difference","Diff %"];
  const lines   = [headers.join(","), ...rows.map(r => [
    r.location, r.fc, r.asm, r.brand,
    r.salesTarget, r.mtdTarget, r.mtdAchieved, r.difference,
    r.diffPct !== null ? r.diffPct.toFixed(2) : "",
  ].join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `mtd_${fromDate}_${toDate}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── HISTORY TYPES ─────────────────────────────────────────────────────────────
interface HistoryRow { bill_date: string; fc_code: string; brand_code: string; total_sum: number; }
interface HistoryResponse {
  rows: HistoryRow[];
  filter_opts: { fc: string[]; brand: string[]; min_date: string; max_date: string; };
  error?: string;
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ReportPage() {
  // MTD report data
  const [result,    setResult]    = useState<ReportResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // MTD filters
  const [filterLoc, setFilterLoc] = useState("All");
  const [filterAsm, setFilterAsm] = useState("All");

  // History data
  const [history,      setHistory]      = useState<HistoryRow[]>([]);
  const [historyMeta,  setHistoryMeta]  = useState<{ fc: string[]; brand: string[]; min_date: string; max_date: string } | null>(null);
  const [histLoading,  setHistLoading]  = useState(false);
  const [histError,    setHistError]    = useState("");

  // History filters
  const [histFrom,   setHistFrom]   = useState("");
  const [histTo,     setHistTo]     = useState("");
  const [histFc,     setHistFc]     = useState("All");
  const [histBrand,  setHistBrand]  = useState("All");

  // Load MTD report
  useEffect(() => {
    fetch("/api/sales/report")
      .then(r => r.json())
      .then((d: ReportResponse) => {
        if (d.error) setError(d.error); else setResult(d);
        setLoading(false);
      })
      .catch(() => { setError("Network error."); setLoading(false); });
  }, []);

  // Load history meta on mount
  useEffect(() => {
    fetch("/api/sales/history?dateFrom=2000-01-01&dateTo=2099-12-31")
      .then(r => r.json())
      .then((d: HistoryResponse) => {
        if (d.filter_opts) {
          setHistoryMeta(d.filter_opts);
          setHistFrom(d.filter_opts.min_date || "");
          setHistTo(d.filter_opts.max_date   || "");
        }
      })
      .catch(() => {});
  }, []);

  // Fetch history when filters applied
  const fetchHistory = useCallback(() => {
    setHistLoading(true); setHistError("");
    const qs = new URLSearchParams();
    if (histFrom)              qs.set("dateFrom", histFrom);
    if (histTo)                qs.set("dateTo",   histTo);
    if (histFc    !== "All")   qs.append("fc",    histFc);
    if (histBrand !== "All")   qs.append("brand", histBrand);

    fetch("/api/sales/history?" + qs.toString())
      .then(r => r.json())
      .then((d: HistoryResponse) => {
        if (d.error) setHistError(d.error); else setHistory(d.rows ?? []);
        setHistLoading(false);
      })
      .catch(() => { setHistError("Failed to load history."); setHistLoading(false); });
  }, [histFrom, histTo, histFc, histBrand]);

  useEffect(() => {
    if (historyMeta) fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyMeta]);

  // ── MTD derived data ───────────────────────────────────────────────────────
  const locations = result ? ["All", ...new Set(result.rows.map(r => r.location))] : ["All"];
  const asms      = result
    ? ["All", ...new Set(result.rows.filter(r => filterLoc === "All" || r.location === filterLoc).map(r => r.asm))]
    : ["All"];

  const visibleRows = (result?.rows ?? []).filter(r =>
    (filterLoc === "All" || r.location === filterLoc) &&
    (filterAsm === "All" || r.asm === filterAsm) &&
    (r.salesTarget > 0 || r.mtdAchieved > 0)  // exclude rows where both target and achieved are 0
  );

  const totalMtdTarget   = visibleRows.reduce((s, r) => s + r.mtdTarget,   0);
  const totalMtdAchieved = visibleRows.reduce((s, r) => s + r.mtdAchieved, 0);
  const totalDiff        = totalMtdAchieved - totalMtdTarget;
  const totalDiffPct     = totalMtdTarget !== 0 ? (totalDiff / totalMtdTarget) * 100 : null;

  // ── Sort hooks ─────────────────────────────────────────────────────────────
  const brandSort  = useSort<BrandSummaryRow>(
    (result?.brandSummary ?? []).filter(b => b.salesTarget > 0 || b.mtdAchieved > 0)
  );
  const detailSort = useSort<ReportRow>(visibleRows);

  // ── History chart data ─────────────────────────────────────────────────────

  // Line chart: daily totals grouped by month, series per brand (or fc)
  const lineData = useMemo(() => {
    const byMonth = new Map<string, Map<string, number>>();
    const keys    = new Set<string>();
    for (const r of history) {
      const month = r.bill_date.slice(0, 7);
      const key   = histBrand !== "All" ? r.fc_code : r.brand_code;
      keys.add(key);
      if (!byMonth.has(month)) byMonth.set(month, new Map());
      const m = byMonth.get(month)!;
      m.set(key, (m.get(key) ?? 0) + Number(r.total_sum));
    }
    const months = [...byMonth.keys()].sort();
    return {
      data:   months.map(month => {
        const m = byMonth.get(month)!;
        const obj: Record<string, unknown> = { month };
        for (const k of keys) obj[k] = Math.round(m.get(k) ?? 0);
        return obj;
      }),
      series: [...keys].slice(0, 8), // cap at 8 lines for readability
    };
  }, [history, histBrand]);

  // Pie charts: brand and FC computed independently, always both shown
  const brandPieData = useMemo(() => {
    const agg = new Map<string, number>();
    for (const r of history) {
      agg.set(r.brand_code, (agg.get(r.brand_code) ?? 0) + Number(r.total_sum));
    }
    return [...agg.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [history]);

  const fcPieData = useMemo(() => {
    const agg = new Map<string, number>();
    for (const r of history) {
      agg.set(r.fc_code, (agg.get(r.fc_code) ?? 0) + Number(r.total_sum));
    }
    return [...agg.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [history]);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ textAlign: "center", padding: "80px 0", color: C.text3, fontSize: "13px" }}>Loading…</div>;
  }
  if (error) {
    return (
      <div style={{ background: C.redBg, border: "1.5px solid #fca5a5", borderRadius: "10px", padding: "14px 18px", fontSize: "13px", fontWeight: 600, color: C.red }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: C.text1, letterSpacing: "-0.03em", margin: 0 }}>
            MTD Sales Report
          </h1>

        </div>
        {result && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", padding: "3px 10px", borderRadius: "99px" }}>
              {result.fromDate} → {result.toDate}
            </span>
            <span style={{ fontSize: "10px", color: C.text4 }}>
              {result.workingDaysElapsed} / {result.workingDaysInMonth} working days
            </span>
          </div>
        )}
      </div>

      {/* ══ SECTION 1A — Brand Performance ══════════════════════════════════ */}
      {result && (
        <div style={card}>
          <SectionHeader title="Brand Performance vs Target" badge={`${result.brandSummary.length} brands`} />
          <div style={{ overflowX: "auto", maxHeight: "320px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead>
                <tr>
                  {(["brand","fcCount","salesTarget","mtdTarget","mtdAchieved","achievementPct","difference","status"] as (keyof BrandSummaryRow)[]).map((k, i) => {
                    const labels: Record<string, string> = {
                      brand: "Brand", fcCount: "FCs", salesTarget: "Full Target",
                      mtdTarget: "MTD Target", mtdAchieved: "Achieved",
                      achievementPct: "Achievement", difference: "Difference", status: "Status",
                    };
                    return (
                      <ThCell key={k} label={labels[k]} rightAlign={i > 1 && k !== "status" && k !== "achievementPct"}
                        onClick={() => brandSort.toggle(k)}
                        indicator={brandSort.indicator(k)} />
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {brandSort.sorted.map((b, i) => {
                  const bg = i % 2 === 0 ? C.rowOdd : C.rowEven;
                  const s  = STATUS_STYLE[b.status] ?? STATUS_STYLE["No target"];
                  return (
                    <tr key={b.brand}
                      style={{ background: bg, borderBottom: `1px solid ${C.sectionBorder}`, transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = bg)}
                    >
                      <td style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 700, color: C.text1 }}>
                        <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: s.color, marginRight: "7px" }} />
                        {b.brand}
                      </td>
                      <td style={{ padding: "6px 12px", fontSize: "11px", color: C.text4, textAlign: "right" }}>{b.fcCount}</td>
                      <td style={{ padding: "6px 12px", fontSize: "11px", color: C.text4, textAlign: "right" }}>{b.salesTarget ? fmtL(b.salesTarget) : "—"}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: C.text2, textAlign: "right" }}>{b.mtdTarget ? fmtL(b.mtdTarget) : "—"}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 700, color: C.text1, textAlign: "right" }}>{b.mtdAchieved ? fmtL(b.mtdAchieved) : "—"}</td>
                      <td style={{ padding: "6px 12px", minWidth: "160px" }}>
                        <ProgressBar pct={b.achievementPct} status={b.status} />
                      </td>
                      <DiffCell difference={b.difference} diffPct={b.diffPct} />
                      <td style={{ padding: "6px 12px" }}>
                        <span style={{
                          fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px",
                          background: s.bg, color: s.color, border: `1.5px solid ${s.border}`,
                          whiteSpace: "nowrap",
                        }}>{b.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ SECTION 1B — MTD Detail Table ═══════════════════════════════════ */}
      {result && (
        <div style={card}>
          {/* Toolbar */}
          <div style={{
            padding: "10px 16px", background: C.sectionBg,
            borderBottom: `1.5px solid ${C.sectionBorder}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2 }}>
                MTD Detail
              </span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: C.text2, background: "#e2e8f0", padding: "2px 9px", borderRadius: "99px" }}>
                {visibleRows.length} rows
              </span>
              {/* Filters inline */}
              <select value={filterLoc} onChange={e => { setFilterLoc(e.target.value); setFilterAsm("All"); }} style={selectStyle}>
                {locations.map(l => <option key={l}>{l}</option>)}
              </select>
              <select value={filterAsm} onChange={e => setFilterAsm(e.target.value)} style={selectStyle}>
                {asms.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <button
              onClick={() => downloadCSV(visibleRows, result.fromDate, result.toDate)}
              style={{ background: "#1e293b", color: "#e2e8f0", border: "none", borderRadius: "7px", padding: "6px 14px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
            >↓ CSV</button>
          </div>

          {/* Summary strip */}
          <div style={{ display: "flex", gap: "24px", padding: "10px 16px", background: C.sectionBg, borderBottom: `1px solid ${C.sectionBorder}`, flexWrap: "wrap" }}>
            {[
              { label: "MTD Target",   val: fmtRaw(totalMtdTarget),   color: C.text1 },
              { label: "MTD Achieved", val: fmtRaw(totalMtdAchieved), color: C.text1 },
              {
                label: "Difference",
                val: (totalDiff >= 0 ? "▲ " : "▼ ") + fmtAbs(totalDiff) +
                     (totalDiffPct !== null ? ` (${Math.abs(totalDiffPct).toFixed(1)}%)` : ""),
                color: totalDiff >= 0 ? C.green : C.red,
              },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: "9px", fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: item.color }}>{item.val}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", maxHeight: "520px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "860px" }}>
              <thead>
                <tr>
                  {(["location","fc","asm","brand","salesTarget","mtdTarget","mtdAchieved","difference"] as (keyof ReportRow)[]).map((k, i) => {
                    const labels: Record<string, string> = {
                      location: "Location", fc: "FC", asm: "ASM", brand: "Brand",
                      salesTarget: "Full Target", mtdTarget: "MTD Target",
                      mtdAchieved: "Achieved", difference: "Difference",
                    };
                    return (
                      <ThCell key={k} label={labels[k]} rightAlign={i >= 4}
                        onClick={() => detailSort.toggle(k)}
                        indicator={detailSort.indicator(k)} />
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {detailSort.sorted.map((r, i) => {
                  const bg = i % 2 === 0 ? C.rowOdd : C.rowEven;
                  return (
                    <tr key={i}
                      style={{ background: bg, borderBottom: `1px solid ${C.sectionBorder}`, transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = bg)}
                    >
                      <td style={{ padding: "6px 12px", fontSize: "11px", color: C.text3 }}>{r.location}</td>
                      <td style={{ padding: "6px 12px", fontSize: "11px", fontWeight: 600, color: C.text2 }}>{r.fc}</td>
                      <td style={{ padding: "6px 12px", fontSize: "11px", color: C.text3 }}>{r.asm}</td>
                      <td style={{ padding: "6px 12px", fontSize: "11px", color: C.text2 }}>{r.brand}</td>
                      <td style={{ padding: "6px 12px", fontSize: "11px", color: C.text4, textAlign: "right" }}>{r.salesTarget ? fmtL(r.salesTarget) : "—"}</td>
                      <td style={{ padding: "6px 12px", fontSize: "11px", color: C.text2, textAlign: "right" }}>{r.mtdTarget ? fmtL(r.mtdTarget) : "—"}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 700, color: C.text1, textAlign: "right" }}>{r.mtdAchieved ? fmtL(r.mtdAchieved) : "—"}</td>
                      <DiffCell difference={r.difference} diffPct={r.diffPct} />
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: C.sectionBg, borderTop: `2px solid ${C.cardBorder}` }}>
                  <td colSpan={4} style={{ padding: "7px 12px", fontSize: "10px", fontWeight: 700, color: C.text3, textTransform: "uppercase" }}>Totals</td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontSize: "12px", fontWeight: 800, color: C.text4 }}>—</td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontSize: "12px", fontWeight: 800, color: C.text1 }}>{fmtRaw(totalMtdTarget)}</td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontSize: "12px", fontWeight: 800, color: C.text1 }}>{fmtRaw(totalMtdAchieved)}</td>
                  <DiffCell difference={totalDiff} diffPct={totalDiffPct} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ══ SECTION 2 — Historical Charts ═══════════════════════════════════ */}
      {/* Divider between tables and charts */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
        <div style={{ flex: 1, height: "2px", background: "linear-gradient(to right, #e2e8f0, #cbd5e1)" }} />
        <span style={{ fontSize: "10px", fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
          Historical Analytics
        </span>
        <div style={{ flex: 1, height: "2px", background: "linear-gradient(to left, #e2e8f0, #cbd5e1)" }} />
      </div>
      <div style={card}>
        <div style={{
          padding: "10px 16px", background: C.sectionBg,
          borderBottom: `1.5px solid ${C.sectionBorder}`,
          display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: "10px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <input type="date" value={histFrom} onChange={e => setHistFrom(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: "11px", color: C.text4 }}>to</span>
            <input type="date" value={histTo}   onChange={e => setHistTo(e.target.value)}   style={inputStyle} />
            <select value={histFc}    onChange={e => setHistFc(e.target.value)}    style={selectStyle}>
              <option>All</option>
              {(historyMeta?.fc ?? []).map(f => <option key={f}>{f}</option>)}
            </select>
            <select value={histBrand} onChange={e => setHistBrand(e.target.value)} style={selectStyle}>
              <option>All</option>
              {(historyMeta?.brand ?? []).map(b => <option key={b}>{b}</option>)}
            </select>
            <button
              onClick={fetchHistory}
              style={{ background: C.blue, color: "#fff", border: "none", borderRadius: "7px", padding: "6px 14px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
            >Apply</button>
          </div>
        </div>

        {histError && (
          <div style={{ padding: "12px 16px", fontSize: "12px", color: C.red, fontWeight: 600 }}>{histError}</div>
        )}

        {histLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0", fontSize: "13px", color: C.text3 }}>Loading history…</div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", fontSize: "12px", color: C.text4 }}>
            No history data. Run <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>sales_history_sync.py</code> first.
          </div>
        ) : (
          <div style={{ padding: "16px 20px 20px" }}>

            {/* ── Line chart — full width, tall ── */}
            <div style={{ fontSize: "11px", fontWeight: 700, color: C.text3, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Monthly Sales Trend {histBrand !== "All" ? `· ${histBrand} by FC` : "· by Brand"}
            </div>
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={lineData.data} margin={{ top: 8, right: 32, bottom: 8, left: 8 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tickFormatter={v => fmtL(v)} tick={{ fontSize: 11 }} width={72} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: unknown) => fmtRaw(Number(v))} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: "11px", paddingTop: "16px" }} iconType="circle" />
                {lineData.series.map((s, i) => (
                  <Line key={s} type="monotone" dataKey={s}
                    stroke={PIE_COLORS[i % PIE_COLORS.length]}
                    strokeWidth={2}
                    strokeDasharray={
                      i === 0 ? undefined :
                      i === 1 ? undefined :
                      i === 2 ? "6 2" :
                      i === 3 ? "3 3" :
                      i === 4 ? "8 3 2 3" :
                      i === 5 ? "4 2 1 2" :
                      i === 6 ? "10 3" :
                      "2 2"
                    }
                    dot={{ r: 3 }} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ══ SECTION 2B — Revenue Share (separate card, same filters) ════════ */}
      {history.length > 0 && (
        <div style={card}>
          <div style={{
            padding: "10px 16px", background: C.sectionBg,
            borderBottom: `1.5px solid ${C.sectionBorder}`,
            display: "flex", alignItems: "center",
          }}>
            <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2 }}>
              Revenue Share
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>

            {/* ── Left: Brand pie ── */}
            {[
              { label: "By Brand", data: brandPieData },
              { label: "By FC",    data: fcPieData    },
            ].map(({ label, data }, panelIdx) => {
              const total = data.reduce((s, d) => s + d.value, 0);
              // Each panel uses its own offset into PIE_COLORS so colors never clash
              const colorOffset = panelIdx * 12;
              return (
                <div
                  key={label}
                  style={{
                    padding: "20px 24px",
                    borderRight: panelIdx === 0 ? `1.5px solid ${C.sectionBorder}` : "none",
                  }}
                >
                  {/* Panel title */}
                  <div style={{ fontSize: "11px", fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
                    {label}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                    {/* Donut */}
                    <div style={{ flexShrink: 0 }}>
                      <ResponsiveContainer width={260} height={260}>
                        <PieChart>
                          <Pie data={data} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" innerRadius={70} outerRadius={115} paddingAngle={2}
                          >
                            {data.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[(colorOffset + i) % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: unknown) => fmtRaw(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    <div style={{ flex: 1 }}>
                      {/* Header */}
                      <div style={{ display: "flex", gap: "8px", paddingBottom: "6px", borderBottom: `1px solid ${C.sectionBorder}`, marginBottom: "7px" }}>
                        <div style={{ flex: 1, fontSize: "9px", fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</div>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: "0.08em", minWidth: "60px", textAlign: "right" }}>Revenue</div>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: "0.08em", minWidth: "36px", textAlign: "right" }}>%</div>
                      </div>
                      {/* Rows */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
                        {data.map((item, i) => {
                          const pct = total > 0 ? (item.value / total) * 100 : 0;
                          const col = PIE_COLORS[(colorOffset + i) % PIE_COLORS.length];
                          return (
                            <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: col }} />
                              <div style={{ flex: 1, fontSize: "11px", color: C.text2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.name}
                              </div>
                              {/* Mini bar */}
                              <div style={{ width: "50px", height: "4px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden", flexShrink: 0 }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: "99px" }} />
                              </div>
                              <div style={{ fontSize: "11px", color: C.text2, fontWeight: 600, minWidth: "60px", textAlign: "right", whiteSpace: "nowrap" }}>
                                {fmtL(item.value)}
                              </div>
                              <div style={{ fontSize: "10px", color: C.text4, fontWeight: 700, minWidth: "36px", textAlign: "right" }}>
                                {pct.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      )}

      {/* Bottom spacer so charts aren't flush against viewport bottom */}
      <div style={{ height: "60px" }} />

    </div>
  );
}
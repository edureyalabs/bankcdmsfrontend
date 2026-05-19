// FILE PATH: app/sales/salesman/page.tsx  — REPLACE EXISTING
"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:           "#f1f5f9",
  cardBg:       "#ffffff",
  cardBorder:   "#cbd5e1",
  headerBg:     "#1e293b",
  headerText:   "#e2e8f0",
  sectionBg:    "#f8fafc",
  sectionBorder:"#e2e8f0",
  rowOdd:       "#ffffff",
  rowEven:      "#f8fafc",
  rowHover:     "#eff6ff",
  text1:        "#0f172a",
  text2:        "#1e293b",
  text3:        "#475569",
  text4:        "#94a3b8",
  blue:         "#2563eb",
  green:        "#16a34a",
  greenBg:      "#dcfce7",
  greenBorder:  "#86efac",
  yellow:       "#92400e",
  yellowBg:     "#fef3c7",
  yellowBorder: "#fcd34d",
  red:          "#991b1b",
  redBg:        "#fee2e2",
  redBorder:    "#fca5a5",
};

type Trend = "green" | "yellow" | "red" | "none";

const TREND_CFG: Record<Trend, { color: string; bg: string; border: string; label: string }> = {
  green:  { color: C.green,  bg: C.greenBg,  border: C.greenBorder,  label: "On Track" },
  yellow: { color: C.yellow, bg: C.yellowBg, border: C.yellowBorder, label: "At Risk"  },
  red:    { color: C.red,    bg: C.redBg,    border: C.redBorder,    label: "Critical" },
  none:   { color: C.text4,  bg: "#f1f5f9",  border: C.cardBorder,   label: "No Data"  },
};

const DOT_COLOR: Record<Trend, string> = {
  green:  "#16a34a",
  yellow: "#d97706",
  red:    "#dc2626",
  none:   "#cbd5e1",
};

// ── Shared card style ─────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background:   C.cardBg,
  border:       `1.5px solid ${C.cardBorder}`,
  borderRadius: "12px",
  boxShadow:    "0 2px 6px rgba(15,23,42,0.07)",
  overflow:     "hidden",
};

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) =>
  n === 0 ? "—" : "₹" + Math.round(n).toLocaleString("en-IN");

const fmtShort = (n: number): string => {
  if (n === 0)           return "—";
  if (n >= 10_000_000)   return "₹" + (n / 10_000_000).toFixed(1) + "Cr";
  if (n >= 100_000)      return "₹" + (n / 100_000).toFixed(1)    + "L";
  return "₹" + Math.round(n).toLocaleString("en-IN");
};

const fmtPct = (n: number | null) =>
  n === null ? "—" : (n >= 0 ? "+" : "") + n.toFixed(1) + "%";

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const name = ["Jan","Feb","Mar","Apr","May","Jun",
                 "Jul","Aug","Sep","Oct","Nov","Dec"][Number(mo) - 1];
  return `${name} ${y}`;
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReportRow {
  salesman_code:  string;
  salesman_name:  string;
  fc_code:        string;
  brand_code:     string;
  fc_name:        string;
  brand_name:     string;
  city:           string;
  mtd_achieved:   number;
  mtd_target:     number;
  mtd_vs_target:  number | null;
  avg_monthly:    number;
  monthly_values: Record<string, number>;
  monthly_bills:  Record<string, number>;
  monthly_outlets:Record<string, number>;
  dot_colors:     Record<string, Trend>;
  trend:          Trend;
  cur_bills:      number;
  cur_outlets:    number;
  cur_sku_count:  number;
}

interface FilterOpts { brands: string[]; fcs: string[]; salesmen: string[]; }

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({
  months, values, dotColors, trend, currentMonth,
}: {
  months:        string[];
  values:        Record<string, number>;
  dotColors:     Record<string, Trend>;
  trend:         Trend;
  currentMonth:  string;
}) {
  const W = 96, H = 32, PAD = 4;
  const pts = months.map(m => values[m] ?? 0);
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts.filter(v => v > 0), 0);
  const range = max - min || 1;

  const lineColor = DOT_COLOR[trend] ?? DOT_COLOR.none;

  const coords = pts.map((v, i) => ({
    x: PAD + (i / Math.max(months.length - 1, 1)) * (W - PAD * 2),
    y: H - PAD - ((v - min) / range) * (H - PAD * 2),
    trend: dotColors[months[i]] ?? "none",
    isCurrent: months[i] === currentMonth,
  }));

  const pathD = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={W} height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Connecting line */}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Dots */}
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x} cy={c.y}
          r={c.isCurrent ? 4 : 2.5}
          fill={DOT_COLOR[c.trend]}
          stroke="white"
          strokeWidth={c.isCurrent ? 1.5 : 1}
        />
      ))}
    </svg>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────
function Pill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:      "3px 11px",
        borderRadius: "99px",
        border:       `1.5px solid ${active ? C.blue : C.cardBorder}`,
        background:   active ? "#dbeafe" : C.cardBg,
        color:        active ? C.blue : C.text3,
        fontSize:     "11px", fontWeight: active ? 700 : 500,
        cursor:       "pointer", whiteSpace: "nowrap",
        transition:   "all 0.1s",
      }}
    >
      {label}
    </button>
  );
}

// ── Combobox dropdown filter ──────────────────────────────────────────────────
function ComboFilter({
  label, options, selected, onToggle, onClear,
}: {
  label:    string;
  options:  string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear:  () => void;
}) {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState("");
  const ref               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding:      "5px 12px",
          borderRadius: "8px",
          border:       `1.5px solid ${selected.length ? C.blue : C.cardBorder}`,
          background:   selected.length ? "#dbeafe" : C.cardBg,
          color:        selected.length ? C.blue : C.text3,
          fontSize:     "12px", fontWeight: 600,
          cursor:       "pointer", whiteSpace: "nowrap",
          display:      "flex", alignItems: "center", gap: "6px",
        }}
      >
        {label}
        {selected.length > 0 && (
          <span style={{
            background: C.blue, color: "#fff",
            borderRadius: "99px", fontSize: "10px", fontWeight: 800,
            padding: "1px 6px",
          }}>
            {selected.length}
          </span>
        )}
        <span style={{ fontSize: "10px", opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position:    "absolute",
          top:         "calc(100% + 6px)",
          left:        0,
          zIndex:      999,
          background:  C.cardBg,
          border:      `1.5px solid ${C.cardBorder}`,
          borderRadius:"10px",
          boxShadow:   "0 8px 24px rgba(15,23,42,0.12)",
          minWidth:    "220px",
          maxHeight:   "280px",
          display:     "flex",
          flexDirection:"column",
          overflow:    "hidden",
        }}>
          <div style={{ padding: "8px" }}>
            <input
              autoFocus
              placeholder={`Search ${label}…`}
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{
                width: "100%", padding: "5px 9px",
                border: `1.5px solid ${C.cardBorder}`,
                borderRadius: "6px", fontSize: "12px",
                background: C.sectionBg, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {selected.length > 0 && (
              <button
                onClick={() => { onClear(); setOpen(false); setQ(""); }}
                style={{
                  width: "100%", padding: "6px 12px", textAlign: "left",
                  background: "#fef2f2", color: C.red,
                  border: "none", borderBottom: `1px solid ${C.sectionBorder}`,
                  fontSize: "11px", fontWeight: 700, cursor: "pointer",
                }}
              >
                ✕ Clear all ({selected.length})
              </button>
            )}
            {filtered.map(opt => (
              <button
                key={opt}
                onClick={() => onToggle(opt)}
                style={{
                  width:      "100%",
                  padding:    "7px 12px",
                  textAlign:  "left",
                  background: selected.includes(opt) ? "#eff6ff" : "transparent",
                  color:      selected.includes(opt) ? C.blue : C.text2,
                  border:     "none",
                  borderBottom: `1px solid ${C.sectionBorder}`,
                  fontSize:   "12px",
                  fontWeight: selected.includes(opt) ? 700 : 400,
                  cursor:     "pointer",
                  display:    "flex",
                  alignItems: "center",
                  gap:        "8px",
                }}
              >
                <span style={{
                  width: "14px", height: "14px", borderRadius: "3px", flexShrink: 0,
                  border: `1.5px solid ${selected.includes(opt) ? C.blue : C.cardBorder}`,
                  background: selected.includes(opt) ? C.blue : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {selected.includes(opt) && (
                    <span style={{ color: "#fff", fontSize: "9px", fontWeight: 900 }}>✓</span>
                  )}
                </span>
                {opt}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "12px", fontSize: "12px", color: C.text4, textAlign: "center" }}>
                No matches
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MTD vs target cell ────────────────────────────────────────────────────────
function VsCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: C.text4 }}>—</span>;
  const color  = pct >= 90 ? C.green : pct >= 60 ? C.yellow : C.red;
  const bg     = pct >= 90 ? C.greenBg : pct >= 60 ? C.yellowBg : C.redBg;
  return (
    <span style={{
      background: bg, color,
      padding: "2px 8px", borderRadius: "99px",
      fontSize: "11px", fontWeight: 700,
    }}>
      {pct.toFixed(1)}%
    </span>
  );
}

// ── Month value cell ──────────────────────────────────────────────────────────
function MonthCell({ value, trend }: { value: number; trend: Trend }) {
  if (value === 0) return <span style={{ color: C.text4 }}>—</span>;
  const cfg = TREND_CFG[trend];
  return (
    <span style={{ color: cfg.color, fontWeight: 600 }}>
      {fmtShort(value)}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SalesmanPage() {
  const [rows,         setRows]         = useState<ReportRow[]>([]);
  const [allMonths,    setAllMonths]    = useState<string[]>([]);
  const [pastMonths,   setPastMonths]   = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState("");
  const [filterOpts,   setFilterOpts]   = useState<FilterOpts>({ brands: [], fcs: [], salesmen: [] });
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  // Date inputs
  const [inputFrom, setInputFrom] = useState("");
  const [inputTo,   setInputTo]   = useState("");

  // Filters
  const [selBrands,   setSelBrands]   = useState<string[]>([]);
  const [selFcs,      setSelFcs]      = useState<string[]>([]);
  const [selSalesmen, setSelSalesmen] = useState<string[]>([]);

  // Search
  const [search, setSearch] = useState("");

  // Trend filter
  const [trendFilter, setTrendFilter] = useState<Trend | "all">("all");

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback((from?: string, to?: string) => {
    setLoading(true);
    setError("");

    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to)   qs.set("to",   to);
    selBrands.forEach(b   => qs.append("brand",    b));
    selFcs.forEach(f      => qs.append("fc",       f));
    selSalesmen.forEach(s => qs.append("salesman", s));

    fetch(`/api/sales/salesman?${qs}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setRows(d.rows            ?? []);
        setAllMonths(d.all_months ?? []);
        setPastMonths(d.past_months ?? []);
        setCurrentMonth(d.current_month ?? "");
        setFilterOpts(d.filter_opts ?? { brands: [], fcs: [], salesmen: [] });
        setFromDate(d.from_date ?? "");
        setToDate(d.to_date     ?? "");
        if (!inputFrom) setInputFrom(d.from_date ?? "");
        if (!inputTo)   setInputTo(d.to_date     ?? "");
        setLoading(false);
      })
      .catch(() => { setError("Failed to load data."); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selBrands, selFcs, selSalesmen]);

  useEffect(() => { load(); }, [load]);

  // ── Derived: filtered + searched ──────────────────────────────────────────
  const displayed = rows.filter(r => {
    if (trendFilter !== "all" && r.trend !== trendFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.salesman_name.toLowerCase().includes(q) ||
      r.salesman_code.toLowerCase().includes(q) ||
      r.fc_name.toLowerCase().includes(q) ||
      r.brand_name.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q)
    );
  });

  // Trend counts (of displayed)
  const trendCounts = { green: 0, yellow: 0, red: 0, none: 0 };
  rows.forEach(r => { trendCounts[r.trend]++; });

  function toggle(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  const hasFilters = selBrands.length || selFcs.length || selSalesmen.length || search || trendFilter !== "all";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: C.text1, letterSpacing: "-0.03em", margin: 0 }}>
            Salesman Performance
          </h1>
          {fromDate && (
            <p style={{ fontSize: "12px", color: C.text4, marginTop: "3px", fontWeight: 500 }}>
              {monthLabel(allMonths[0] ?? "")} → {monthLabel(currentMonth)}
              &nbsp;·&nbsp; MTD up to {toDate}
            </p>
          )}
        </div>

        {/* Trend summary pills */}
        {!loading && !error && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {(["green","yellow","red"] as Trend[]).map(t => {
              const cfg = TREND_CFG[t];
              return (
                <button
                  key={t}
                  onClick={() => setTrendFilter(trendFilter === t ? "all" : t)}
                  style={{
                    display:     "inline-flex", alignItems: "center", gap: "6px",
                    background:  trendFilter === t ? cfg.bg : C.cardBg,
                    color:       cfg.color,
                    border:      `1.5px solid ${trendFilter === t ? cfg.border : C.cardBorder}`,
                    fontSize:    "11px", fontWeight: 700,
                    padding:     "4px 12px", borderRadius: "99px", cursor: "pointer",
                  }}
                >
                  <span style={{
                    width: "7px", height: "7px", borderRadius: "50%",
                    background: DOT_COLOR[t], display: "inline-block",
                  }} />
                  {trendCounts[t]} {cfg.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Date range + filter bar ─────────────────────────────────────── */}
      <div style={{ ...card, padding: "14px 18px", overflow: "visible" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>

          {/* Date range */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: C.text4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
              From
            </span>
            <input
              type="date" value={inputFrom}
              onChange={e => setInputFrom(e.target.value)}
              style={{
                padding: "5px 10px", borderRadius: "7px", fontSize: "12px",
                border: `1.5px solid ${C.cardBorder}`, background: C.sectionBg,
                color: C.text1, fontWeight: 500, outline: "none",
              }}
            />
            <span style={{ fontSize: "10px", fontWeight: 800, color: C.text4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
              To
            </span>
            <input
              type="date" value={inputTo}
              onChange={e => setInputTo(e.target.value)}
              style={{
                padding: "5px 10px", borderRadius: "7px", fontSize: "12px",
                border: `1.5px solid ${C.cardBorder}`, background: C.sectionBg,
                color: C.text1, fontWeight: 500, outline: "none",
              }}
            />
            <button
              onClick={() => load(inputFrom, inputTo)}
              style={{
                background: C.blue, color: "#fff",
                border: "none", borderRadius: "7px",
                padding: "6px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>

          <div style={{ width: "1px", height: "24px", background: C.cardBorder }} />

          {/* Dropdown filters */}
          <ComboFilter
            label="Brand" options={filterOpts.brands}
            selected={selBrands}
            onToggle={v => toggle(selBrands, v, setSelBrands)}
            onClear={() => setSelBrands([])}
          />
          <ComboFilter
            label="FC" options={filterOpts.fcs}
            selected={selFcs}
            onToggle={v => toggle(selFcs, v, setSelFcs)}
            onClear={() => setSelFcs([])}
          />
          <ComboFilter
            label="Salesman" options={filterOpts.salesmen}
            selected={selSalesmen}
            onToggle={v => toggle(selSalesmen, v, setSelSalesmen)}
            onClear={() => setSelSalesmen([])}
          />

          {/* Search */}
          <input
            type="text"
            placeholder="Quick search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: "5px 10px", borderRadius: "7px", fontSize: "12px",
              border: `1.5px solid ${C.cardBorder}`, background: C.sectionBg,
              color: C.text1, fontWeight: 500, outline: "none", minWidth: "160px",
            }}
          />

          {hasFilters && (
            <button
              onClick={() => {
                setSelBrands([]); setSelFcs([]); setSelSalesmen([]);
                setSearch(""); setTrendFilter("all");
              }}
              style={{
                background: "#fef2f2", color: C.red,
                border: `1.5px solid ${C.redBorder}`,
                borderRadius: "7px", padding: "5px 12px",
                fontSize: "11px", fontWeight: 700, cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          )}

          {!loading && (
            <span style={{
              marginLeft: "auto", fontSize: "11px", fontWeight: 600,
              color: C.text4, background: "#e2e8f0",
              padding: "3px 10px", borderRadius: "99px",
            }}>
              {displayed.length.toLocaleString("en-IN")} rows
            </span>
          )}
        </div>
      </div>

      {/* ── Loading / error ──────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: "13px" }}>
          Loading performance data…
        </div>
      )}
      {error && (
        <div style={{
          background: "#fef2f2", border: `1.5px solid ${C.redBorder}`,
          borderRadius: "10px", padding: "14px 18px",
          fontSize: "13px", fontWeight: 600, color: C.red,
        }}>
          {error}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div style={card}>
          {/* Both axes scroll; minWidth computed: 7 fixed cols + sparkline + N month cols */}
          <div style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: "660px",
            WebkitOverflowScrolling: "touch",
          }}>
            <table style={{
              borderCollapse: "collapse",
              /* 180+130+110+110+100+80+100+110 fixed = 920px, plus 92px per month col */
              minWidth: `${920 + pastMonths.length * 92}px`,
              tableLayout: "auto",
            }}>
              <thead>
                <tr>
                  {/* ── Fixed left columns ── */}
                  {[
                    { label: "Salesman",     w: "180px", right: false },
                    { label: "FC",           w: "130px", right: false },
                    { label: "Brand",        w: "110px", right: false },
                    { label: "MTD Achieved", w: "110px", right: true  },
                    { label: "MTD Target",   w: "100px", right: true  },
                    { label: "vs Target",    w: "80px",  right: true  },
                    { label: "Monthly Avg",  w: "100px", right: true  },
                  ].map(h => (
                    <th key={h.label} style={{
                      background:    C.headerBg,
                      color:         C.headerText,
                      fontSize:      "10px", fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      textAlign:     h.right ? "right" : "left",
                      padding:       "9px 14px",
                      whiteSpace:    "nowrap",
                      position:      "sticky", top: 0, zIndex: 10,
                      borderBottom:  "2px solid #0f172a",
                      minWidth:      h.w,
                    }}>
                      {h.label}
                    </th>
                  ))}

                  {/* ── Sparkline — right after avg ── */}
                  <th style={{
                    background:    C.headerBg,
                    color:         C.headerText,
                    fontSize:      "10px", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    textAlign:     "center",
                    padding:       "9px 14px",
                    whiteSpace:    "nowrap",
                    position:      "sticky", top: 0, zIndex: 10,
                    borderBottom:  "2px solid #0f172a",
                    minWidth:      "110px",
                    borderRight:   `2px solid #334155`,
                  }}>
                    Trend
                  </th>

                  {/* ── Past month columns oldest → newest ── */}
                  {pastMonths.map((m, i) => (
                    <th key={m} style={{
                      background:    C.headerBg,
                      color:         i === pastMonths.length - 1 ? C.headerText : "#94a3b8",
                      fontSize:      "10px", fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      textAlign:     "right",
                      padding:       "9px 14px",
                      whiteSpace:    "nowrap",
                      position:      "sticky", top: 0, zIndex: 10,
                      borderBottom:  "2px solid #0f172a",
                      minWidth:      "92px",
                    }}>
                      {monthLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {displayed.map((r, idx) => {
                  const bg  = idx % 2 === 0 ? C.rowOdd : C.rowEven;
                  const cfg = TREND_CFG[r.trend];

                  return (
                    <tr
                      key={`${r.salesman_code}::${r.fc_code}::${r.brand_code}`}
                      style={{
                        background:  bg,
                        borderBottom:`1px solid ${C.sectionBorder}`,
                        transition:  "background 0.1s",
                        borderLeft:  `3px solid ${DOT_COLOR[r.trend]}`,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = bg)}
                    >
                      {/* Salesman */}
                      <td style={{ padding: "8px 14px", minWidth: "180px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: C.text1 }}>
                          {r.salesman_name === "Unassigned"
                            ? <span style={{ color: C.text4, fontStyle: "italic" }}>Unassigned</span>
                            : r.salesman_name}
                        </div>
                        <div style={{ fontSize: "10px", color: C.text4, fontFamily: "monospace", marginTop: "1px" }}>
                          {r.salesman_code === "__UNKNOWN__" ? "—" : r.salesman_code}
                          {r.city ? ` · ${r.city}` : ""}
                        </div>
                      </td>

                      {/* FC */}
                      <td style={{ padding: "8px 14px", fontSize: "12px", color: C.text2, fontWeight: 500, whiteSpace: "nowrap" }}>
                        {r.fc_name}
                      </td>

                      {/* Brand */}
                      <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                        <span style={{
                          background: "#f1f5f9", color: C.text2,
                          padding: "2px 8px", borderRadius: "6px",
                          fontSize: "11px", fontWeight: 600,
                        }}>
                          {r.brand_name}
                        </span>
                      </td>

                      {/* MTD Achieved */}
                      <td style={{ padding: "8px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: cfg.color }}>
                          {fmtAmt(r.mtd_achieved)}
                        </div>
                        <div style={{ fontSize: "10px", color: C.text4, marginTop: "1px" }}>
                          {r.cur_bills}b · {r.cur_outlets}o · {r.cur_sku_count}s
                        </div>
                      </td>

                      {/* MTD Target */}
                      <td style={{ padding: "8px 14px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: C.text3, whiteSpace: "nowrap" }}>
                        {fmtAmt(r.mtd_target)}
                      </td>

                      {/* vs Target */}
                      <td style={{ padding: "8px 14px", textAlign: "right" }}>
                        <VsCell pct={r.mtd_vs_target} />
                      </td>

                      {/* Monthly Avg */}
                      <td style={{ padding: "8px 14px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: C.text3, whiteSpace: "nowrap" }}>
                        {fmtAmt(r.avg_monthly)}
                      </td>

                      {/* Sparkline — right after avg, with a subtle right border to visually separate */}
                      <td style={{
                        padding: "8px 14px", textAlign: "center",
                        borderRight: `2px solid ${C.sectionBorder}`,
                      }}>
                        <Sparkline
                          months={allMonths}
                          values={r.monthly_values}
                          dotColors={r.dot_colors}
                          trend={r.trend}
                          currentMonth={currentMonth}
                        />
                      </td>

                      {/* Past month columns oldest → newest */}
                      {pastMonths.map(m => (
                        <td key={m} style={{ padding: "8px 14px", textAlign: "right", fontSize: "11px", whiteSpace: "nowrap" }}>
                          <MonthCell
                            value={r.monthly_values[m] ?? 0}
                            trend={r.dot_colors[m]    ?? "none"}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer totals */}
              <tfoot>
                <tr style={{ background: C.sectionBg, borderTop: `2px solid ${C.cardBorder}` }}>
                  <td colSpan={3} style={{
                    padding: "9px 14px", fontSize: "11px", fontWeight: 700,
                    color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                  }}>
                    Total ({displayed.length.toLocaleString()} rows)
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: "13px", fontWeight: 800, color: C.text1, whiteSpace: "nowrap" }}>
                    {fmtAmt(displayed.reduce((s, r) => s + r.mtd_achieved, 0))}
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: "12px", fontWeight: 700, color: C.text3, whiteSpace: "nowrap" }}>
                    {fmtAmt(displayed.reduce((s, r) => s + r.mtd_target, 0))}
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>
                    {(() => {
                      const ta = displayed.reduce((s, r) => s + r.mtd_achieved, 0);
                      const tt = displayed.reduce((s, r) => s + r.mtd_target,   0);
                      return <VsCell pct={tt > 0 ? parseFloat(((ta / tt) * 100).toFixed(1)) : null} />;
                    })()}
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: "12px", fontWeight: 700, color: C.text3, whiteSpace: "nowrap" }}>
                    {fmtAmt(Math.round(displayed.reduce((s, r) => s + r.avg_monthly, 0) / Math.max(displayed.length, 1)))}
                  </td>
                  {/* Empty sparkline footer cell */}
                  <td style={{ borderRight: `2px solid ${C.sectionBorder}` }} />
                  {/* Month totals */}
                  {pastMonths.map(m => (
                    <td key={m} style={{ padding: "9px 14px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: C.text2, whiteSpace: "nowrap" }}>
                      {fmtShort(displayed.reduce((s, r) => s + (r.monthly_values[m] ?? 0), 0))}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
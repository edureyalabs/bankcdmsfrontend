// FILE PATH: app/sales/command/FcCardBack.tsx
"use client";

import { useEffect, useState, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Trend = "green" | "yellow" | "red" | "none";

interface SmRow {
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
  dot_colors:     Record<string, Trend>;
  trend:          Trend;
  cur_bills:      number;
  cur_outlets:    number;
  cur_sku_count:  number;
  monthly_values: Record<string, number>;
}

interface SmResponse {
  rows:          SmRow[];
  current_month: string;
  filter_opts:   { brands: string[]; fcs: string[]; salesmen: string[] };
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  cardBg:       "#ffffff",
  cardBorder:   "#cbd5e1",
  sectionBg:    "#f8fafc",
  sectionBorder:"#e2e8f0",
  headerBg:     "#1e293b",
  headerText:   "#e2e8f0",
  rowOdd:       "#ffffff",
  rowEven:      "#f8fafc",
  rowHover:     "#eff6ff",
  text1:        "#0f172a",
  text2:        "#1e293b",
  text3:        "#475569",
  text4:        "#94a3b8",
  green:        "#15803d", greenBg: "#dcfce7", greenBorder: "#86efac",
  amber:        "#92400e", amberBg: "#fef3c7", amberBorder: "#fcd34d",
  red:          "#991b1b", redBg:   "#fee2e2", redBorder:   "#fca5a5",
  blue:         "#2563eb", bluePale: "#dbeafe", blueBorder: "#93c5fd",
};

const TREND_CFG: Record<Trend, { color: string; bg: string; border: string }> = {
  green:  { color: C.green, bg: C.greenBg, border: C.greenBorder },
  yellow: { color: C.amber, bg: C.amberBg, border: C.amberBorder },
  red:    { color: C.red,   bg: C.redBg,   border: C.redBorder   },
  none:   { color: C.text4, bg: "#f1f5f9", border: C.cardBorder  },
};
const TREND_LABEL: Record<Trend, string> = {
  green: "On Track", yellow: "At Risk", red: "Critical", none: "No Data",
};
const DOT: Record<Trend, string> = {
  green: "#16a34a", yellow: "#d97706", red: "#dc2626", none: "#cbd5e1",
};

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtShort = (n: number) => {
  if (n === 0)         return "—";
  if (n >= 10_000_000) return "₹" + (n / 10_000_000).toFixed(1) + "Cr";
  if (n >= 1_00_000)   return "₹" + (n / 1_00_000).toFixed(1) + "L";
  return "₹" + Math.round(n).toLocaleString("en-IN");
};

// ── VsCell ────────────────────────────────────────────────────────────────────
function VsCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: C.text4, fontSize: "11px" }}>—</span>;
  const clr = pct >= 90 ? C.green : pct >= 60 ? C.amber : C.red;
  const bg  = pct >= 90 ? C.greenBg : pct >= 60 ? C.amberBg : C.redBg;
  return (
    <span style={{ background: bg, color: clr, padding: "2px 6px", borderRadius: "99px", fontSize: "10px", fontWeight: 700 }}>
      {pct.toFixed(1)}%
    </span>
  );
}

// ── TrendBadge ────────────────────────────────────────────────────────────────
function TrendBadge({ trend }: { trend: Trend }) {
  const cfg = TREND_CFG[trend];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: "9px", fontWeight: 700,
      padding: "2px 6px", borderRadius: "99px", whiteSpace: "nowrap",
    }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: DOT[trend], display: "inline-block", flexShrink: 0 }} />
      {TREND_LABEL[trend]}
    </span>
  );
}

// ── Sort state ────────────────────────────────────────────────────────────────
type SortKey = "salesman_name" | "brand_name" | "mtd_achieved" | "mtd_target" | "mtd_vs_target" | "avg_monthly";
type SortDir = "asc" | "desc";

// ── Main component ────────────────────────────────────────────────────────────
export function FcCardBack({
  fcName,
  onFlipBack,
}: {
  fcName:     string;
  onFlipBack: () => void;
}) {
  const [data,    setData]    = useState<SmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [fetched, setFetched] = useState(false);

  // Brand filter
  const [selBrand, setSelBrand] = useState<string>("All");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("mtd_achieved");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Fetch once on mount
  useEffect(() => {
    if (fetched) return;
    setFetched(true);
    const qs = new URLSearchParams();
    qs.append("fc", fcName);
    fetch(`/api/sales/salesman?${qs}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load."); setLoading(false); });
  }, [fcName, fetched]);

  // Brand options
  const brandOpts = useMemo(() => {
    if (!data) return [];
    return ["All", ...data.filter_opts.brands];
  }, [data]);

  // Filter + sort
  const displayed = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (selBrand !== "All") rows = rows.filter(r => r.brand_name === selBrand);
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [data, selBrand, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortTh({ label, k, right }: { label: string; k: SortKey; right?: boolean }) {
    const active = sortKey === k;
    const arrow  = active ? (sortDir === "desc" ? " ▼" : " ▲") : "";
    return (
      <th
        onClick={() => toggleSort(k)}
        style={{
          background: C.headerBg, color: active ? "#fff" : C.headerText,
          fontSize: "9px", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.06em",
          textAlign: right ? "right" : "left",
          padding: "7px 10px", whiteSpace: "nowrap",
          position: "sticky", top: 0, zIndex: 2,
          borderBottom: "2px solid #0f172a",
          cursor: "pointer", userSelect: "none",
        }}
      >
        {label}{arrow}
      </th>
    );
  }

  // Totals
  const totalAchieved = displayed.reduce((s, r) => s + r.mtd_achieved, 0);
  const totalTarget   = displayed.reduce((s, r) => s + r.mtd_target,   0);
  const overallPct    = totalTarget > 0
    ? parseFloat(((totalAchieved / totalTarget) * 100).toFixed(1))
    : null;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", background: C.cardBg,
      borderRadius: "inherit",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: "12px 14px 10px",
        flexShrink: 0,
        borderBottom: `1px solid ${C.sectionBorder}`,
      }}>
        {/* Top row: title + flip-back button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: C.text1, letterSpacing: "-0.02em" }}>
              {fcName}
            </div>
            <div style={{ fontSize: "10px", color: C.text4, marginTop: "1px", fontWeight: 500 }}>
              Salesman drill · {displayed.length} rep{displayed.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={onFlipBack}
            title="Back to FC view"
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              background: C.sectionBg, border: `1.5px solid ${C.cardBorder}`,
              borderRadius: "8px", padding: "5px 10px",
              fontSize: "11px", fontWeight: 700, color: C.text3,
              cursor: "pointer", flexShrink: 0,
              transition: "all 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bluePale; e.currentTarget.style.color = C.blue; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.sectionBg; e.currentTarget.style.color = C.text3; }}
          >
            ↩ FC View
          </button>
        </div>

        {/* Brand filter pills */}
        {brandOpts.length > 1 && (
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
            {brandOpts.map(b => {
              const active = selBrand === b;
              return (
                <button key={b} onClick={() => setSelBrand(b)} style={{
                  padding: "2px 9px", borderRadius: "99px",
                  border: `1.5px solid ${active ? C.blue : C.cardBorder}`,
                  background: active ? C.bluePale : "transparent",
                  color: active ? C.blue : C.text3,
                  fontSize: "10px", fontWeight: active ? 700 : 500,
                  cursor: "pointer", whiteSpace: "nowrap",
                  transition: "all 0.1s",
                }}>
                  {b}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {loading && (
          <div style={{ padding: "30px", textAlign: "center", color: C.text4, fontSize: "12px" }}>
            Loading reps…
          </div>
        )}

        {error && (
          <div style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 600, color: C.red, background: C.redBg }}>
            {error}
          </div>
        )}

        {!loading && !error && displayed.length === 0 && (
          <div style={{ padding: "30px", textAlign: "center", color: C.text4, fontSize: "12px" }}>
            No salesman data for this FC.
          </div>
        )}

        {!loading && !error && displayed.length > 0 && (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "480px" }}>
              <thead>
                <tr>
                  <SortTh label="Salesman"  k="salesman_name" />
                  <SortTh label="Brand"     k="brand_name"    />
                  <SortTh label="Achieved"  k="mtd_achieved"  right />
                  <SortTh label="Target"    k="mtd_target"    right />
                  <SortTh label="vs Tgt"    k="mtd_vs_target" right />
                  <SortTh label="Avg/Mo"    k="avg_monthly"   right />
                  {/* Trend — not sortable, no space for label noise */}
                  <th style={{
                    background: C.headerBg, color: C.headerText,
                    fontSize: "9px", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    textAlign: "center", padding: "7px 10px", whiteSpace: "nowrap",
                    position: "sticky", top: 0, zIndex: 2,
                    borderBottom: "2px solid #0f172a",
                  }}>
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, i) => {
                  const bg = i % 2 === 0 ? C.rowOdd : C.rowEven;
                  return (
                    <tr
                      key={`${r.salesman_code}::${r.fc_code}::${r.brand_code}`}
                      style={{
                        background: bg,
                        borderBottom: `1px solid ${C.sectionBorder}`,
                        borderLeft: `3px solid ${DOT[r.trend]}`,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = bg)}
                    >
                      {/* Salesman */}
                      <td style={{ padding: "7px 10px", minWidth: "120px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: C.text1, lineHeight: 1.2 }}>
                          {r.salesman_name === "Unassigned"
                            ? <span style={{ color: C.text4, fontStyle: "italic" }}>Unassigned</span>
                            : r.salesman_name}
                        </div>
                        {r.salesman_code !== "__UNKNOWN__" && (
                          <div style={{ fontSize: "9px", color: C.text4, fontFamily: "monospace", marginTop: "1px" }}>
                            {r.salesman_code}
                          </div>
                        )}
                      </td>

                      {/* Brand */}
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                        <span style={{
                          background: "#f1f5f9", color: C.text2,
                          padding: "1px 6px", borderRadius: "5px",
                          fontSize: "10px", fontWeight: 600,
                        }}>
                          {r.brand_name}
                        </span>
                      </td>

                      {/* MTD Achieved */}
                      <td style={{ padding: "7px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: TREND_CFG[r.trend].color }}>
                          {fmtShort(r.mtd_achieved)}
                        </div>
                        <div style={{ fontSize: "9px", color: C.text4, marginTop: "1px" }}>
                          {r.cur_bills}b · {r.cur_outlets}o
                        </div>
                      </td>

                      {/* MTD Target */}
                      <td style={{ padding: "7px 10px", textAlign: "right", fontSize: "11px", fontWeight: 600, color: C.text3, whiteSpace: "nowrap" }}>
                        {fmtShort(r.mtd_target)}
                      </td>

                      {/* vs Target */}
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>
                        <VsCell pct={r.mtd_vs_target} />
                      </td>

                      {/* Monthly Avg */}
                      <td style={{ padding: "7px 10px", textAlign: "right", fontSize: "11px", fontWeight: 600, color: C.text3, whiteSpace: "nowrap" }}>
                        {fmtShort(r.avg_monthly)}
                      </td>

                      {/* Trend */}
                      <td style={{ padding: "7px 10px", textAlign: "center" }}>
                        <TrendBadge trend={r.trend} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer totals */}
              <tfoot>
                <tr style={{ background: C.sectionBg, borderTop: `2px solid ${C.cardBorder}` }}>
                  <td colSpan={2} style={{ padding: "7px 10px", fontSize: "10px", fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Total ({displayed.length})
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontSize: "12px", fontWeight: 800, color: C.text1, whiteSpace: "nowrap" }}>
                    {fmtShort(totalAchieved)}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontSize: "11px", fontWeight: 700, color: C.text3, whiteSpace: "nowrap" }}>
                    {fmtShort(totalTarget)}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>
                    <VsCell pct={overallPct} />
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
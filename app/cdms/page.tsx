"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt      = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtCount = (n: number) => Number(n).toLocaleString("en-IN");
const fmtMonth = (ym: string) => {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

function buildQS(f: Filters): string {
  const p = new URLSearchParams();
  f.fc.forEach(v     => p.append("fc",     v));
  f.brand.forEach(v  => p.append("brand",  v));
  f.status.forEach(v => p.append("status", v));
  f.mode.forEach(v   => p.append("mode",   v));
  if (f.ref)      p.set("ref",      f.ref);
  if (f.invoice)  p.set("invoice",  f.invoice);
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo)   p.set("dateTo",   f.dateTo);
  return p.toString();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface PivotRow {
  grp_key: string; total: number; full_match: number; partial: number; unmatched: number;
  total_count: number; full_count: number; partial_count: number; unmatched_count: number;
}
interface Totals {
  total: number; full_match: number; partial: number; unmatched: number;
  total_count: number; full_count: number; partial_count: number; unmatched_count: number;
}
interface FilterOpts { fc: string[]; brand: string[]; mode: string[]; status: string[]; }
interface SummaryData {
  by_fc: PivotRow[]; by_month: PivotRow[]; totals: Totals; filter_opts: FilterOpts;
  error?: string;
}
interface RawRow { [key: string]: string | number | null; }
interface RawResponse { rows: RawRow[]; total: number; hasMore: boolean; }
type Filters = {
  fc: string[]; brand: string[]; status: string[]; mode: string[];
  ref: string; invoice: string; dateFrom: string; dateTo: string;
};
const EMPTY: Filters = { fc: [], brand: [], status: [], mode: [], ref: "", invoice: "", dateFrom: "", dateTo: "" };
const PAGE = 100;

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  cardBg:       "#ffffff",
  cardBorder:   "#cbd5e1",
  headerBg:     "#1e293b",
  headerText:   "#e2e8f0",
  sectionBg:    "#f8fafc",
  sectionBorder:"#e2e8f0",
  rowOdd:       "#ffffff",
  rowEven:      "#f8fafc",
  rowHover:     "#eff6ff",
  green:        "#15803d",
  greenHeader:  "#86efac",
  amber:        "#92400e",
  amberHeader:  "#fcd34d",
  red:          "#991b1b",
  redHeader:    "#fca5a5",
  total:        "#0f172a",
  totalHeader:  "#f8fafc",
  text1:        "#0f172a",
  text2:        "#1e293b",
  text3:        "#475569",
  text4:        "#94a3b8",
  blue:         "#1d4ed8",
  blueMid:      "#2563eb",
  blueLight:    "#dbeafe",
  blueBorder:   "#93c5fd",
};

const card: React.CSSProperties = {
  background: C.cardBg,
  border: `1.5px solid ${C.cardBorder}`,
  borderRadius: "12px",
  boxShadow: "0 2px 6px rgba(15,23,42,0.07), 0 8px 24px rgba(15,23,42,0.04)",
  overflow: "hidden",
};

// ── Multi-Select ──────────────────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  const btnLabel = selected.length === 0 ? "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }}>
      <label style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text3 }}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
          background: "#fff", border: `1.5px solid #94a3b8`, borderRadius: "7px",
          padding: "6px 10px", minWidth: "130px", cursor: "pointer",
          fontSize: "12px", fontWeight: selected.length ? 700 : 400,
          color: selected.length ? C.text1 : C.text4,
          boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
        }}
      >
        <span>{btnLabel}</span>
        <span style={{ fontSize: "8px", color: C.text3 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: "4px",
          background: "#fff", border: `1.5px solid ${C.cardBorder}`, borderRadius: "8px",
          boxShadow: "0 10px 30px rgba(15,23,42,0.14)", minWidth: "180px",
          maxHeight: "240px", overflowY: "auto", zIndex: 200,
        }}>
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              style={{
                width: "100%", textAlign: "left", padding: "8px 12px", background: "none",
                border: "none", borderBottom: `1px solid ${C.sectionBorder}`,
                fontSize: "11px", fontWeight: 700, color: C.blueMid, cursor: "pointer",
              }}
            >✕ Clear all</button>
          )}
          {options.map(opt => (
            <label key={opt} style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "7px 12px", cursor: "pointer", fontSize: "12px",
              fontWeight: 500, color: C.text1,
            }}>
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                style={{ accentColor: C.blueMid, width: "13px", height: "13px" }}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pivot Table ───────────────────────────────────────────────────────────────
function PivotTable({ label, dimLabel, rows, totals, formatKey }: {
  label: string; dimLabel: string; rows: PivotRow[]; totals: Totals; formatKey: (k: string) => string;
}) {
  const thBase: React.CSSProperties = {
    background: C.headerBg, color: C.headerText,
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", padding: "10px 14px", whiteSpace: "nowrap",
    position: "sticky", top: 0, zIndex: 10, borderBottom: `2px solid #0f172a`,
  };

  return (
    <div style={{ ...card, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "calc(100vh - 260px)", minHeight: "400px" }}>
      <div style={{ padding: "10px 16px", background: C.sectionBg, borderBottom: `1.5px solid ${C.sectionBorder}`, flexShrink: 0 }}>
        <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2 }}>{label}</span>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: C.text4, fontSize: "13px" }}>No data</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thBase, textAlign: "left" }}>{dimLabel}</th>
                <th style={{ ...thBase, textAlign: "right", color: C.greenHeader }}>Full Match</th>
                <th style={{ ...thBase, textAlign: "right", color: C.amberHeader }}>Partial</th>
                <th style={{ ...thBase, textAlign: "right", color: C.redHeader }}>Unmatched</th>
                <th style={{ ...thBase, textAlign: "right", color: C.headerText }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const bg = i % 2 === 0 ? C.rowOdd : C.rowEven;
                return (
                  <tr key={i}
                    style={{ background: bg, borderBottom: `1px solid ${C.sectionBorder}`, transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = bg)}
                  >
                    <td style={{ padding: "9px 14px", color: C.text1, fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap" }}>{formatKey(row.grp_key) || "—"}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      <div style={{ color: C.green, fontWeight: 700, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmt(row.full_match)}</div>
                      <div style={{ color: C.text3, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{fmtCount(row.full_count)} rows</div>
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      <div style={{ color: C.amber, fontWeight: 700, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmt(row.partial)}</div>
                      <div style={{ color: C.text3, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{fmtCount(row.partial_count)} rows</div>
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      <div style={{ color: C.red, fontWeight: 700, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmt(row.unmatched)}</div>
                      <div style={{ color: C.text3, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{fmtCount(row.unmatched_count)} rows</div>
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      <div style={{ color: C.total, fontWeight: 800, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmt(row.total)}</div>
                      <div style={{ color: C.text3, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{fmtCount(row.total_count)} rows</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: C.headerBg, borderTop: `2px solid #0f172a`, position: "sticky", bottom: 0 }}>
                <td style={{ padding: "10px 14px", color: C.totalHeader, fontWeight: 800, fontSize: "13px" }}>Total</td>
                <td style={{ padding: "10px 14px", textAlign: "right" }}>
                  <div style={{ color: C.greenHeader, fontWeight: 800, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmt(totals.full_match)}</div>
                  <div style={{ color: C.text4, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{fmtCount(totals.full_count)} rows</div>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right" }}>
                  <div style={{ color: C.amberHeader, fontWeight: 800, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmt(totals.partial)}</div>
                  <div style={{ color: C.text4, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{fmtCount(totals.partial_count)} rows</div>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right" }}>
                  <div style={{ color: C.redHeader, fontWeight: 800, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmt(totals.unmatched)}</div>
                  <div style={{ color: C.text4, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{fmtCount(totals.unmatched_count)} rows</div>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right" }}>
                  <div style={{ color: C.totalHeader, fontWeight: 800, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmt(totals.total)}</div>
                  <div style={{ color: C.text4, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{fmtCount(totals.total_count)} rows</div>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Raw Table — infinite scroll ────────────────────────────────────────────────
const RAW_COLS = [
  { key: "FC",                        label: "FC" },
  { key: "Brand",                     label: "Brand" },
  { key: "Match_Status",              label: "Status" },
  { key: "Collected_Mode",            label: "Mode" },
  { key: "Cashier_verification_date", label: "Verified Date" },
  { key: "Collected_Amount",          label: "Amount" },
  { key: "Invoice_Number",            label: "Invoice" },
  { key: "Retailer_Name",             label: "Retailer" },
  { key: "Reference_no",              label: "Reference" },
  { key: "Bank_Account",              label: "Bank Acc" },
  { key: "Bank_Deposit_Amt",          label: "Bank Amt" },
  { key: "CDMS_Sum",                  label: "CDMS Sum" },
  { key: "Diff",                      label: "Diff" },
  { key: "Bank_Narration_Type",       label: "Narr Type" },
  { key: "Match_Remark",              label: "Remark" },
];
const AMT = new Set(["Collected_Amount", "Bank_Deposit_Amt", "CDMS_Sum", "Diff"]);
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  "Full Match":    { color: C.green, bg: "#f0fdf4" },
  "Partial Match": { color: C.amber, bg: "#fffbeb" },
  "Unmatched":     { color: C.red,   bg: "#fef2f2" },
};

function RawTable({ qs, onDownload }: { qs: string; onDownload: () => void }) {
  const [rows,        setRows]        = useState<RawRow[]>([]);
  const [total,       setTotal]       = useState(0);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef   = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset + load first page whenever filters change
  useEffect(() => {
    offsetRef.current = 0;
    setRows([]);
    setTotal(0);
    setHasMore(false);
    setLoading(true);

    fetch(`/api/cdms/raw?limit=${PAGE}&offset=0` + (qs ? "&" + qs : ""))
      .then(r => r.json())
      .then((d: RawResponse) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
        setHasMore(d.hasMore ?? false);
        offsetRef.current = d.rows?.length ?? 0;
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [qs]);

  // Append next page
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetch(`/api/cdms/raw?limit=${PAGE}&offset=${offsetRef.current}` + (qs ? "&" + qs : ""))
      .then(r => r.json())
      .then((d: RawResponse) => {
        setRows(prev => [...prev, ...(d.rows ?? [])]);
        setHasMore(d.hasMore ?? false);
        offsetRef.current += d.rows?.length ?? 0;
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  }, [qs, hasMore, loadingMore]);

  // IntersectionObserver triggers loadMore when sentinel comes into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", height: "480px" }}>
      {/* Toolbar */}
      <div style={{
        padding: "10px 16px", background: C.sectionBg,
        borderBottom: `1.5px solid ${C.sectionBorder}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2 }}>
            Raw Data
          </span>
          {!loading && (
            <span style={{
              fontSize: "11px", fontWeight: 600, color: C.text2,
              background: "#e2e8f0", padding: "2px 9px", borderRadius: "99px",
            }}>
              {fmtCount(rows.length)} of {fmtCount(total)}
            </span>
          )}
        </div>
        <button
          onClick={onDownload}
          style={{
            background: C.blue, color: "#fff", border: "none", borderRadius: "7px",
            padding: "7px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 6px rgba(29,78,216,0.3)",
          }}
        >↓ Download CSV</button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: "13px" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.text4, fontSize: "13px" }}>No data</div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "max-content" }}>
              <thead>
                <tr>
                  {RAW_COLS.map(c => (
                    <th key={c.key} style={{
                      background: C.headerBg, color: C.headerText,
                      fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                      textAlign: AMT.has(c.key) ? "right" : "left",
                      padding: "9px 12px", whiteSpace: "nowrap",
                      position: "sticky", top: 0, zIndex: 10, borderBottom: "2px solid #0f172a",
                    }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const bg = i % 2 === 0 ? C.rowOdd : C.rowEven;
                  return (
                    <tr key={i}
                      style={{ background: bg, borderBottom: `1px solid ${C.sectionBorder}`, transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = bg)}
                    >
                      {RAW_COLS.map(c => {
                        const val      = row[c.key];
                        const isStatus = c.key === "Match_Status";
                        const isAmt    = AMT.has(c.key);
                        const display  = val == null || val === "" ? "—" : isAmt ? fmt(Number(val)) : String(val);
                        const sc       = isStatus ? STATUS_STYLE[String(val)] : null;
                        return (
                          <td key={c.key} title={String(val ?? "")} style={{
                            padding: "7px 12px",
                            textAlign: isAmt ? "right" : "left",
                            maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            fontSize: "12px",
                            color: sc ? sc.color : isAmt ? C.text1 : C.text2,
                            fontWeight: isStatus ? 700 : isAmt ? 600 : 500,
                            background: sc ? sc.bg : "transparent",
                          }}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Sentinel + status line */}
            <div ref={sentinelRef} style={{ padding: "14px 0", textAlign: "center" }}>
              {loadingMore ? (
                <span style={{ fontSize: "12px", color: C.text3, fontWeight: 500 }}>Loading more…</span>
              ) : hasMore ? (
                <span style={{ fontSize: "12px", color: C.text4, fontWeight: 500 }}>Scroll down for more rows</span>
              ) : (
                <span style={{ fontSize: "11px", color: C.text4, fontWeight: 500 }}>
                  All {fmtCount(total)} rows loaded
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SummaryPage() {
  const router = useRouter();
  const [data,    setData]    = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draft,   setDraft]   = useState<Filters>(EMPTY);
  const [sentQS,  setSentQS]  = useState("");

  const fetchSummary = useCallback((f: Filters) => {
    const qs = buildQS(f);
    setSentQS(qs);
    setLoading(true);
    fetch("/api/cdms/summary" + (qs ? "?" + qs : ""))
      .then(r => {
        if (r.status === 401) { router.push("/"); return null; }
        return r.json();
      })
      .then((d: SummaryData | null) => {
        if (!d) return;
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d); setLoading(false);
      })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setLoading(false); });
  }, [router]);

  useEffect(() => { fetchSummary(filters); }, [filters, fetchSummary]);

  const apply = () => setFilters({ ...draft });
  const reset = () => { setDraft({ ...EMPTY }); setFilters({ ...EMPTY }); };
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = "/api/cdms/download" + (sentQS ? "?" + sentQS : "");
    a.download = "cdms_export.csv"; a.click();
  };

  const opts = data?.filter_opts;
  const activeCount = filters.fc.length + filters.brand.length + filters.status.length + filters.mode.length
    + (filters.ref ? 1 : 0) + (filters.invoice ? 1 : 0) + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0);

  const inputStyle: React.CSSProperties = {
    background: "#fff", border: "1.5px solid #94a3b8", borderRadius: "7px",
    padding: "6px 10px", fontSize: "12px", fontWeight: 500, color: C.text1,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em",
    textTransform: "uppercase", color: C.text3, marginBottom: "4px", display: "block",
  };

  const inp = (key: "ref" | "invoice" | "dateFrom" | "dateTo", label: string, ph: string, type = "text") => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} style={inputStyle} placeholder={ph} value={draft[key]}
        onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} />
    </div>
  );

  if (error) return (
    <div style={{ textAlign: "center", padding: "80px 0" }}>
      <p style={{ fontWeight: 700, fontSize: "16px", color: C.red }}>Could not load dashboard</p>
      <p style={{ fontSize: "13px", color: C.text3, marginTop: "8px" }}>{error}</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── Page Header ── */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: C.text1, letterSpacing: "-0.03em", margin: 0 }}>
          CDMS Mapping
        </h1>
        <p style={{ fontSize: "12px", color: C.text3, fontWeight: 500, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
          CDMS data · All sections reflect active filters
          {activeCount > 0 && (
            <span style={{
              fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "99px",
              background: C.blueLight, color: C.blue, border: `1.5px solid ${C.blueBorder}`,
            }}>
              {activeCount} filter{activeCount > 1 ? "s" : ""} active
            </span>
          )}
        </p>
      </div>

      {/* ── Filter Panel ── */}
      <div style={{ ...card,overflow: "visible", padding: "14px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
          <MultiSelect label="FC"             options={opts?.fc     ?? []}    selected={draft.fc}     onChange={v => setDraft(d => ({ ...d, fc: v }))} />
          <MultiSelect label="Brand"          options={opts?.brand  ?? []}    selected={draft.brand}  onChange={v => setDraft(d => ({ ...d, brand: v }))} />
          <MultiSelect label="Match Status"   options={opts?.status ?? ["Full Match","Partial Match","Unmatched"]} selected={draft.status} onChange={v => setDraft(d => ({ ...d, status: v }))} />
          <MultiSelect label="Collected Mode" options={opts?.mode   ?? []}    selected={draft.mode}   onChange={v => setDraft(d => ({ ...d, mode: v }))} />
          {inp("ref",      "Reference No.", "Search…")}
          {inp("invoice",  "Invoice No.",   "Search…")}
          {inp("dateFrom", "Date From",     "", "date")}
          {inp("dateTo",   "Date To",       "", "date")}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ ...labelStyle, visibility: "hidden" }}>·</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={apply} style={{
                background: C.blue, color: "#fff", border: "none", borderRadius: "7px",
                padding: "7px 20px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                boxShadow: "0 2px 6px rgba(29,78,216,0.28)",
              }}>Apply</button>
              <button onClick={reset} style={{
                background: "#fff", color: C.text2, border: `1.5px solid #94a3b8`,
                borderRadius: "7px", padding: "7px 16px", fontSize: "12px",
                fontWeight: 700, cursor: "pointer",
              }}>Reset</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pivot Tables ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: C.text3, fontSize: "14px", fontWeight: 500 }}>
          Loading data…
        </div>
      ) : data && (
        <div style={{ display: "flex", gap: "16px" }}>
          <PivotTable label="By FC"    dimLabel="FC"    rows={data.by_fc}    totals={data.totals} formatKey={k => k} />
          <PivotTable label="By Month" dimLabel="Month" rows={data.by_month} totals={data.totals} formatKey={fmtMonth} />
        </div>
      )}

      {/* ── Raw Data Table ── */}
      <RawTable qs={sentQS} onDownload={handleDownload} />

    </div>
  );
}
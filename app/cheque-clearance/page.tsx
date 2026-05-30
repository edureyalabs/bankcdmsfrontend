// FILE PATH: app/cheque-clearance/page.tsx — REPLACE EXISTING

"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import RawTable, { type ColDef } from "@/components/RawTable";

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt      = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtCount = (n: number) => Number(n).toLocaleString("en-IN");
const fmtMonth = (ym: string) => {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", {
    month: "long", year: "numeric",
  });
};

// ── Yesterday helper (default "as of" date) ───────────────────────────────────
function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Design tokens (identical to CDMS page) ────────────────────────────────────
const C = {
  cardBg: "#ffffff", cardBorder: "#cbd5e1",
  headerBg: "#1e293b", headerText: "#e2e8f0",
  sectionBg: "#f8fafc", sectionBorder: "#e2e8f0",
  rowOdd: "#ffffff", rowEven: "#f8fafc", rowHover: "#eff6ff",
  red: "#991b1b", redHeader: "#fca5a5",
  total: "#0f172a", totalHeader: "#f8fafc",
  text1: "#0f172a", text2: "#1e293b", text3: "#475569", text4: "#94a3b8",
  blue: "#1d4ed8", blueMid: "#2563eb", blueLight: "#dbeafe", blueBorder: "#93c5fd",
};

const card: React.CSSProperties = {
  background: C.cardBg, border: `1.5px solid ${C.cardBorder}`, borderRadius: "12px",
  boxShadow: "0 2px 6px rgba(15,23,42,0.07), 0 8px 24px rgba(15,23,42,0.04)",
  overflow: "hidden",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface PivotRow {
  grp_key:     string;
  total:       number;
  total_count: number;
}

interface Totals {
  total:       number;
  total_count: number;
}

interface FilterOpts {
  fc:    string[];
  brand: string[];
  mode:  string[];
}

interface Filters {
  fc:       string[];
  brand:    string[];
  mode:     string[];
  ref:      string;
  retailer: string;
  dueTo:    string;   // the "as of" cutoff date
}

const EMPTY_TOTALS: Totals  = { total: 0, total_count: 0 };

// ── Shimmer (injected once) ───────────────────────────────────────────────────
const SHIMMER_ID = "cc-shimmer-style";
function ensureShimmerStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SHIMMER_ID)) return;
  const el = document.createElement("style");
  el.id = SHIMMER_ID;
  el.textContent = `
    @keyframes cc-shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    .cc-shimmer-bar {
      border-radius: 4px;
      background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
      background-size: 600px 100%;
      animation: cc-shimmer 1.4s ease-in-out infinite;
    }
    @keyframes cc-spin { to { transform: rotate(360deg); } }
    .cc-spin { animation: cc-spin 0.75s linear infinite; }
  `;
  document.head.appendChild(el);
}

// ── Shimmer skeleton (matches CDMS page) ──────────────────────────────────────
function ShimmerRows() {
  useEffect(() => { ensureShimmerStyle(); }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${C.sectionBorder}`, background: i % 2 === 0 ? C.rowOdd : C.rowEven }}>
          <div style={{ flex: "0 0 160px" }}>
            <div className="cc-shimmer-bar" style={{ width: `${60 + (i * 17) % 60}px`, height: "12px" }} />
          </div>
          {[0, 1].map(j => (
            <div key={j} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
              <div className="cc-shimmer-bar" style={{ width: `${55 + ((i + j) * 11) % 40}px`, height: "12px" }} />
              <div className="cc-shimmer-bar" style={{ width: "38px", height: "9px", opacity: 0.5 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Multi-Select (identical to CDMS page) ────────────────────────────────────
function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle   = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  const btnLabel = selected.length === 0 ? "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }}>
      <label style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text3 }}>{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", background: "#fff", border: "1.5px solid #94a3b8", borderRadius: "7px", padding: "6px 10px", minWidth: "130px", cursor: "pointer", fontSize: "12px", fontWeight: selected.length ? 700 : 400, color: selected.length ? C.text1 : C.text4, boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
        <span>{btnLabel}</span>
        <span style={{ fontSize: "8px", color: C.text3 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", background: "#fff", border: `1.5px solid ${C.cardBorder}`, borderRadius: "8px", boxShadow: "0 10px 30px rgba(15,23,42,0.14)", minWidth: "180px", maxHeight: "240px", overflowY: "auto", zIndex: 200 }}>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", borderBottom: `1px solid ${C.sectionBorder}`, fontSize: "11px", fontWeight: 700, color: C.blueMid, cursor: "pointer" }}>
              ✕ Clear all
            </button>
          )}
          {options.map(opt => (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 500, color: C.text1 }}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ accentColor: C.blueMid, width: "13px", height: "13px" }} />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pivot Table ───────────────────────────────────────────────────────────────
// Simplified vs CDMS — only one value column (Unmatched amount) since all rows
// here are Unmatched by definition. Mirrors the CDMS pivot shell/structure.
function PivotTable({ label, dimLabel, rows, totals, formatKey, loading }: {
  label: string; dimLabel: string; rows: PivotRow[]; totals: Totals;
  formatKey: (k: string) => string; loading?: boolean;
}) {
  const thBase: React.CSSProperties = {
    background: C.headerBg, color: C.headerText,
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", padding: "10px 14px", whiteSpace: "nowrap",
    borderBottom: "2px solid #0f172a",
  };
  return (
    <div style={{ ...card, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "calc(100vh - 260px)", minHeight: "400px" }}>
      <div style={{ padding: "10px 16px", background: C.sectionBg, borderBottom: `1.5px solid ${C.sectionBorder}`, flexShrink: 0 }}>
        <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2 }}>{label}</span>
      </div>
      {/* Fixed header */}
      <div style={{ flexShrink: 0, borderBottom: "2px solid #0f172a" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...thBase, textAlign: "left",  borderBottom: "none" }}>{dimLabel}</th>
            <th style={{ ...thBase, textAlign: "right", color: C.redHeader,  borderBottom: "none" }}>Amount</th>
            <th style={{ ...thBase, textAlign: "right", color: C.totalHeader, borderBottom: "none" }}>Cheques</th>
          </tr></thead>
        </table>
      </div>
      {/* Scrollable body */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? <ShimmerRows /> : rows.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0", color: C.text4, fontSize: "13px" }}>No data</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {rows.map((row, i) => {
                  const bg = i % 2 === 0 ? C.rowOdd : C.rowEven;
                  return (
                    <tr
                      key={i}
                      style={{ background: bg, borderBottom: `1px solid ${C.sectionBorder}`, transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = bg)}
                    >
                      <td style={{ padding: "9px 14px", color: C.text1, fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap", width: "160px" }}>
                        {formatKey(row.grp_key) || "—"}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right" }}>
                        <div style={{ color: C.red, fontWeight: 700, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmt(row.total)}</div>
                        <div style={{ color: C.text3, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{fmtCount(row.total_count)} rows</div>
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right" }}>
                        <div style={{ color: C.total, fontWeight: 800, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{fmtCount(row.total_count)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </div>
      {/* Pinned footer totals */}
      <div style={{ flexShrink: 0, borderTop: "2px solid #0f172a", background: C.headerBg }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tfoot><tr>
            <td style={{ padding: "10px 14px", color: C.totalHeader, fontWeight: 800, fontSize: "13px", width: "160px" }}>Total</td>
            <td style={{ padding: "10px 14px", textAlign: "right" }}>
              <div style={{ color: C.redHeader, fontWeight: 800, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{loading ? "—" : fmt(totals.total)}</div>
              <div style={{ color: C.text4, fontSize: "10px", fontWeight: 500, marginTop: "1px" }}>{loading ? "" : `${fmtCount(totals.total_count)} rows`}</div>
            </td>
            <td style={{ padding: "10px 14px", textAlign: "right" }}>
              <div style={{ color: C.totalHeader, fontWeight: 800, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>{loading ? "—" : fmtCount(totals.total_count)}</div>
            </td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Raw table column definitions ──────────────────────────────────────────────
const CC_COLS: ColDef[] = [
  { key: "collected_date",            label: "Collected Date"  },
  { key: "FC",                        label: "FC"              },
  { key: "Brand",                     label: "Brand"           },
  { key: "Collected_Mode",            label: "Mode"            },
  { key: "Cashier_verification_date", label: "CV Date"         },
  { key: "Cheque_Due_Date",           label: "Cheque Due"      },
  { key: "Collected_Amount",          label: "Amount",  amt: true },
  { key: "Invoice_Number",            label: "Invoice"         },
  { key: "Retailer_Name",             label: "Retailer", wide: true },
  { key: "Reference_no",              label: "Reference"       },
  { key: "Bank_Account",              label: "Bank Acc"        },
  { key: "Match_Remark",              label: "Remark",  wide: true },
];

// ── Download button ───────────────────────────────────────────────────────────
function DownloadButton({ qs }: { qs: string }) {
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { ensureShimmerStyle(); }, []);

  const handle = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res  = await fetch("/api/cheque-clearance/download" + (qs ? "?" + qs : ""));
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a    = document.createElement("a");
      a.href     = URL.createObjectURL(blob);
      a.download = "cheque_clearance_export.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { console.error(e); }
    finally     { setDownloading(false); }
  };

  return (
    <button onClick={handle} disabled={downloading} style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: downloading ? "#475569" : C.blue, color: "#fff", border: "none", borderRadius: "7px", padding: "7px 18px", fontSize: "12px", fontWeight: 700, cursor: downloading ? "not-allowed" : "pointer", boxShadow: downloading ? "none" : "0 2px 6px rgba(29,78,216,0.28)", transition: "background 0.2s", opacity: downloading ? 0.85 : 1 }}>
      {downloading ? (
        <><svg className="cc-spin" width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/><path d="M6.5 1A5.5 5.5 0 0 1 12 6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>Downloading…</>
      ) : (
        <><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v7M3.5 5.5l3 3 3-3M1 10.5h11" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Download CSV</>
      )}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ChequeClearancePage() {
  const router = useRouter();

  // ── State ─────────────────────────────────────────────────────────────────
  const [data,    setData]    = useState<{
    by_fc: PivotRow[]; by_month: PivotRow[];
    totals: Totals; filter_opts: FilterOpts;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Filters: draft = what's in the filter bar UI, applied = what's been submitted
  const yesterday = getYesterday();

  const [draft,   setDraft]   = useState<Filters>({
    fc: [], brand: [], mode: [], ref: "", retailer: "", dueTo: yesterday,
  });
  const [applied, setApplied] = useState<Filters>({
    fc: [], brand: [], mode: [], ref: "", retailer: "", dueTo: yesterday,
  });

  useEffect(() => { ensureShimmerStyle(); }, []);
  useEffect(() => { if (error === "Unauthorized") router.push("/"); }, [error, router]);

  // ── Build query string ────────────────────────────────────────────────────
  const buildQS = (f: Filters) => {
    const p = new URLSearchParams();
    f.fc.forEach(v      => p.append("fc",      v));
    f.brand.forEach(v   => p.append("brand",   v));
    f.mode.forEach(v    => p.append("mode",    v));
    if (f.ref)      p.set("ref",      f.ref);
    if (f.retailer) p.set("retailer", f.retailer);
    if (f.dueTo)    p.set("dueTo",    f.dueTo);
    return p.toString();
  };

  const qs = buildQS(applied);

  // ── Fetch pivot + filter opts whenever applied filters change ─────────────
  useEffect(() => {
    setLoading(true);
    fetch(`/api/cheque-clearance/raw?${qs}&limit=1&offset=0`)
      .then(r => {
        if (r.status === 401) { setError("Unauthorized"); return null; }
        return r.json();
      })
      .then(d => {
        if (!d) return;
        setData({
          by_fc:       d.by_fc       ?? [],
          by_month:    d.by_month    ?? [],
          totals:      d.totals      ?? EMPTY_TOTALS,
          filter_opts: d.filter_opts ?? { fc: [], brand: [], mode: [] },
        });
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [qs]);

  const opts = data?.filter_opts;

  const activeCount =
    applied.fc.length + applied.brand.length + applied.mode.length +
    (applied.ref ? 1 : 0) + (applied.retailer ? 1 : 0) +
    (applied.dueTo && applied.dueTo !== yesterday ? 1 : 0);

  const inputStyle: React.CSSProperties = {
    background: "#fff", border: "1.5px solid #94a3b8", borderRadius: "7px",
    padding: "6px 10px", fontSize: "12px", fontWeight: 500, color: C.text1,
    boxShadow: "0 1px 3px rgba(15,23,42,0.06)", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em",
    textTransform: "uppercase", color: C.text3, marginBottom: "4px", display: "block",
  };

  if (error && error !== "Unauthorized") return (
    <div style={{ textAlign: "center", padding: "80px 0" }}>
      <p style={{ fontWeight: 700, fontSize: "16px", color: C.red }}>Could not load data</p>
      <p style={{ fontSize: "13px", color: C.text3, marginTop: "8px" }}>{error}</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: C.text1, letterSpacing: "-0.03em", margin: 0 }}>
          Cheque Clearance
        </h1>
        <p style={{ fontSize: "12px", color: C.text3, fontWeight: 500, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          Unmatched cheques · Cheque due date up to&nbsp;
          <strong style={{ color: C.text2 }}>{applied.dueTo || yesterday}</strong>
          {activeCount > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "99px", background: C.blueLight, color: C.blue, border: `1.5px solid ${C.blueBorder}` }}>
              {activeCount} filter{activeCount > 1 ? "s" : ""} active
            </span>
          )}
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ ...card, overflow: "visible", padding: "14px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
          <MultiSelect label="FC"    options={opts?.fc    ?? []} selected={draft.fc}    onChange={v => setDraft({ ...draft, fc: v })} />
          <MultiSelect label="Brand" options={opts?.brand ?? []} selected={draft.brand} onChange={v => setDraft({ ...draft, brand: v })} />
          <MultiSelect label="Mode"  options={opts?.mode  ?? []} selected={draft.mode}  onChange={v => setDraft({ ...draft, mode: v })} />
          {/* Reference search */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={labelStyle}>Reference No.</label>
            <input type="text" style={inputStyle} placeholder="Search…" value={draft.ref}
              onChange={e => setDraft({ ...draft, ref: e.target.value })}
              onKeyDown={e => { if (e.key === "Enter") setApplied({ ...draft }); }}
            />
          </div>
          {/* Retailer search */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={labelStyle}>Retailer</label>
            <input type="text" style={inputStyle} placeholder="Search…" value={draft.retailer}
              onChange={e => setDraft({ ...draft, retailer: e.target.value })}
              onKeyDown={e => { if (e.key === "Enter") setApplied({ ...draft }); }}
            />
          </div>
          {/* "As of" date — the main cutoff */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={labelStyle}>Due On or Before</label>
            <input type="date" style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
              value={draft.dueTo}
              onChange={e => setDraft({ ...draft, dueTo: e.target.value })}
            />
          </div>
          {/* Apply / Reset */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ ...labelStyle, visibility: "hidden" }}>·</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => setApplied({ ...draft })}
                style={{ background: C.blue, color: "#fff", border: "none", borderRadius: "7px", padding: "7px 20px", fontSize: "12px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 6px rgba(29,78,216,0.28)" }}
              >
                Apply
              </button>
              <button
                onClick={() => {
                  const reset: Filters = { fc: [], brand: [], mode: [], ref: "", retailer: "", dueTo: yesterday };
                  setDraft(reset);
                  setApplied(reset);
                }}
                style={{ background: "#fff", color: C.text2, border: "1.5px solid #94a3b8", borderRadius: "7px", padding: "7px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pivot tables side by side — identical structure to CDMS page */}
      <div style={{ display: "flex", gap: "16px" }}>
        <PivotTable
          label="By FC"
          dimLabel="FC"
          rows={data?.by_fc ?? []}
          totals={data?.totals ?? EMPTY_TOTALS}
          formatKey={k => k}
          loading={loading}
        />
        <PivotTable
          label="By Month (Cashier Verification Date)"
          dimLabel="Month"
          rows={data?.by_month ?? []}
          totals={data?.totals ?? EMPTY_TOTALS}
          formatKey={fmtMonth}
          loading={loading}
        />
      </div>

      {/* Raw table — shared component, infinite scroll */}
      <RawTable
        endpoint="/api/cheque-clearance/raw"
        qs={qs}
        cols={CC_COLS}
        onDownload={<DownloadButton qs={qs} />}
      />

    </div>
  );
}
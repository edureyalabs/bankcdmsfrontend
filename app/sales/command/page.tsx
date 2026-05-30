// FILE PATH: app/sales/command/page.tsx  — REPLACE EXISTING
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FcCardComp }          from "./FcCard";
import { KpiStripComp }        from "./KpiStrip";
import { ReportDetailTable }   from "./ReportDetailTable";
import { BrandSummaryTable }   from "./BrandSummaryTable";
import type { FcCard }          from "./FcCard";
import type { KpiStripData }    from "./KpiStrip";
import type { ReportRow }       from "./ReportDetailTable";
import type { BrandSummaryRow } from "./BrandSummaryTable";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CommandBrandSummaryRow {
  brand:           string;
  lake_brd_code:   string;
  sales_target:    number;
  mtd_target:      number;
  mtd_achieved:    number;
  achievement_pct: number | null;
  difference:      number;
  diff_pct:        number | null;
  status:          string;
  fc_count:        number;
}

interface CommandData {
  fc_cards:             FcCard[];
  brand_summary:        CommandBrandSummaryRow[];
  kpi:                  KpiStripData;
  from_date:            string;
  to_date:              string;
  working_days_elapsed: number;
  working_days:         number;
  config_month:         string;
  synced_at:            string;
  filter_opts: { locations: string[]; brands: string[]; fcs: string[] };
}

interface ReportData {
  rows:               ReportRow[];
  fromDate:           string;
  toDate:             string;
  syncedAt:           string;
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  cardBg:       "#ffffff", cardBorder:  "#cbd5e1",
  sectionBg:    "#f8fafc", sectionBorder:"#e2e8f0",
  text1:        "#0f172a", text2:       "#1e293b",
  text3:        "#475569", text4:       "#94a3b8",
  blue:         "#1d4ed8", blueMid:     "#2563eb",
  blueLight:    "#dbeafe", blueBorder:  "#93c5fd",
  red:          "#991b1b", redBg:       "#fee2e2", redBorder: "#fca5a5",
};

const card: React.CSSProperties = {
  background: C.cardBg, border: `1.5px solid ${C.cardBorder}`,
  borderRadius: "12px", boxShadow: "0 2px 6px rgba(15,23,42,0.07)", overflow: "visible",
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px", fontWeight: 800,
  letterSpacing: "0.08em", textTransform: "uppercase",
  color: C.text3, marginBottom: "4px", display: "block",
};
const inputStyle: React.CSSProperties = {
  background: "#fff", border: "1.5px solid #94a3b8",
  borderRadius: "7px", padding: "6px 10px",
  fontSize: "12px", fontWeight: 500, color: C.text1,
  boxShadow: "0 1px 3px rgba(15,23,42,0.06)", outline: "none",
  minWidth: "130px",
};

// ── Mapper: command API snake_case → BrandSummaryTable camelCase ──────────────
function mapBrandSummary(rows: CommandBrandSummaryRow[]): BrandSummaryRow[] {
  return rows.map(r => ({
    brand:          r.brand,
    lakeBrdCode:    r.lake_brd_code,
    salesTarget:    r.sales_target,
    mtdTarget:      r.mtd_target,
    mtdAchieved:    r.mtd_achieved,
    achievementPct: r.achievement_pct,
    difference:     r.difference,
    diffPct:        r.diff_pct,
    status:         r.status as BrandSummaryRow["status"],
    fcCount:        r.fc_count,
  }));
}

// ── MultiSelect ───────────────────────────────────────────────────────────────
function MultiSelect({
  label, options, selected, onChange,
}: {
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

  const toggle   = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  const btnLabel = selected.length === 0 ? "All"
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`;

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }}>
      <label style={labelStyle}>{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        ...inputStyle,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
        cursor: "pointer",
        fontWeight: selected.length ? 700 : 400,
        color: selected.length ? C.text1 : C.text4,
        borderColor: selected.length ? C.blueMid : "#94a3b8",
        background: selected.length ? C.blueLight : "#fff",
      }}>
        <span>{btnLabel}</span>
        <span style={{ fontSize: "8px", color: C.text3, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: "4px",
          background: "#fff", border: `1.5px solid ${C.cardBorder}`,
          borderRadius: "8px", boxShadow: "0 10px 30px rgba(15,23,42,0.14)",
          minWidth: "180px", maxHeight: "240px", overflowY: "auto", zIndex: 200,
        }}>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} style={{
              width: "100%", textAlign: "left", padding: "8px 12px",
              background: "none", border: "none",
              borderBottom: `1px solid ${C.sectionBorder}`,
              fontSize: "11px", fontWeight: 700, color: C.blueMid, cursor: "pointer",
            }}>
              ✕ Clear all
            </button>
          )}
          {options.map(opt => (
            <label key={opt} style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "7px 12px", cursor: "pointer",
              fontSize: "12px", fontWeight: 500, color: C.text1,
              borderBottom: `1px solid ${C.sectionBorder}`,
              background: selected.includes(opt) ? "#eff6ff" : "transparent",
            }}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
                style={{ accentColor: C.blueMid, width: "13px", height: "13px" }} />
              {opt}
            </label>
          ))}
          {options.length === 0 && (
            <div style={{ padding: "12px", fontSize: "12px", color: C.text4, textAlign: "center" }}>No options</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: "14px", display: "flex", alignItems: "baseline", gap: "10px" }}>
      <h2 style={{ fontSize: "15px", fontWeight: 800, color: C.text1, letterSpacing: "-0.02em", margin: 0 }}>
        {title}
      </h2>
      {sub && <span style={{ fontSize: "11px", color: C.text4, fontWeight: 500 }}>{sub}</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CommandPage() {
  const [cmdData,    setCmdData]    = useState<CommandData | null>(null);
  const [cmdLoading, setCmdLoading] = useState(true);
  const [cmdError,   setCmdError]   = useState("");

  const [rptData,    setRptData]    = useState<ReportData | null>(null);
  const [rptLoading, setRptLoading] = useState(true);
  const [rptError,   setRptError]   = useState("");

  const [draftLocs,   setDraftLocs]   = useState<string[]>([]);
  const [draftBrands, setDraftBrands] = useState<string[]>([]);
  const [draftFcs,    setDraftFcs]    = useState<string[]>([]);

  const [selLocs,   setSelLocs]   = useState<string[]>([]);
  const [selBrands, setSelBrands] = useState<string[]>([]);
  const [selFcs,    setSelFcs]    = useState<string[]>([]);

  const loadCmd = useCallback(() => {
    setCmdLoading(true); setCmdError("");
    const qs = new URLSearchParams();
    selLocs.forEach(l   => qs.append("location", l));
    selBrands.forEach(b => qs.append("brand",    b));
    selFcs.forEach(f    => qs.append("fc",       f));
    fetch(`/api/sales/command?${qs}`)
      .then(r => r.json())
      .then(d => { if (d.error) setCmdError(d.error); else setCmdData(d); setCmdLoading(false); })
      .catch(() => { setCmdError("Failed to load."); setCmdLoading(false); });
  }, [selLocs, selBrands, selFcs]);

  const loadRpt = useCallback(() => {
    setRptLoading(true); setRptError("");
    fetch("/api/sales/report")
      .then(r => r.json())
      .then(d => { if (d.error) setRptError(d.error); else setRptData(d); setRptLoading(false); })
      .catch(() => { setRptError("Failed to load report."); setRptLoading(false); });
  }, []);

  useEffect(() => { loadCmd(); }, [loadCmd]);
  useEffect(() => { loadRpt(); }, [loadRpt]);

  function applyFilters() { setSelLocs([...draftLocs]); setSelBrands([...draftBrands]); setSelFcs([...draftFcs]); }
  function resetFilters()  { setDraftLocs([]); setDraftBrands([]); setDraftFcs([]); setSelLocs([]); setSelBrands([]); setSelFcs([]); }

  const opts        = cmdData?.filter_opts ?? { locations: [], brands: [], fcs: [] };
  const kpi         = cmdData?.kpi;
  const fcCards     = cmdData?.fc_cards ?? [];
  const activeCount = selLocs.length + selBrands.length + selFcs.length;

  const brandSummaryRows: BrandSummaryRow[] = cmdData?.brand_summary
    ? mapBrandSummary(cmdData.brand_summary)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* ── Page title ───────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: C.text1, letterSpacing: "-0.03em", margin: 0 }}>
          Sales Command Centre
        </h1>
        <p style={{ fontSize: "12px", color: C.text3, fontWeight: 500, marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
          MTD actuals vs prorated targets · All sections reflect active filters
          {activeCount > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "99px", background: C.blueLight, color: C.blue, border: `1.5px solid ${C.blueBorder}` }}>
              {activeCount} filter{activeCount > 1 ? "s" : ""} active
            </span>
          )}
        </p>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
          <MultiSelect label="Location" options={opts.locations} selected={draftLocs}   onChange={setDraftLocs}   />
          <MultiSelect label="Brand"    options={opts.brands}    selected={draftBrands} onChange={setDraftBrands} />
          <MultiSelect label="FC"       options={opts.fcs}       selected={draftFcs}    onChange={setDraftFcs}    />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: "auto" }}>
            <label style={{ ...labelStyle, visibility: "hidden" }}>·</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={applyFilters} style={{ background: C.blue, color: "#fff", border: "none", borderRadius: "7px", padding: "7px 20px", fontSize: "12px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 6px rgba(29,78,216,0.28)" }}>Apply</button>
              <button onClick={resetFilters} style={{ background: "#fff", color: C.text2, border: "1.5px solid #94a3b8", borderRadius: "7px", padding: "7px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Reset</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Command loading / error ───────────────────────────────────────── */}
      {cmdLoading && <div style={{ textAlign: "center", padding: "60px 0", color: C.text4, fontSize: "13px" }}>Loading…</div>}
      {cmdError   && <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: "10px", padding: "14px 18px", fontSize: "13px", fontWeight: 600, color: C.red }}>{cmdError}</div>}

      {!cmdLoading && !cmdError && kpi && cmdData && (
        <>
          {/* ── KPI Strip ────────────────────────────────────────────────── */}
          <KpiStripComp
            kpi={kpi}
            fromDate={cmdData.from_date}
            toDate={cmdData.to_date}
            configMonth={cmdData.config_month}
            workingDaysElapsed={cmdData.working_days_elapsed}
            workingDays={cmdData.working_days}
            syncedAt={cmdData.synced_at}
          />

          {/* ── Brand Performance — MTD ───────────────────────────────────── */}
          <div>
            <SectionHeading
              title="Brand Performance — MTD"
              sub="Achievement vs prorated target · all FCs aggregated"
            />
            <BrandSummaryTable rows={brandSummaryRows} />
          </div>

          {/* ── FC Cards ─────────────────────────────────────────────────── */}
          <div>
            <SectionHeading
              title="FC Status — MTD"
              sub="Sorted: Healthy → Watch → Critical · brand breakdown inside"
            />
            {fcCards.length === 0 ? (
              <div style={{ ...card, overflow: "hidden", padding: "40px", textAlign: "center", color: C.text4, fontSize: "13px" }}>
                No FC data for the selected filters.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "18px" }}>
                {fcCards.map(fc => <FcCardComp key={`fc__${fc.fc}`} fc={fc} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Report table — FC · Brand Detail, always full data ───────────── */}
      {rptError && (
        <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: "10px", padding: "14px 18px", fontSize: "13px", fontWeight: 600, color: C.red }}>
          {rptError}
        </div>
      )}

      {rptLoading && !rptError && (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.text4, fontSize: "13px" }}>
          Loading report data…
        </div>
      )}

      {!rptLoading && !rptError && rptData && (
        <div>
          <SectionHeading
            title="FC · Brand Detail — MTD"
            sub="Every target row · click column headers to sort"
          />
          <ReportDetailTable
            rows={rptData.rows}
            syncedAt={rptData.syncedAt}
            fromDate={rptData.fromDate}
            toDate={rptData.toDate}
          />
        </div>
      )}

    </div>
  );
}
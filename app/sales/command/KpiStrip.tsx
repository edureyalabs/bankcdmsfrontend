// FILE PATH: app/sales/command/KpiStrip.tsx
"use client";

import React from "react";

export interface KpiStripData {
  total_net:        number;
  total_target:     number;
  total_mtd_target: number;
  achievement_pct:  number | null;
  total_bills:      number;
  total_lines:      number;
  total_outlets:    number;
  total_sku_count:  number;
  salesman_count:   number;
  fc_count:         number;
  healthy:          number;
  watch:            number;
  critical:         number;
  lines_per_bill:   number | null;
}

const C = {
  text1: "#0f172a", text2: "#1e293b", text3: "#475569", text4: "#94a3b8",
  green: "#15803d", greenBg: "#dcfce7",
  amber: "#92400e", amberBg: "#fef3c7",
  red:   "#991b1b", redBg:   "#fee2e2",
  border: "#e2e8f0", cardBg: "#ffffff", sectionBg: "#f8fafc",
};

const fmtShort = (n: number): string => {
  if (n === 0)         return "—";
  if (n >= 10_000_000) return "₹" + (n / 10_000_000).toFixed(1) + "Cr";
  if (n >= 1_00_000)   return "₹" + (n / 1_00_000).toFixed(1) + "L";
  return "₹" + Math.round(n).toLocaleString("en-IN");
};
const fmtNum = (n: number) => n.toLocaleString("en-IN");

export function KpiStripComp({
  kpi, fromDate, toDate, configMonth, workingDaysElapsed, workingDays, syncedAt,
}: {
  kpi: KpiStripData; fromDate: string; toDate: string;
  configMonth: string; workingDaysElapsed: number; workingDays: number; syncedAt: string;
}) {
  const pct      = kpi.achievement_pct;
  const pctColor = pct === null ? C.text4 : pct >= 90 ? C.green : pct >= 60 ? C.amber : C.red;
  const pctLabel = pct === null ? undefined
    : pct >= 90 ? `↑ ${pct.toFixed(1)}% vs target`
    : pct >= 60 ? `${pct.toFixed(1)}% — at risk`
    : `↓ ${pct.toFixed(1)}% — below target`;

  const stats: { label: string; value: string; sub?: string; subColor?: string }[] = [
    { label: "MTD Net Sales",    value: fmtShort(kpi.total_net),           sub: pctLabel,                           subColor: pctColor },
    { label: "MTD Target",       value: fmtShort(kpi.total_mtd_target),    sub: `Monthly: ${fmtShort(kpi.total_target)}` },
    { label: "Total Bills",      value: fmtNum(kpi.total_bills),           sub: `${fmtNum(kpi.total_lines)} lines` },
    { label: "Lines / Bill",     value: kpi.lines_per_bill?.toFixed(1) ?? "—", sub: "avg per invoice" },
    { label: "Outlets Covered",  value: fmtNum(kpi.total_outlets),         sub: "unique retailers"  },
    { label: "Active Reps",      value: fmtNum(kpi.salesman_count),        sub: `${kpi.fc_count} FCs` },
  ];

  return (
    <div style={{ background: C.cardBg, border: `1.5px solid ${C.border}`, borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }}>
      {/* Stats row — borderless dividers */}
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{
            padding: "16px 22px", flex: "1 1 120px", minWidth: "110px",
            borderRight: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "5px" }}>
              {s.label}
            </div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: C.text1, letterSpacing: "-0.04em", lineHeight: 1 }}>
              {s.value}
            </div>
            {s.sub && (
              <div style={{ fontSize: "11px", fontWeight: 600, color: s.subColor ?? C.text4, marginTop: "4px" }}>
                {s.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Meta bar */}
      <div style={{
        background: C.sectionBg, padding: "8px 22px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px",
      }}>
        <span style={{ fontSize: "11px", color: C.text3, fontWeight: 500 }}>
          <b style={{ color: C.text2 }}>{configMonth}</b>{"  ·  "}
          MTD <b style={{ color: C.text2 }}>{fromDate}</b>{" → "}<b style={{ color: C.text2 }}>{toDate}</b>{"  ·  "}
          <b style={{ color: C.text2 }}>{workingDaysElapsed}</b>{" / "}<b style={{ color: C.text2 }}>{workingDays}</b>{" working days"}
          {syncedAt ? <span style={{ color: C.text4 }}>{"  ·  "}synced {syncedAt.slice(0, 16)}</span> : null}
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          {([["Healthy", kpi.healthy, C.green, C.greenBg, "#86efac"], ["Watch", kpi.watch, C.amber, C.amberBg, "#fcd34d"], ["Critical", kpi.critical, C.red, C.redBg, "#fca5a5"]] as [string,number,string,string,string][]).map(([lbl,cnt,color,bg,border]) => (
            <span key={lbl} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: bg, color, border: `1px solid ${border}`, fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "99px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
              {cnt} {lbl}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
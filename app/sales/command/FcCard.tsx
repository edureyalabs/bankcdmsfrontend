// FILE PATH: app/sales/command/FcCard.tsx
"use client";

import React, { useState, useEffect } from "react";
import { FcCardBack } from "./FcCardBack";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Health = "Healthy" | "Watch" | "Critical" | "No Target";

export interface BrandRow {
  brand:           string;
  lake_brd_code:   string;
  sales_target:    number;
  mtd_target:      number;
  mtd_achieved:    number;
  achievement_pct: number | null;
  difference:      number;
  health:          Health;
}

export interface FcCard {
  fc:               string;
  lake_fc_codes:    string[];
  location:         string;
  total_target:     number;
  total_mtd_target: number;
  total_achieved:   number;
  achievement_pct:  number | null;
  health:           Health;
  brands:           BrandRow[];
  salesman_count:   number;
  bills:            number;
  lines:            number;
  outlets:          number;
  sku_count:        number;
}

// ── Color system ──────────────────────────────────────────────────────────────
const C = {
  cardBg:       "#ffffff",
  cardBorder:   "#cbd5e1",
  sectionBg:    "#f8fafc",
  sectionBorder:"#e2e8f0",
  text1:        "#0f172a",
  text2:        "#1e293b",
  text3:        "#475569",
  text4:        "#94a3b8",
  green:        "#15803d", greenBg: "#dcfce7", greenBorder: "#86efac",
  amber:        "#92400e", amberBg: "#fef3c7", amberBorder: "#fcd34d",
  red:          "#991b1b", redBg:   "#fee2e2", redBorder:   "#fca5a5",
  noTarget:     "#475569", noTargetBg: "#f1f5f9", noTargetBorder: "#cbd5e1",
  blue:         "#2563eb", bluePale: "#dbeafe",
};

const BRAND_COLORS = [
  "#2563eb","#7c3aed","#0891b2","#0d9488","#4f46e5",
  "#be185d","#65a30d","#ea580c","#6366f1","#0369a1",
  "#a21caf","#0f766e","#c2410c","#4338ca","#0c4a6e",
];

function healthCfg(h: Health) {
  if (h === "Healthy")   return { color: C.green, bg: C.greenBg, border: C.greenBorder, bar: "#16a34a" };
  if (h === "Watch")     return { color: C.amber, bg: C.amberBg, border: C.amberBorder, bar: "#d97706" };
  if (h === "Critical")  return { color: C.red,   bg: C.redBg,   border: C.redBorder,   bar: "#dc2626" };
  return { color: C.noTarget, bg: C.noTargetBg, border: C.noTargetBorder, bar: "#94a3b8" };
}

function pctToHealth(pct: number | null): Health {
  if (pct === null) return "No Target";
  if (pct >= 90)   return "Healthy";
  if (pct >= 70)   return "Watch";
  return "Critical";
}

// ── Flip keyframe injection (once) ────────────────────────────────────────────
const FLIP_STYLE_ID = "fc-card-flip-style";
function ensureFlipStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FLIP_STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = FLIP_STYLE_ID;
  el.textContent = `
    .fc-flip-inner {
      transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
      transform-style: preserve-3d;
      position: relative;
      width: 100%;
      height: 100%;
    }
    .fc-flip-inner.flipped {
      transform: rotateY(180deg);
    }
    .fc-flip-face {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      overflow: hidden;
    }
    .fc-flip-back {
      transform: rotateY(180deg);
    }
    .reps-btn:hover {
      background: #dbeafe !important;
      color: #2563eb !important;
      border-color: #2563eb !important;
      cursor: pointer;
    }
  `;
  document.head.appendChild(el);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Bar({ pct, color, height = 5 }: { pct: number | null; color: string; height?: number }) {
  const w = Math.min(100, Math.max(0, pct ?? 0));
  return (
    <div style={{ width: "100%", height, borderRadius: 99, background: C.sectionBorder, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.3s" }} />
    </div>
  );
}

// ── Front face ────────────────────────────────────────────────────────────────
function FcCardFront({
  fc, onFlip,
}: { fc: FcCard; onFlip: () => void }) {
  const cfg   = healthCfg(fc.health);
  const pct   = fc.achievement_pct;
  const gap   = fc.total_achieved - fc.total_mtd_target;
  const lbill = fc.bills > 0 ? (fc.lines / fc.bills).toFixed(1) : "—";

  const activeBrands = fc.brands.filter(b => b.sales_target > 0 || b.mtd_achieved > 0);

  const fmtShort = (n: number) => {
    if (n === 0)         return "—";
    if (n >= 10_000_000) return "₹" + (n / 10_000_000).toFixed(1) + "Cr";
    if (n >= 1_00_000)   return "₹" + (n / 1_00_000).toFixed(1) + "L";
    return "₹" + Math.round(n).toLocaleString("en-IN");
  };
  const fmtN = (n: number) => n.toLocaleString("en-IN");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.cardBg }}>

      {/* ── Section 1: Header (fixed) ────────────────────────────────── */}
      <div style={{ padding: "14px 16px 12px", flexShrink: 0 }}>

        {/* FC name + health badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: C.text1, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {fc.fc}
            </div>
            <div style={{ fontSize: "10px", color: C.text4, marginTop: "2px", fontWeight: 500 }}>
              {fc.location}
              {fc.lake_fc_codes.length > 0 && (
                <span style={{ fontFamily: "monospace", marginLeft: "5px" }}>
                  · {fc.lake_fc_codes.join(", ")}
                </span>
              )}
            </div>
          </div>
          <span style={{
            background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.border}`,
            fontSize: "10px", fontWeight: 800, padding: "3px 9px",
            borderRadius: "99px", whiteSpace: "nowrap", letterSpacing: "0.04em",
            flexShrink: 0, marginLeft: "8px",
          }}>
            {fc.health}
          </span>
        </div>

        {/* MTD achieved + pct */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "7px" }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: C.text1, letterSpacing: "-0.04em", lineHeight: 1 }}>
              {fmtShort(fc.total_achieved)}
            </div>
            <div style={{ fontSize: "10px", color: C.text4, marginTop: "2px", fontWeight: 500 }}>
              target {fmtShort(fc.total_mtd_target)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: cfg.color, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {pct !== null ? pct.toFixed(1) + "%" : "—"}
            </div>
            <div style={{ fontSize: "10px", fontWeight: 700, marginTop: "2px", color: gap >= 0 ? C.green : C.red }}>
              {gap >= 0 ? "+" : "−"}{fmtShort(Math.abs(gap))}
            </div>
          </div>
        </div>

        {/* FC progress bar */}
        <Bar pct={pct} color={cfg.bar} height={5} />

        {/* Operational stats grid — Reps is clickable */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
          gap: 0, marginTop: "12px",
          border: `1px solid ${C.sectionBorder}`,
          borderRadius: "8px", overflow: "hidden",
          background: C.sectionBg,
        }}>
          {([
            { lbl: "Bills",   val: fmtN(fc.bills),            clickable: false },
            { lbl: "Lines",   val: fmtN(fc.lines),            clickable: false },
            { lbl: "L/Bill",  val: lbill,                     clickable: false },
            { lbl: "Outlets", val: fmtN(fc.outlets),          clickable: false },
            { lbl: "Reps",    val: fmtN(fc.salesman_count),   clickable: true  },
          ]).map(({ lbl, val, clickable }, i, arr) => (
            <div
              key={lbl}
              className={clickable ? "reps-btn" : ""}
              onClick={clickable ? onFlip : undefined}
              title={clickable ? "Click to view salesmen" : undefined}
              style={{
                textAlign: "center", padding: "7px 4px",
                borderRight: i < arr.length - 1 ? `1px solid ${C.sectionBorder}` : "none",
                transition: "all 0.15s",
                background: clickable ? "transparent" : "transparent",
                borderRadius: i === arr.length - 1 ? "0 8px 8px 0" : undefined,
                position: "relative",
              }}
            >
              <div style={{
                fontSize: "8px", fontWeight: 700, color: clickable ? C.blue : C.text4,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                {lbl} {clickable && <span style={{ fontSize: "7px" }}>↗</span>}
              </div>
              <div style={{
                fontSize: "13px", fontWeight: 800,
                color: clickable ? C.blue : C.text1,
                marginTop: "2px", letterSpacing: "-0.01em",
              }}>
                {val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: Brand rows (scrollable) ──────────────────────── */}
      <div style={{
        borderTop: `1px solid ${C.sectionBorder}`,
        flex: 1,
        overflowY: "auto",
        minHeight: "100px",
        scrollbarWidth: "thin",
        scrollbarColor: `${C.cardBorder} transparent`,
      }}>
        {/* Sticky label */}
        <div style={{
          position: "sticky", top: 0, zIndex: 2,
          background: C.sectionBg,
          borderBottom: `1px solid ${C.sectionBorder}`,
          padding: "6px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: "9px", fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Brand MTD
          </span>
          <span style={{ fontSize: "9px", color: C.text4, fontWeight: 500 }}>
            {activeBrands.length} brand{activeBrands.length !== 1 ? "s" : ""}
          </span>
        </div>

        {activeBrands.length === 0 ? (
          <div style={{ padding: "20px 16px", textAlign: "center", fontSize: "11px", color: C.text4 }}>
            No brand data
          </div>
        ) : (
          activeBrands.map((b, i) => {
            const bCfg  = healthCfg(pctToHealth(b.achievement_pct));
            const bGap  = b.mtd_achieved - b.mtd_target;
            const bColor = BRAND_COLORS[i % BRAND_COLORS.length];
            const hasTarget = b.mtd_target > 0;
            return (
              <div key={`${fc.fc}__${b.brand}`} style={{
                padding: "9px 16px",
                borderBottom: `1px solid ${C.sectionBorder}`,
                background: C.cardBg,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasTarget ? "5px" : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: bColor, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: C.text2 }}>{b.brand}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: C.text1 }}>
                      {fmtShort(b.mtd_achieved)}
                    </span>
                    {hasTarget && b.achievement_pct !== null && (
                      <span style={{
                        fontSize: "10px", fontWeight: 700,
                        color: bCfg.color, background: bCfg.bg,
                        border: `1px solid ${bCfg.border}`,
                        padding: "1px 6px", borderRadius: "99px", minWidth: "36px", textAlign: "center",
                      }}>
                        {b.achievement_pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                {hasTarget && (
                  <>
                    <Bar pct={b.achievement_pct} color={bCfg.bar} height={3} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
                      <span style={{ fontSize: "9px", color: C.text4, fontWeight: 500 }}>
                        of {fmtShort(b.mtd_target)}
                      </span>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: bGap >= 0 ? C.green : C.red }}>
                        {bGap >= 0 ? "+" : "−"}{fmtShort(Math.abs(bGap))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Exported wrapper with flip ────────────────────────────────────────────────
export function FcCardComp({ fc }: { fc: FcCard }) {
  const [flipped, setFlipped] = useState(false);
  const cfg = healthCfg(fc.health);

  useEffect(() => { ensureFlipStyle(); }, []);

  return (
    <div style={{
      perspective: "1200px",
      height: "480px",           // fixed height — both faces identical
      minWidth: 0,
    }}>
      <div className={`fc-flip-inner${flipped ? " flipped" : ""}`}>

        {/* ── Front face ─────────────────────────────────────────────── */}
        <div
          className="fc-flip-face"
          style={{
            border: `1.5px solid ${C.cardBorder}`,
            borderTop: `3px solid ${cfg.bar}`,
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)",
          }}
        >
          <FcCardFront fc={fc} onFlip={() => setFlipped(true)} />
        </div>

        {/* ── Back face ──────────────────────────────────────────────── */}
        <div
          className="fc-flip-face fc-flip-back"
          style={{
            border: `1.5px solid ${C.blue}`,
            borderTop: `3px solid ${C.blue}`,
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(37,99,235,0.12), 0 4px 16px rgba(37,99,235,0.08)",
          }}
        >
          <FcCardBack fcName={fc.fc} onFlipBack={() => setFlipped(false)} />
        </div>

      </div>
    </div>
  );
}
"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const PAGE = 100;

const C = {
  cardBg: "#ffffff", cardBorder: "#cbd5e1",
  headerBg: "#1e293b", headerText: "#e2e8f0",
  sectionBg: "#f8fafc", sectionBorder: "#e2e8f0",
  rowOdd: "#ffffff", rowEven: "#f8fafc", rowHover: "#eff6ff",
  green: "#15803d", amber: "#92400e", red: "#991b1b",
  text1: "#0f172a", text2: "#1e293b", text3: "#475569", text4: "#94a3b8",
  blue: "#1d4ed8",
};

const card: React.CSSProperties = {
  background: C.cardBg,
  border: `1.5px solid ${C.cardBorder}`,
  borderRadius: "12px",
  boxShadow: "0 2px 6px rgba(15,23,42,0.07), 0 8px 24px rgba(15,23,42,0.04)",
  overflow: "hidden",
};

const fmt      = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmtCount = (n: number) => Number(n).toLocaleString("en-IN");

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  "Full Match":    { color: C.green, bg: "#f0fdf4" },
  "Partial Match": { color: C.amber, bg: "#fffbeb" },
  "Unmatched":     { color: C.red,   bg: "#fef2f2" },
};

export interface ColDef {
  key: string;
  label: string;
  amt?: boolean;
  wide?: boolean;
}

interface RawRow { [key: string]: string | number | null; }
interface RawResponse { rows: RawRow[]; total: number; hasMore: boolean; }

// Module-level cache — keyed by "endpoint::qs"
interface CacheEntry { rows: RawRow[]; total: number; hasMore: boolean; offset: number; }
const rawCache = new Map<string, CacheEntry>();

export function invalidateRawCache(endpoint: string) {
  for (const key of rawCache.keys()) {
    if (key.startsWith(endpoint + "::")) rawCache.delete(key);
  }
}

interface Props {
  endpoint:   string;
  qs:         string;
  cols:       ColDef[];
  onDownload: React.ReactNode;
}

export default function RawTable({ endpoint, qs, cols, onDownload }: Props) {
  const cacheKey = `${endpoint}::${qs}`;

  const [rows,        setRows]        = useState<RawRow[]>([]);
  const [total,       setTotal]       = useState(0);
  const [hasMore,     setHasMore]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const offsetRef   = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const amtKeys     = new Set(cols.filter(c => c.amt).map(c => c.key));

  // ── Initial load — always bust cache so data is always fresh ──────────────
  useEffect(() => {
    rawCache.delete(cacheKey);          // <── key fix: no stale cache
    offsetRef.current = 0;
    setRows([]);
    setTotal(0);
    setHasMore(false);
    setLoading(true);

    fetch(`${endpoint}?limit=${PAGE}&offset=0` + (qs ? "&" + qs : ""))
      .then(r => r.json())
      .then((d: RawResponse) => {
        const fetchedRows = d.rows    ?? [];
        const fetchedTotal = d.total  ?? 0;
        const fetchedMore  = d.hasMore ?? false;

        setRows(fetchedRows);
        setTotal(fetchedTotal);
        setHasMore(fetchedMore);
        setLoading(false);
        offsetRef.current = fetchedRows.length;

        rawCache.set(cacheKey, {
          rows: fetchedRows, total: fetchedTotal,
          hasMore: fetchedMore, offset: fetchedRows.length,
        });
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // ── Load more (infinite scroll) ───────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    fetch(`${endpoint}?limit=${PAGE}&offset=${offsetRef.current}` + (qs ? "&" + qs : ""))
      .then(r => r.json())
      .then((d: RawResponse) => {
        const newRows = d.rows ?? [];
        setRows(prev => {
          const merged = [...prev, ...newRows];
          rawCache.set(cacheKey, {
            rows:    merged,
            total:   d.total   ?? total,
            hasMore: d.hasMore ?? false,
            offset:  offsetRef.current + newRows.length,
          });
          return merged;
        });
        setHasMore(d.hasMore ?? false);
        offsetRef.current += newRows.length;
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, hasMore, loadingMore]);

  // ── Intersection observer for infinite scroll ─────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", height: "480px" }}>

      {/* Toolbar */}
      <div style={{
        padding: "10px 16px",
        background: C.sectionBg,
        borderBottom: `1.5px solid ${C.sectionBorder}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em",
            textTransform: "uppercase", color: C.text2,
          }}>
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
        {onDownload}
      </div>

      {/* Body */}
      <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: "13px" }}>
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.text4, fontSize: "13px" }}>
            No data
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "max-content" }}>
              <thead>
                <tr>
                  {cols.map(c => (
                    <th key={c.key} style={{
                      background: C.headerBg, color: C.headerText,
                      fontSize: "10px", fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      textAlign: c.amt ? "right" : "left",
                      padding: "9px 12px", whiteSpace: "nowrap",
                      position: "sticky", top: 0, zIndex: 10,
                      borderBottom: "2px solid #0f172a",
                    }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const bg = i % 2 === 0 ? C.rowOdd : C.rowEven;
                  return (
                    <tr
                      key={i}
                      style={{
                        background: bg,
                        borderBottom: `1px solid ${C.sectionBorder}`,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = bg)}
                    >
                      {cols.map(c => {
                        const val      = row[c.key];
                        const isStatus = c.key === "Match_Status";
                        const isAmt    = amtKeys.has(c.key);
                        const display  = val == null || val === ""
                          ? "—"
                          : isAmt ? fmt(Number(val)) : String(val);
                        const sc = isStatus ? STATUS_STYLE[String(val)] : null;
                        return (
                          <td
                            key={c.key}
                            title={String(val ?? "")}
                            style={{
                              padding: "7px 12px",
                              textAlign: isAmt ? "right" : "left",
                              maxWidth: c.wide ? "260px" : "180px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "12px",
                              color:      sc ? sc.color : isAmt ? C.text1 : C.text2,
                              fontWeight: isStatus ? 700 : isAmt ? 600 : 500,
                              background: sc ? sc.bg : "transparent",
                            }}
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

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
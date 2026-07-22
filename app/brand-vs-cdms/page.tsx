"use client";
// FILE PATH: bank_cdms_dashboard/app/brand-vs-cdms/page.tsx — REPLACE EXISTING

import { useEffect, useState } from "react";

interface FoldersResponse {
  root?: string;
  folders?: string[];
  error?: string;
}

interface FcOption {
  folderName: string;
  fcId: number;
}

interface FcsResponse {
  brandFolder?: string;
  brandId?: number;
  fcs?: FcOption[];
  error?: string;
}

interface InvoiceRow {
  invoiceNo: string;
  brandCollection: number | null;
  cdmsTotalCollection: number | null;
  cdmsAdjustedCollection: number | null;
  excludedCdmsAmount: number | null;
  netDifference: number;
}

interface FcSummary {
  brandCollectionTotal: number;
  cdmsTotalCollectionTotal: number;
  cdmsAdjustedCollectionTotal: number;
  pendingChequeValue: number;
  excessCollectionValue: number;
  shortCollectionValue: number;
  netDifference: number;
  netDifferenceSign: "+" | "-" | "0";
  invoiceCount: number;
}

interface RunResponse {
  fileCount?: number;
  resolvedFromDate?: string;
  resolvedToDate?: string;
  summary?: FcSummary;
  invoices?: InvoiceRow[];
  error?: string;
}

interface FcRowResult {
  fcName: string;
  summary?: FcSummary;
  resolvedFromDate?: string;
  resolvedToDate?: string;
  fileCount?: number;
  error?: string;
}

interface RunAllResponse {
  brandFolder?: string;
  fcCount?: number;
  succeededCount?: number;
  failedCount?: number;
  results?: FcRowResult[];
  grandTotal?: FcSummary;
  error?: string;
}

interface CachedRunResponse {
  brandFolder?: string;
  cached?: {
    results: FcRowResult[];
    grandTotal: FcSummary;
    runAt: string;
    fcCount: number;
    succeededCount: number;
    failedCount: number;
  } | null;
  error?: string;
}

function fmtMoney(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateInput(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function BrandVsCdmsPage() {
  const [brands, setBrands] = useState<string[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsError, setBrandsError] = useState<string | null>(null);

  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [fcs, setFcs] = useState<FcOption[]>([]);
  const [fcsLoading, setFcsLoading] = useState(false);
  const [fcsError, setFcsError] = useState<string | null>(null);

  const [selectedFc, setSelectedFc] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FcSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [fileCount, setFileCount] = useState<number | null>(null);

  const [downloading, setDownloading] = useState<"fc" | "all" | null>(null);

  // Brand-level "run all FCs" state
  const [runningAll, setRunningAll] = useState(false);
  const [runAllError, setRunAllError] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<FcRowResult[]>([]);
  const [grandTotal, setGrandTotal] = useState<FcSummary | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);

  useEffect(() => {
    fetch("/api/brand-vs-cdms/folders")
      .then(r => r.json())
      .then((d: FoldersResponse) => {
        if (d.error) setBrandsError(d.error);
        else setBrands(d.folders ?? []);
      })
      .catch(() => setBrandsError("Failed to reach server"))
      .finally(() => setBrandsLoading(false));
  }, []);

  const handleSelectBrand = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedFc(null);
    setSummary(null);
    setInvoices([]);
    setRunError(null);
    setFcs([]);
    setFcsLoading(true);
    setFcsError(null);
    setAllResults([]);
    setGrandTotal(null);
    setRunAllError(null);
    setLastRunAt(null);

    fetch(`/api/brand-vs-cdms/subfolders?brand=${encodeURIComponent(brand)}`)
      .then(r => r.json())
      .then((d: FcsResponse) => {
        if (d.error) setFcsError(d.error);
        else setFcs(d.fcs ?? []);
      })
      .catch(() => setFcsError("Failed to reach server"))
      .finally(() => setFcsLoading(false));

    // Load last cached run for this brand, if one exists, so results show
    // instantly without waiting for a fresh Run.
    setLoadingCache(true);
    fetch(`/api/brand-vs-cdms/run-all?brand=${encodeURIComponent(brand)}`)
      .then(r => r.json())
      .then((d: CachedRunResponse) => {
        if (d.cached) {
          setAllResults(d.cached.results ?? []);
          setGrandTotal(d.cached.grandTotal ?? null);
          setLastRunAt(d.cached.runAt ?? null);
        }
      })
      .catch(() => {
        // Cache load failures are non-fatal — just means no instant
        // results until the user clicks Run.
      })
      .finally(() => setLoadingCache(false));
  };

  const handleSelectFc = (fcName: string) => {
    setSelectedFc(fcName);
    setSummary(null);
    setInvoices([]);
    setRunError(null);
    setFromDate("");
    setToDate("");
    setAllResults([]);
    setGrandTotal(null);
  };

  const handleBackToBrand = () => {
    setSelectedFc(null);
    setSummary(null);
    setInvoices([]);
    setRunError(null);
  };

  const handleRunAll = () => {
    if (!selectedBrand) return;
    setRunningAll(true);
    setRunAllError(null);
    setAllResults([]);
    setGrandTotal(null);

    fetch("/api/brand-vs-cdms/run-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandFolder: selectedBrand }),
    })
      .then(r => r.json())
      .then((d: RunAllResponse) => {
        if (d.error) {
          setRunAllError(d.error);
          return;
        }
        setAllResults(d.results ?? []);
        setGrandTotal(d.grandTotal ?? null);
        setLastRunAt(new Date().toISOString());
      })
      .catch(() => setRunAllError("Failed to reach server"))
      .finally(() => setRunningAll(false));
  };

  const handleRun = () => {
    if (!selectedBrand || !selectedFc) return;
    setRunning(true);
    setRunError(null);

    fetch("/api/brand-vs-cdms/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandFolder: selectedBrand,
        fcFolder: selectedFc,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    })
      .then(r => r.json())
      .then((d: RunResponse) => {
        if (d.error) {
          setRunError(d.error);
          return;
        }
        setSummary(d.summary ?? null);
        setInvoices(d.invoices ?? []);
        setFileCount(d.fileCount ?? null);
        if (!fromDate) setFromDate(fmtDateInput(d.resolvedFromDate));
        if (!toDate) setToDate(fmtDateInput(d.resolvedToDate));
      })
      .catch(() => setRunError("Failed to reach server"))
      .finally(() => setRunning(false));
  };

  const handleDownload = async (scope: "fc" | "all") => {
    if (!selectedBrand) return;
    if (scope === "fc" && !selectedFc) return;

    setDownloading(scope);
    try {
      const params = new URLSearchParams({ brand: selectedBrand });
      if (scope === "fc" && selectedFc) params.set("fc", selectedFc);

      const res = await fetch(`/api/brand-vs-cdms/download?${params.toString()}`);

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Download failed");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        scope === "fc"
          ? `${selectedBrand}_${selectedFc}_report.xlsx`
          : `${selectedBrand}_all_fc_report.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const cardStyle: React.CSSProperties = {
    flex: 1,
    minWidth: "160px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "14px 16px",
  };

  const cardLabel: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "6px",
  };

  const cardValue = (color: string): React.CSSProperties => ({
    fontSize: "20px",
    fontWeight: 800,
    color,
  });

  return (
    <div style={{ display: "flex", gap: "16px", minHeight: "calc(100vh - 92px)" }}>

      <div style={{ width: "300px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px" }}>
          <div style={{
            fontSize: "11px", fontWeight: 700, color: "#64748b",
            textTransform: "uppercase", letterSpacing: "0.04em",
            marginBottom: "10px", padding: "0 4px",
          }}>
            Brands {brands.length > 0 && `(${brands.length})`}
          </div>

          {brandsLoading && <div style={{ fontSize: "13px", color: "#94a3b8", padding: "4px" }}>Loading…</div>}
          {brandsError && (
            <div style={{ fontSize: "12px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "8px" }}>
              {brandsError}
            </div>
          )}
          {!brandsLoading && !brandsError && brands.map(brand => {
            const isActive = brand === selectedBrand;
            return (
              <button
                key={brand}
                onClick={() => handleSelectBrand(brand)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 10px", marginBottom: "4px", borderRadius: "6px",
                  border: "none", cursor: "pointer", fontSize: "13px",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#1d4ed8" : "#334155",
                  background: isActive ? "#eff6ff" : "transparent",
                }}
              >
                {brand}
              </button>
            );
          })}
        </div>

        {selectedBrand && (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px" }}>
            <div style={{
              fontSize: "11px", fontWeight: 700, color: "#64748b",
              textTransform: "uppercase", letterSpacing: "0.04em",
              marginBottom: "10px", padding: "0 4px",
            }}>
              FCs {fcs.length > 0 && `(${fcs.length})`}
            </div>

            {fcsLoading && <div style={{ fontSize: "13px", color: "#94a3b8", padding: "4px" }}>Loading…</div>}
            {fcsError && (
              <div style={{ fontSize: "12px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "8px" }}>
                {fcsError}
              </div>
            )}
            {!fcsLoading && !fcsError && fcs.length === 0 && (
              <div style={{ fontSize: "13px", color: "#94a3b8", padding: "4px" }}>No configured FCs found.</div>
            )}
            {!fcsLoading && !fcsError && fcs.map(fc => {
              const isActive = fc.folderName === selectedFc;
              return (
                <button
                  key={fc.folderName}
                  onClick={() => handleSelectFc(fc.folderName)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 10px", marginBottom: "4px", borderRadius: "6px",
                    border: "none", cursor: "pointer", fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#1d4ed8" : "#334155",
                    background: isActive ? "#eff6ff" : "transparent",
                  }}
                >
                  {fc.folderName}
                </button>
              );
            })}

            {fcs.length > 0 && (
              <>
                <button
                  onClick={handleRunAll}
                  disabled={runningAll}
                  style={{
                    marginTop: "10px", width: "100%", padding: "8px",
                    borderRadius: "7px", border: "none",
                    background: "#2563eb", color: "#ffffff",
                    fontSize: "12px", fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {runningAll ? "Running…" : "Run all FCs"}
                </button>
                <button
                  onClick={() => handleDownload("all")}
                  disabled={downloading !== null}
                  style={{
                    marginTop: "8px", width: "100%", padding: "8px",
                    borderRadius: "7px", border: "1px solid #cbd5e1",
                    background: "#f8fafc", color: "#334155",
                    fontSize: "12px", fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {downloading === "all" ? "Preparing…" : "Download All FCs"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>

        {!selectedBrand && (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "24px", fontSize: "14px", color: "#94a3b8" }}>
            Select a brand to run the collection report — all FCs at once, or drill into one.
          </div>
        )}

        {selectedBrand && !selectedFc && (
          <>
            <div style={{
              background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px",
              padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
            }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>{selectedBrand}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                  All FCs · date range auto-resolved per FC from uploaded files
                </div>
                {loadingCache && (
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Loading last run…</div>
                )}
                {!loadingCache && lastRunAt && (
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                    Last run: {new Date(lastRunAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                )}
              </div>
              <button onClick={handleRunAll} disabled={runningAll} style={{
                padding: "8px 18px", borderRadius: "7px", border: "none",
                background: "#2563eb", color: "#ffffff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
              }}>
                {runningAll ? "Running…" : "Run all FCs"}
              </button>
            </div>

            {runAllError && (
              <div style={{ fontSize: "13px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px" }}>
                {runAllError}
              </div>
            )}

            {allResults.length > 0 && (
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["FC Name", "Total CDMS", "Pending Cheque", "CDMS Adj.", "Brand Collection", "Excess", "Short", "Net Difference"].map((h, i) => (
                        <th key={h} style={{
                          textAlign: i === 0 ? "left" : "right",
                          padding: "10px 14px", fontSize: "11px", fontWeight: 700,
                          color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em",
                          borderBottom: "1px solid #e2e8f0",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allResults.map(row => {
                      if (row.error) {
                        return (
                          <tr key={row.fcName} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "9px 14px", color: "#334155", fontWeight: 600 }}>{row.fcName}</td>
                            <td colSpan={7} style={{ padding: "9px 14px", color: "#dc2626", fontSize: "12px" }}>
                              {row.error}
                            </td>
                          </tr>
                        );
                      }
                      const s = row.summary!;
                      return (
                        <tr
                          key={row.fcName}
                          onClick={() => handleSelectFc(row.fcName)}
                          style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "9px 14px", color: "#1d4ed8", fontWeight: 600 }}>{row.fcName}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", color: "#334155" }}>{fmtMoney(s.cdmsTotalCollectionTotal)}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", color: "#f59e0b" }}>{s.pendingChequeValue ? fmtMoney(s.pendingChequeValue) : "—"}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", color: "#334155" }}>{fmtMoney(s.cdmsAdjustedCollectionTotal)}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", color: "#334155" }}>{fmtMoney(s.brandCollectionTotal)}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", color: "#16a34a" }}>{s.excessCollectionValue ? fmtMoney(s.excessCollectionValue) : "—"}</td>
                          <td style={{ padding: "9px 14px", textAlign: "right", color: "#dc2626" }}>{s.shortCollectionValue ? fmtMoney(s.shortCollectionValue) : "—"}</td>
                          <td style={{
                            padding: "9px 14px", textAlign: "right", fontWeight: 600,
                            color: s.netDifference > 0 ? "#16a34a" : s.netDifference < 0 ? "#dc2626" : "#334155",
                          }}>
                            {s.netDifference > 0 ? "+" : s.netDifference < 0 ? "−" : ""}{fmtMoney(Math.abs(s.netDifference))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {grandTotal && (
                    <tfoot>
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td style={{ padding: "10px 14px", borderTop: "2px solid #cbd5e1", color: "#0f172a" }}>Grand Total</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", borderTop: "2px solid #cbd5e1", color: "#0f172a" }}>{fmtMoney(grandTotal.cdmsTotalCollectionTotal)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", borderTop: "2px solid #cbd5e1", color: "#f59e0b" }}>{fmtMoney(grandTotal.pendingChequeValue)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", borderTop: "2px solid #cbd5e1", color: "#0f172a" }}>{fmtMoney(grandTotal.cdmsAdjustedCollectionTotal)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", borderTop: "2px solid #cbd5e1", color: "#0f172a" }}>{fmtMoney(grandTotal.brandCollectionTotal)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", borderTop: "2px solid #cbd5e1", color: "#16a34a" }}>{fmtMoney(grandTotal.excessCollectionValue)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", borderTop: "2px solid #cbd5e1", color: "#dc2626" }}>{fmtMoney(grandTotal.shortCollectionValue)}</td>
                        <td style={{
                          padding: "10px 14px", textAlign: "right", borderTop: "2px solid #cbd5e1",
                          color: grandTotal.netDifference > 0 ? "#16a34a" : grandTotal.netDifference < 0 ? "#dc2626" : "#0f172a",
                        }}>
                          {grandTotal.netDifference > 0 ? "+" : grandTotal.netDifference < 0 ? "−" : ""}{fmtMoney(Math.abs(grandTotal.netDifference))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </>
        )}

        {selectedFc && (
          <>
            <button onClick={handleBackToBrand} style={{
              alignSelf: "flex-start", background: "none", border: "none", color: "#2563eb",
              fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: "0",
            }}>
              ← Back to {selectedBrand} summary
            </button>

            <div style={{
              background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px",
              padding: "16px", display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap",
            }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>{selectedFc}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>{selectedBrand}</div>
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>From Date</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>To Date</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                </div>
                <button onClick={handleRun} disabled={running} style={{
                  padding: "8px 18px", borderRadius: "7px", border: "none",
                  background: "#2563eb", color: "#ffffff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                }}>
                  {running ? "Running…" : "Run"}
                </button>
                {summary && (
                  <button onClick={() => handleDownload("fc")} disabled={downloading !== null} style={{
                    padding: "8px 18px", borderRadius: "7px", border: "1px solid #cbd5e1",
                    background: "#f8fafc", color: "#334155", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  }}>
                    {downloading === "fc" ? "Preparing…" : "Download FC Report"}
                  </button>
                )}
              </div>
            </div>

            {runError && (
              <div style={{ fontSize: "13px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px" }}>
                {runError}
              </div>
            )}

            {summary && (
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <div style={cardStyle}>
                  <div style={cardLabel}>Total CDMS</div>
                  <div style={cardValue("#0f172a")}>{fmtMoney(summary.cdmsTotalCollectionTotal)}</div>
                </div>
                <div style={cardStyle}>
                  <div style={cardLabel}>Pending Cheque</div>
                  <div style={cardValue("#f59e0b")}>{fmtMoney(summary.pendingChequeValue)}</div>
                </div>
                <div style={cardStyle}>
                  <div style={cardLabel}>CDMS Adj.</div>
                  <div style={cardValue("#0f172a")}>{fmtMoney(summary.cdmsAdjustedCollectionTotal)}</div>
                </div>
                <div style={cardStyle}>
                  <div style={cardLabel}>Brand Collection</div>
                  <div style={cardValue("#0f172a")}>{fmtMoney(summary.brandCollectionTotal)}</div>
                </div>
                <div style={cardStyle}>
                  <div style={cardLabel}>Excess Collection</div>
                  <div style={cardValue("#16a34a")}>{fmtMoney(summary.excessCollectionValue)}</div>
                </div>
                <div style={cardStyle}>
                  <div style={cardLabel}>Short Collection</div>
                  <div style={cardValue("#dc2626")}>{fmtMoney(summary.shortCollectionValue)}</div>
                </div>
                <div style={cardStyle}>
                  <div style={cardLabel}>Net Difference</div>
                  <div style={cardValue(
                    summary.netDifferenceSign === "+" ? "#16a34a" :
                    summary.netDifferenceSign === "-" ? "#dc2626" : "#0f172a"
                  )}>
                    {summary.netDifferenceSign === "+" ? "+" : summary.netDifferenceSign === "-" ? "−" : ""}
                    {fmtMoney(Math.abs(summary.netDifference))}
                  </div>
                </div>
              </div>
            )}

            {fileCount !== null && summary && (
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                Parsed {fileCount} file{fileCount === 1 ? "" : "s"} · {summary.invoiceCount} invoice{summary.invoiceCount === 1 ? "" : "s"}
              </div>
            )}

            {invoices.length > 0 && (
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ maxHeight: "520px", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 1 }}>
                      <tr>
                        {["Invoice No", "CDMS Total", "Pending Cheque", "CDMS Adj.", "Brand Collection", "Excess", "Short", "Net Difference"].map((h, i) => (
                          <th key={h} style={{
                            textAlign: i === 0 ? "left" : "right",
                            padding: "10px 14px", fontSize: "11px", fontWeight: 700,
                            color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em",
                            borderBottom: "1px solid #e2e8f0",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(row => {
                        const excess = row.netDifference > 0 ? row.netDifference : 0;
                        const short = row.netDifference < 0 ? Math.abs(row.netDifference) : 0;
                        const isExcluded = row.excludedCdmsAmount !== null;
                        return (
                          <tr key={row.invoiceNo} style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: isExcluded ? "#fffbeb" : "transparent",
                          }}>
                            <td style={{ padding: "8px 14px", color: "#334155" }}>{row.invoiceNo}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: "#334155" }}>{fmtMoney(row.cdmsTotalCollection)}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: "#f59e0b" }}>{row.excludedCdmsAmount ? fmtMoney(row.excludedCdmsAmount) : "—"}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: "#334155" }}>{fmtMoney(row.cdmsAdjustedCollection)}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: "#334155" }}>{fmtMoney(row.brandCollection)}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: "#16a34a" }}>{excess && !isExcluded ? fmtMoney(excess) : "—"}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: "#dc2626" }}>{short && !isExcluded ? fmtMoney(short) : "—"}</td>
                            <td style={{
                              padding: "8px 14px", textAlign: "right", fontWeight: 600,
                              color: isExcluded ? "#94a3b8" : row.netDifference > 0 ? "#16a34a" : row.netDifference < 0 ? "#dc2626" : "#334155",
                            }}>
                              {isExcluded ? "—" : `${row.netDifference > 0 ? "+" : row.netDifference < 0 ? "−" : ""}${fmtMoney(Math.abs(row.netDifference))}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
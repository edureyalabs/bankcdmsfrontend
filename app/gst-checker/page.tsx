// app/gst-checker/page.tsx
"use client";

import { useState, useCallback, useRef } from "react";

interface GstRecord {
  id: number;
  gst_no: string;
  retailer_name: string;
  fc: string;
  state: string;
}

interface CaptchaItem {
  record: GstRecord;
  captchaImg: string | null;
  status: "loading" | "ready" | "submitting" | "done" | "error";
  answer: string;
  result: string | null;
  error: string | null;
  wrongCaptcha: boolean;
}

interface Stats {
  total: number;
  checked: number;
  pending: number;
}

export default function GstCheckerPage() {
  const [items, setItems]             = useState<CaptchaItem[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [loading, setLoading]         = useState(false);
  const [downloading, setDownloading] = useState(false);
  const inputRefs                     = useRef<(HTMLInputElement | null)[]>([]);

  const updateItem = (index: number, patch: Partial<CaptchaItem>) =>
    setItems(prev => prev.map((it, i) => i === index ? { ...it, ...patch } : it));

  const loadCaptcha = async (record: GstRecord, index: number) => {
    updateItem(index, { status: "loading", captchaImg: null, answer: "", error: null });
    try {
      const res  = await fetch("/api/gst/captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gst_no: record.gst_no, id: record.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      updateItem(index, { status: "ready", captchaImg: data.captcha, wrongCaptcha: false });
      //  Only auto-focus the very first item
      if (index === 0) setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err: any) {
      updateItem(index, { status: "error", error: err.message });
    }
  };

  const loadBatch = useCallback(async () => {
    setLoading(true);
    setItems([]);
    inputRefs.current = [];
    try {
      const res  = await fetch("/api/gst/pending");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data.stats);

      const initial: CaptchaItem[] = data.records.map((r: GstRecord) => ({
        record: r, captchaImg: null, status: "loading" as const,
        answer: "", result: null, error: null, wrongCaptcha: false,
      }));
      setItems(initial);

      // Load captchas ONE BY ONE — avoids network saturation
      for (let i = 0; i < data.records.length; i++) {
        await loadCaptcha(data.records[i], i);
      }
    } catch (err: any) {
      alert("Failed to load batch: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitCaptcha = async (index: number) => {
    const item = items[index];
    if (!item.answer.trim() || item.status === "submitting" || item.status === "done") return;

    updateItem(index, { status: "submitting" });

    try {
      const res  = await fetch("/api/gst/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.record.id, gst_no: item.record.gst_no, captcha_answer: item.answer.trim() }),
      });
      const data = await res.json();

      if (data.error) { updateItem(index, { status: "error", error: data.error }); return; }

      if (data.status === "WRONG_CAPTCHA") {
        await loadCaptcha(item.record, index);
        updateItem(index, { wrongCaptcha: true });
        return;
      }

      updateItem(index, { status: "done", result: data.status });

      // Auto-focus next pending input
      const next = items.findIndex((it, i) => i > index && it.status === "ready");
      if (next !== -1) setTimeout(() => inputRefs.current[next]?.focus(), 50);

      // Refresh stats silently
      fetch("/api/gst/pending").then(r => r.json()).then(d => { if (d.stats) setStats(d.stats); });
    } catch (err: any) {
      updateItem(index, { status: "error", error: err.message });
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res  = await fetch("/api/gst/download");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      const match = (res.headers.get("Content-Disposition") || "").match(/filename="(.+)"/);
      a.download = match ? match[1] : "gst_export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { alert("Download failed: " + err.message); }
    finally { setDownloading(false); }
  };

  const doneCount = items.filter(i => i.status === "done").length;
  const allDone   = items.length > 0 && doneCount === items.length;

  return (
    <>
      <style>{`
        @keyframes gst-spin { to { transform: rotate(360deg); } }
        .gst-row { display: grid; grid-template-columns: 2fr 160px 220px 100px; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        .gst-row:hover { background: #f8fafc; }
        .gst-input { border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 5px 10px; font-size: 13px; width: 100%; box-sizing: border-box; outline: none; }
        .gst-input:focus { border-color: #2563eb; box-shadow: 0 0 0 2px #dbeafe; }
        .gst-input:disabled { background: #f8fafc; color: #94a3b8; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>GST Status Checker</h1>
            {stats && (
              <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>
                Total: <strong>{stats.total.toLocaleString()}</strong> &nbsp;·&nbsp;
                Checked: <strong style={{ color: "#15803d" }}>{stats.checked.toLocaleString()}</strong> &nbsp;·&nbsp;
                Pending: <strong style={{ color: "#b45309" }}>{stats.pending.toLocaleString()}</strong>
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={handleDownload} disabled={downloading} style={{ padding: "7px 16px", fontSize: "12px", fontWeight: 700, background: downloading ? "#94a3b8" : "#15803d", color: "#fff", border: "none", borderRadius: "7px", cursor: downloading ? "not-allowed" : "pointer" }}>
              {downloading ? "Preparing…" : "⬇ Download CSV"}
            </button>
            <button onClick={loadBatch} disabled={loading} style={{ padding: "7px 20px", fontSize: "12px", fontWeight: 700, background: loading ? "#94a3b8" : "#2563eb", color: "#fff", border: "none", borderRadius: "7px", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Loading…" : allDone ? "→ Load Next" : "Load Batch"}
            </button>
          </div>
        </div>

        {/* Progress */}
        {items.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>{doneCount}/{items.length} done</span>
            <div style={{ flex: 1, height: "5px", background: "#e2e8f0", borderRadius: "99px" }}>
              <div style={{ height: "5px", borderRadius: "99px", background: "#15803d", width: `${(doneCount / items.length) * 100}%`, transition: "width 0.3s" }} />
            </div>
            {allDone && <span style={{ fontSize: "12px", fontWeight: 700, color: "#15803d" }}>✓ All done!</span>}
          </div>
        )}

        {/* Table */}
        {items.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8", fontSize: "14px" }}>
            Click <strong style={{ color: "#0f172a" }}>Load Batch</strong> to begin
          </div>
        )}

        {items.length > 0 && (
          <div style={{ background: "#fff", border: "1.5px solid #cbd5e1", borderRadius: "10px", overflow: "hidden" }}>
            {/* Table header */}
            <div className="gst-row" style={{ background: "#1e293b", borderBottom: "2px solid #0f172a" }}>
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>GST No · Retailer</span>
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>Captcha</span>
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>Enter Code</span>
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>Status</span>
            </div>

            {items.map((item, index) => (
              <div key={item.record.id} className="gst-row">

                {/* GST + name */}
                <div>
                  <p style={{ margin: 0, fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "#1d4ed8" }}>{item.record.gst_no}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.record.retailer_name}</p>
                </div>

                {/* Captcha image */}
                <div style={{ width: "160px", height: "50px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.status === "loading" && (
                    <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2px solid #bfdbfe", borderTopColor: "#2563eb", animation: "gst-spin 0.7s linear infinite" }} />
                  )}
                  {item.captchaImg && item.status !== "loading" && (
                    <img src={item.captchaImg} alt="captcha" style={{ maxHeight: "50px", maxWidth: "160px", borderRadius: "4px", border: "1px solid #e2e8f0" }} />
                  )}
                </div>

                {/* Input */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {(item.status === "ready" || item.status === "submitting" || item.status === "error") && (
                    <>
                      <input
                        ref={el => { inputRefs.current[index] = el; }}
                        className="gst-input"
                        type="text"
                        value={item.answer}
                        placeholder={item.wrongCaptcha ? "Wrong — retry" : "Type here…"}
                        disabled={item.status === "submitting"}
                        onChange={e => updateItem(index, { answer: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Enter") { e.preventDefault(); submitCaptcha(index); }
                          if (e.key === "Tab") {
                            // Tab moves to next ready input
                            e.preventDefault();
                            const next = items.findIndex((it, i) => i > index && (it.status === "ready" || it.status === "error"));
                            if (next !== -1) inputRefs.current[next]?.focus();
                          }
                        }}
                      />
                      <button
                        onClick={() => loadCaptcha(item.record, index)}
                        title="Reload captcha"
                        style={{ padding: "5px 8px", fontSize: "13px", background: "#f1f5f9", border: "1.5px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", color: "#475569", flexShrink: 0 }}
                      >↺</button>
                    </>
                  )}
                </div>

                {/* Status */}
                <div style={{ fontSize: "12px", fontWeight: 700 }}>
                  {item.status === "done" && (
                    <span style={{ color: item.result?.toLowerCase() === "active" ? "#15803d" : item.result?.toLowerCase() === "cancelled" ? "#991b1b" : "#92400e" }}>
                      {item.result}
                    </span>
                  )}
                  {item.status === "submitting" && <span style={{ color: "#94a3b8" }}>Checking…</span>}
                  {item.status === "loading"    && <span style={{ color: "#94a3b8" }}>—</span>}
                  {item.status === "error" && !item.captchaImg && <span style={{ color: "#991b1b", fontSize: "10px" }}>Failed</span>}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
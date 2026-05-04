// FILE PATH: bank_cdms_dashboard/context/DashboardContext.tsx — REPLACE EXISTING

"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { invalidateRawCache } from "@/components/RawTable";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PivotRow {
  grp_key: string; total: number; full_match: number; partial: number; unmatched: number;
  total_count: number; full_count: number; partial_count: number; unmatched_count: number;
}
export interface Totals {
  total: number; full_match: number; partial: number; unmatched: number;
  total_count: number; full_count: number; partial_count: number; unmatched_count: number;
}
export const EMPTY_TOTALS: Totals = {
  total: 0, full_match: 0, partial: 0, unmatched: 0,
  total_count: 0, full_count: 0, partial_count: 0, unmatched_count: 0,
};

export interface CdmsFilterOpts { fc: string[]; brand: string[]; mode: string[]; status: string[]; }
export interface CdmsSummaryData {
  by_fc: PivotRow[]; by_month: PivotRow[]; totals: Totals; filter_opts: CdmsFilterOpts;
}
export type CdmsFilters = {
  fc: string[]; brand: string[]; status: string[]; mode: string[];
  ref: string; invoice: string; dateFrom: string; dateTo: string;
};
export const CDMS_EMPTY: CdmsFilters = {
  fc: [], brand: [], status: [], mode: [], ref: "", invoice: "", dateFrom: "", dateTo: "",
};

export interface BankFilterOpts { account: string[]; fc: string[]; brand: string[]; narrType: string[]; status: string[]; }
export interface BankSummaryData {
  by_account: PivotRow[]; by_month: PivotRow[]; totals: Totals; filter_opts: BankFilterOpts;
}
export type BankFilters = {
  account: string[]; status: string[]; fc: string[]; brand: string[]; narrType: string[];
  ref: string; dateFrom: string; dateTo: string;
};
export const BANK_EMPTY: BankFilters = {
  account: [], status: [], fc: [], brand: [], narrType: [], ref: "", dateFrom: "", dateTo: "",
};

// ── QS builders ───────────────────────────────────────────────────────────────

export function buildCdmsQS(f: CdmsFilters): string {
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

export function buildBankQS(f: BankFilters): string {
  const p = new URLSearchParams();
  f.account.forEach(v  => p.append("account",  v));
  f.status.forEach(v   => p.append("status",   v));
  f.fc.forEach(v       => p.append("fc",       v));
  f.brand.forEach(v    => p.append("brand",    v));
  f.narrType.forEach(v => p.append("narrType", v));
  if (f.ref)      p.set("ref",      f.ref);
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo)   p.set("dateTo",   f.dateTo);
  return p.toString();
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface DashboardContextValue {
  cdmsData:     CdmsSummaryData | null;
  cdmsLoading:  boolean;
  cdmsError:    string;
  cdmsFilters:  CdmsFilters;
  cdmsDraft:    CdmsFilters;
  cdmsQS:       string;
  setCdmsDraft: (f: CdmsFilters) => void;
  applycdms:    () => void;
  resetCdms:    () => void;
  ensureCdms:   () => void;

  bankData:     BankSummaryData | null;
  bankLoading:  boolean;
  bankError:    string;
  bankFilters:  BankFilters;
  bankDraft:    BankFilters;
  bankQS:       string;
  setBankDraft: (f: BankFilters) => void;
  applyBank:    () => void;
  resetBank:    () => void;
  ensureBank:   () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function DashboardProvider({ children }: { children: ReactNode }) {

  // ── CDMS ────────────────────────────────────────────────────────────────────
  const [cdmsData,    setCdmsData]    = useState<CdmsSummaryData | null>(null);
  const [cdmsLoading, setCdmsLoading] = useState(true);
  const [cdmsError,   setCdmsError]   = useState("");
  const [cdmsFilters, setCdmsFilters] = useState<CdmsFilters>(CDMS_EMPTY);
  const [cdmsDraft,   setCdmsDraft]   = useState<CdmsFilters>(CDMS_EMPTY);
  const [cdmsQS,      setCdmsQS]      = useState("");
  const cdmsFetching = useRef(false);

  const fetchCdms = useCallback((f: CdmsFilters) => {
    const qs = buildCdmsQS(f);
    setCdmsQS(qs);
    setCdmsLoading(true);
    setCdmsError("");
    fetch("/api/cdms/summary" + (qs ? "?" + qs : ""))
      .then(r => {
        if (r.status === 401) throw new Error("Unauthorized");
        return r.json();
      })
      .then((d: CdmsSummaryData & { error?: string }) => {
        if (d.error) { setCdmsError(d.error); } else { setCdmsData(d); }
        setCdmsLoading(false);
      })
      .catch((e: unknown) => {
        setCdmsError(e instanceof Error ? e.message : String(e));
        setCdmsLoading(false);
        cdmsFetching.current = false; // allow retry on hard error
      });
  }, []);

  const ensureCdms = useCallback(() => {
    if (cdmsFetching.current) return;
    cdmsFetching.current = true;
    fetchCdms(CDMS_EMPTY);
  }, [fetchCdms]);

  const applycdms = useCallback(() => {
    const next = { ...cdmsDraft };
    setCdmsFilters(next);
    invalidateRawCache("/api/cdms/raw"); // clear raw cache for new filters
    fetchCdms(next);
  }, [cdmsDraft, fetchCdms]);

  const resetCdms = useCallback(() => {
    setCdmsDraft({ ...CDMS_EMPTY });
    setCdmsFilters({ ...CDMS_EMPTY });
    invalidateRawCache("/api/cdms/raw");
    fetchCdms(CDMS_EMPTY);
  }, [fetchCdms]);

  // ── Bank ─────────────────────────────────────────────────────────────────────
  const [bankData,    setBankData]    = useState<BankSummaryData | null>(null);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankError,   setBankError]   = useState("");
  const [bankFilters, setBankFilters] = useState<BankFilters>(BANK_EMPTY);
  const [bankDraft,   setBankDraft]   = useState<BankFilters>(BANK_EMPTY);
  const [bankQS,      setBankQS]      = useState("");
  const bankFetching = useRef(false);

  const fetchBank = useCallback((f: BankFilters) => {
    const qs = buildBankQS(f);
    setBankQS(qs);
    setBankLoading(true);
    setBankError("");
    fetch("/api/bank/summary" + (qs ? "?" + qs : ""))
      .then(r => {
        if (r.status === 401) throw new Error("Unauthorized");
        return r.json();
      })
      .then((d: BankSummaryData & { error?: string }) => {
        if (d.error) { setBankError(d.error); } else { setBankData(d); }
        setBankLoading(false);
      })
      .catch((e: unknown) => {
        setBankError(e instanceof Error ? e.message : String(e));
        setBankLoading(false);
        bankFetching.current = false;
      });
  }, []);

  const ensureBank = useCallback(() => {
    if (bankFetching.current) return;
    bankFetching.current = true;
    fetchBank(BANK_EMPTY);
  }, [fetchBank]);

  const applyBank = useCallback(() => {
    const next = { ...bankDraft };
    setBankFilters(next);
    invalidateRawCache("/api/bank/raw");
    fetchBank(next);
  }, [bankDraft, fetchBank]);

  const resetBank = useCallback(() => {
    setBankDraft({ ...BANK_EMPTY });
    setBankFilters({ ...BANK_EMPTY });
    invalidateRawCache("/api/bank/raw");
    fetchBank(BANK_EMPTY);
  }, [fetchBank]);

  const value: DashboardContextValue = {
    cdmsData, cdmsLoading, cdmsError, cdmsFilters, cdmsDraft, cdmsQS,
    setCdmsDraft, applycdms, resetCdms, ensureCdms,
    bankData, bankLoading, bankError, bankFilters, bankDraft, bankQS,
    setBankDraft, applyBank, resetBank, ensureBank,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return ctx;
}
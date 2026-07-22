// FILE PATH: bank_cdms_dashboard/lib/runCache.ts — REPLACE EXISTING
//
// Two separate cache files:
//   - brand-vs-cdms-summaries.json  — FC-level summaries + grand totals only
//     (small, fast to read, loaded instantly on brand selection)
//   - brand-vs-cdms-invoices.json   — full invoice rows per brand
//     (large, only read when building an xlsx download)

import fs from "fs";
import path from "path";
import type { TaggedInvoiceRow } from "./reportBuilder";

const CACHE_DIR = path.join(process.cwd(), "data");
const SUMMARIES_FILE = path.join(CACHE_DIR, "brand-vs-cdms-summaries.json");
const INVOICES_FILE  = path.join(CACHE_DIR, "brand-vs-cdms-invoices.json");

export interface CachedSummary {
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

export interface CachedFcRowResult {
  fcName: string;
  summary?: CachedSummary;
  resolvedFromDate?: string;
  resolvedToDate?: string;
  fileCount?: number;
  error?: string;
}

export interface CachedBrandSummary {
  brandFolder: string;
  fcCount: number;
  succeededCount: number;
  failedCount: number;
  results: CachedFcRowResult[];
  grandTotal: CachedSummary;
  runAt: string;
}

// ── Summaries (small, always fast) ───────────────────────────────────────────

type SummaryCache = Record<string, CachedBrandSummary>;

function readSummaries(): SummaryCache {
  if (!fs.existsSync(SUMMARIES_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(SUMMARIES_FILE, "utf-8")) as SummaryCache; }
  catch { return {}; }
}

function writeSummaries(data: SummaryCache) {
  ensureCacheDir();
  fs.writeFileSync(SUMMARIES_FILE, JSON.stringify(data), "utf-8");
}

// ── Invoice rows (large, only read for downloads) ─────────────────────────────

type InvoiceCache = Record<string, TaggedInvoiceRow[]>;

function readInvoices(): InvoiceCache {
  if (!fs.existsSync(INVOICES_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(INVOICES_FILE, "utf-8")) as InvoiceCache; }
  catch { return {}; }
}

function writeInvoices(data: InvoiceCache) {
  ensureCacheDir();
  fs.writeFileSync(INVOICES_FILE, JSON.stringify(data), "utf-8");
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getCachedBrandSummary(brandFolder: string): CachedBrandSummary | null {
  return readSummaries()[brandFolder] ?? null;
}

export function getCachedBrandInvoices(brandFolder: string): TaggedInvoiceRow[] | null {
  return readInvoices()[brandFolder] ?? null;
}

export function saveCachedBrandRun(
  brandFolder: string,
  summary: Omit<CachedBrandSummary, "runAt">,
  invoiceRows: TaggedInvoiceRow[]
) {
  const runAt = new Date().toISOString();

  const summaries = readSummaries();
  summaries[brandFolder] = { ...summary, runAt };
  writeSummaries(summaries);

  const invoices = readInvoices();
  invoices[brandFolder] = invoiceRows;
  writeInvoices(invoices);
}
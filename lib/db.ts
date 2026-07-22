// FILE PATH: bank_cdms_dashboard/lib/db.ts — REPLACE EXISTING

import path from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MatchStatus =
  | "Full Match"
  | "Partial Match"
  | "Unmatched"
  | "Excluded";

export type Row = Record<string, unknown>;

// ── Local adapter (better-sqlite3) ────────────────────────────────────────────

function makeLocalClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");

  const DB_PATH =
    process.env.MATCHER_DB_PATH ||
    path.join(process.cwd(), "..", "cdms bank matcher", "output", "matcher.db");

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `matcher.db not found at: ${DB_PATH}\n` +
      `Set MATCHER_DB_PATH in .env.local to the correct path.`
    );
  }

  const db = new Database(DB_PATH, { readonly: true });

  return {
    async query(sql: string, args: unknown[] = []): Promise<Row[]> {
      return db.prepare(sql).all(...args) as Row[];
    },
  };
}

// ── Singleton (globalThis survives hot-reload in dev) ─────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __cdms_db_client__: { query(sql: string, args?: unknown[]): Promise<Row[]> } | undefined;
}

export function getDb() {
  if (globalThis.__cdms_db_client__) return globalThis.__cdms_db_client__;
  const client = makeLocalClient();
  globalThis.__cdms_db_client__ = client;
  return client;
}

// ── Query helper ──────────────────────────────────────────────────────────────

export async function dbQuery(sql: string, args: unknown[] = []): Promise<Row[]> {
  return getDb().query(sql, args);
}
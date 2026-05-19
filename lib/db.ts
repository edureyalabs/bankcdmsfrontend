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
    
    console.log("DB PATH:", DB_PATH);    

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

// ── Turso adapter (@libsql/client) ────────────────────────────────────────────
//
// Root cause of "Compaction failed: Another write batch or compaction is already
// active": libsql's embedded sync client runs WAL compaction as a background
// task. When multiple API routes hit the DB simultaneously (summary + raw both
// fire on page load), they share one process-level libsql instance whose
// compaction job collides with incoming queries.
//
// Fix: switch to the pure HTTP client (`@libsql/client/http`). It sends every
// query directly to Turso's HTTP API — no local WAL file, no compaction, no
// background tasks. This is the correct mode for a stateless Next.js API route
// that only reads data.
//
// The HTTP client is already bundled inside @libsql/client — no extra install
// needed. Just import from the /http subpath.

function makeTursoClient() {
  // Use the HTTP-only subpath — no local SQLite file, no WAL, no compaction.
  // Falls back to the default client if the subpath isn't available (older
  // versions of @libsql/client before the subpath exports were added).
  let createClient: (opts: { url: string; authToken: string }) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ createClient } = require("@libsql/client/http"));
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ createClient } = require("@libsql/client"));
  }

  // Turso URLs are typically libsql:// — the HTTP client needs https://
  const rawUrl = process.env.TURSO_DATABASE_URL!;
  const url = rawUrl.startsWith("libsql://")
    ? rawUrl.replace("libsql://", "https://")
    : rawUrl;

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  }) as { execute: (q: { sql: string; args: unknown[] }) => Promise<{ rows: Row[] }> };

  return {
    async query(sql: string, args: unknown[] = []): Promise<Row[]> {
      const result = await client.execute({ sql, args });
      return result.rows;
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
  const client = process.env.TURSO_DATABASE_URL ? makeTursoClient() : makeLocalClient();
  globalThis.__cdms_db_client__ = client;
  return client;
}

// ── Query helper ──────────────────────────────────────────────────────────────

export async function dbQuery(sql: string, args: unknown[] = []): Promise<Row[]> {
  return getDb().query(sql, args);
}
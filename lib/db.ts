// FILE PATH: bank_cdms_dashboard/lib/db.ts
//
// Local dev  : uses better-sqlite3  (fast, synchronous, reads matcher.db from disk)
// Production : uses @libsql/client   (reads from Turso cloud over HTTPS)
//
// Detection logic:
//   - TURSO_DATABASE_URL is set  →  Turso (Vercel / any cloud)
//   - TURSO_DATABASE_URL not set →  local better-sqlite3

import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchStatus =
  | "Full Match"
  | "Partial Match"
  | "Unmatched"
  | "Excluded";

// Generic row type returned by both adapters
export type Row = Record<string, unknown>;

// Unified DB interface – both adapters implement this
export interface DbClient {
  query(sql: string, args?: unknown[]): Row[];
}

// ─── Local adapter (better-sqlite3) ───────────────────────────────────────────

function makeLocalClient(): DbClient {
  // Lazy import so the module is never loaded in production builds
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const fs = require("fs") as typeof import("fs");

  const DB_PATH =
    process.env.MATCHER_DB_PATH ||
    path.join(
      process.cwd(),
      "..",
      "cdms bank matcher",
      "output",
      "matcher.db"
    );

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `matcher.db not found at: ${DB_PATH}\n` +
        `Set MATCHER_DB_PATH in .env.local to the correct path.`
    );
  }

  const db = new Database(DB_PATH, { readonly: true });

  return {
    query(sql: string, args: unknown[] = []): Row[] {
      return db.prepare(sql).all(...args) as Row[];
    },
  };
}

// ─── Turso adapter (@libsql/client) ───────────────────────────────────────────

function makeTursoClient(): DbClient {
  // @libsql/client is async under the hood but exposes a sync-style
  // HTTP client via createClient({ url, authToken }).
  // We use the synchronous `.execute()` approach wrapped in a small helper.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client");

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  return {
    // NOTE: Turso client is async – callers must await query()
    // We return a Promise<Row[]> here; update call sites to use await.
    query(sql: string, args: unknown[] = []): Row[] {
      // This cast is intentional: at runtime callers must await this.
      // TypeScript sees Row[] but receives Promise<Row[]>.
      // See README note on async usage.
      return client
        .execute({ sql, args })
        .then(
          (result: { rows: Row[] }) => result.rows
        ) as unknown as Row[];
    },
  };
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _client: DbClient | null = null;

export function getDb(): DbClient {
  if (_client) return _client;
  if (process.env.TURSO_DATABASE_URL) {
    _client = makeTursoClient();
  } else {
    _client = makeLocalClient();
  }
  return _client;
}

// ─── Query helper (handles both sync local and async Turso) ───────────────────
//
// Use this everywhere instead of calling getDb().query() directly.
// It always returns a Promise so your API routes stay consistent.
//
// Example:
//   const rows = await dbQuery("SELECT * FROM cdms_data WHERE Match_Status = ?", ["Full Match"]);

export async function dbQuery(sql: string, args: unknown[] = []): Promise<Row[]> {
  const db = getDb();
  const result = db.query(sql, args);
  // Local returns Row[] synchronously; Turso returns Promise<Row[]>
  return result instanceof Promise ? result : Promise.resolve(result);
}
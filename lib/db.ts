// FILE PATH: bank_cdms_dashboard/lib/db.ts

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.MATCHER_DB_PATH ||
  path.join(process.cwd(), "..", "cdms bank matcher", "output", "matcher.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `matcher.db not found at: ${DB_PATH}\n` +
        `Set MATCHER_DB_PATH in .env.local to the correct path.`
    );
  }
  // readonly: true — no WAL pragma needed (WAL requires write access)
  _db = new Database(DB_PATH, { readonly: true });
  return _db;
}

export type MatchStatus = "Full Match" | "Partial Match" | "Unmatched" | "Excluded";
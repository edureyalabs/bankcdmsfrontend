// lib/gst-db.ts
import Database from 'better-sqlite3'

const DB_PATH = process.env.GST_DB_PATH!

export function getDb() {
  return new Database(DB_PATH)
}

export interface GstRecord {
  id: number
  gst_no: string
  retailer_name: string
  fc: string
  state: string
  gst_status: string | null
  last_checked: string | null
  check_attempts: number
}

export function getPendingRecords(limit: number, cutoffDate: string, sessionId: string): GstRecord[] {
  const db = getDb()

  // Release stale locks older than 30 minutes
  db.prepare(`
    UPDATE gst_records SET locked_by = NULL, locked_at = NULL
    WHERE locked_by IS NOT NULL
      AND locked_at < datetime('now', '-30 minutes')
  `).run()

  // Fetch rows not checked, not locked by someone else
  const rows = db.prepare(`
    SELECT id, gst_no, retailer_name, fc, state, gst_status, last_checked, check_attempts
    FROM gst_records
    WHERE gst_no IS NOT NULL
      AND trim(gst_no) != ''
      AND (gst_status IS NULL OR last_checked IS NULL OR last_checked < ?)
      AND (locked_by IS NULL OR locked_by = ?)
    ORDER BY check_attempts ASC, id ASC
    LIMIT ?
  `).all(cutoffDate, sessionId, limit) as GstRecord[]

  // Lock these rows for this session
  if (rows.length > 0) {
    const ids = rows.map(r => r.id).join(',')
    db.prepare(`
      UPDATE gst_records
      SET locked_by = ?, locked_at = datetime('now')
      WHERE id IN (${ids})
    `).run(sessionId)
  }

  db.close()
  return rows
}

export function releaseLock(id: number) {
  const db = getDb()
  db.prepare(`UPDATE gst_records SET locked_by = NULL, locked_at = NULL WHERE id = ?`).run(id)
  db.close()
}

export function updateGstStatus(id: number, status: string) {
  const db = getDb()
  db.prepare(`
    UPDATE gst_records
    SET gst_status = ?,
        last_checked = ?,
        check_attempts = check_attempts + 1,
        locked_by = NULL,
        locked_at = NULL
    WHERE id = ?
  `).run(status, new Date().toISOString(), id)
  db.close()
}

export function getStats() {
  const db = getDb()
  const total   = (db.prepare(`SELECT COUNT(*) as c FROM gst_records`).get() as any).c
  const checked = (db.prepare(`SELECT COUNT(*) as c FROM gst_records WHERE gst_status IS NOT NULL`).get() as any).c
  const pending = total - checked
  db.close()
  return { total, checked, pending }
}

export function getAllRecordsForExport() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT fc, brand, retailer_name, retailer_code, sub_retailer_type,
      address, status, ranking, owner_name, phone_no,
      gst_no, pan_no, shop_establishment, asm, state,
      l6m_average, owner_name_status, phone_no_status, is_gst,
      gst_status, last_checked, check_attempts
    FROM gst_records ORDER BY id ASC
  `).all()
  db.close()
  return rows
}
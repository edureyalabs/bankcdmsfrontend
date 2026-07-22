// app/api/gst/pending/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPendingRecords, getStats } from '@/lib/gst-db'

export async function GET(req: NextRequest) {
  try {
    const limit       = parseInt(process.env.GST_BATCH_LIMIT || '50')
    const cutoffDate  = process.env.GST_CUTOFF_DATE || '2026-01-01'

    // Session ID from cookie or header — identifies this browser tab
    const sessionId = req.cookies.get('gst_session')?.value
      || req.headers.get('x-gst-session')
      || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const records = getPendingRecords(limit, cutoffDate, sessionId)
    const stats   = getStats()

    const res = NextResponse.json({ records, stats, limit, cutoffDate, sessionId })

    // Set session cookie if not present
    if (!req.cookies.get('gst_session')) {
      res.cookies.set('gst_session', sessionId, { httpOnly: false, maxAge: 60 * 60 * 24 })
    }

    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
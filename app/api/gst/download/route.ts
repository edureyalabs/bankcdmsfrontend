// app/api/gst/download/route.ts
import { NextResponse } from 'next/server'
import { getAllRecordsForExport } from '@/lib/gst-db'

export async function GET() {
  try {
    const rows = getAllRecordsForExport()

    // Build CSV
    const headers = [
      'fc', 'brand', 'retailer_name', 'retailer_code', 'sub_retailer_type',
      'address', 'status', 'ranking', 'owner_name', 'phone_no',
      'gst_no', 'pan_no', 'shop_establishment', 'asm', 'state',
      'l6m_average', 'owner_name_status', 'phone_no_status', 'is_gst',
      'gst_status', 'last_checked', 'check_attempts'
    ]

    const escape = (val: any) => {
      if (val == null) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csvRows = [
      headers.join(','),
      ...rows.map((row: any) => headers.map(h => escape(row[h])).join(','))
    ]
    const csv = csvRows.join('\n')

    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    const filename = `gst_status_export_${timestamp}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
// app/api/gst/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateGstStatus, releaseLock } from '@/lib/gst-db'

declare global {
  var gstSessions: Record<string, { browser: any; page: any }>
  var gstActiveCount: number
}
if (!global.gstSessions)    global.gstSessions    = {}
if (!global.gstActiveCount) global.gstActiveCount = 0

export async function POST(req: NextRequest) {
  const { id, gst_no, captcha_answer } = await req.json()
  const key = String(id)

  const session = global.gstSessions[key]
  if (!session) {
    return NextResponse.json({ error: 'Session expired — reload captcha' }, { status: 400 })
  }

  const { page, browser } = session

  try {
    await page.fill('#fo-captcha', captcha_answer)
    await page.click('#lotsearch')

    try {
      await page.waitForSelector('text=Search Result based on GSTIN', { timeout: 15000 })
    } catch {}
    await page.waitForTimeout(2000)

    const bodyText: string = await page.innerText('body')
    let status = 'UNKNOWN'

    if (
      bodyText.toLowerCase().includes('wrong captcha') ||
      bodyText.toLowerCase().includes('invalid captcha') ||
      bodyText.toLowerCase().includes('please enter valid captcha') ||
      bodyText.toLowerCase().includes('captcha mismatch')
    ) {
      status = 'WRONG_CAPTCHA'
    } else if (bodyText.includes('GSTIN / UIN Status')) {
      const lines = bodyText.split('\n').map((l: string) => l.trim()).filter(Boolean)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('GSTIN / UIN Status') && lines[i + 1]) {
          status = lines[i + 1].trim()
          break
        }
      }
    } else if (bodyText.toLowerCase().includes('not exist') || bodyText.toLowerCase().includes('no records found')) {
      status = 'NOT FOUND'
    } else if (bodyText.toLowerCase().includes('invalid gstin')) {
      status = 'INVALID'
    }

    await browser.close()
    delete global.gstSessions[key]
    global.gstActiveCount = Math.max(0, global.gstActiveCount - 1)

    if (status !== 'WRONG_CAPTCHA') {
      updateGstStatus(id, status)
    } else {
      releaseLock(id) // unlock so captcha can be retried
    }

    return NextResponse.json({ status, gst_no })
  } catch (err: any) {
    try { await browser.close() } catch {}
    delete global.gstSessions[key]
    global.gstActiveCount = Math.max(0, global.gstActiveCount - 1)
    releaseLock(id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
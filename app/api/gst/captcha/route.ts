// app/api/gst/captcha/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

declare global {
  var gstSessions: Record<string, { browser: any; page: any }>
  var gstActiveCount: number
}
if (!global.gstSessions)     global.gstSessions    = {}
if (!global.gstActiveCount)  global.gstActiveCount = 0

export async function POST(req: NextRequest) {
  const { gst_no, id } = await req.json()
  const key = String(id)

  const parallelLimit = parseInt(process.env.GST_PARALLEL_LIMIT || '3')

  // Close existing session for this id if any
  if (global.gstSessions[key]) {
    try { await global.gstSessions[key].browser.close() } catch {}
    delete global.gstSessions[key]
    global.gstActiveCount = Math.max(0, global.gstActiveCount - 1)
  }

  // Wait if at parallel limit
  const waited = await new Promise<boolean>(resolve => {
    let attempts = 0
    const check = () => {
      if (global.gstActiveCount < parallelLimit) { resolve(true); return; }
      if (attempts++ > 60) { resolve(false); return; } // 30s timeout
      setTimeout(check, 500)
    }
    check()
  })

  if (!waited) {
    return NextResponse.json({ error: 'Too many browsers open, try again shortly' }, { status: 429 })
  }

  global.gstActiveCount++

  try {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    })
    const page = await context.newPage()

    await page.goto(process.env.GST_PORTAL_URL!, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('#for_gstin', { timeout: 30000 })
    await page.click('#for_gstin')
    await page.type('#for_gstin', gst_no, { delay: 80 })
    await page.waitForSelector('#fo-captcha',  { timeout: 15000 })
    await page.waitForSelector('#imgCaptcha',  { timeout: 15000 })
    await page.waitForTimeout(1000)

    const captchaEl     = await page.$('#imgCaptcha')
    const captchaBuffer = await captchaEl!.screenshot({ type: 'png' })
    const captchaDataUrl = `data:image/png;base64,${captchaBuffer.toString('base64')}`

    global.gstSessions[key] = { browser, page }

    return NextResponse.json({ captcha: captchaDataUrl })
  } catch (err: any) {
    global.gstActiveCount = Math.max(0, global.gstActiveCount - 1)
    if (global.gstSessions[key]) {
      try { await global.gstSessions[key].browser.close() } catch {}
      delete global.gstSessions[key]
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
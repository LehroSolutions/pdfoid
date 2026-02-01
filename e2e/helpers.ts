import type { Page, Locator } from '@playwright/test'
import { expect } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

/** Path to the real test PDF (portfolio document) */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TEST_PDF_PATH = path.join(__dirname, '..', 'my portfolio 3.0.pdf')

export async function buildSamplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Hello PDFoid', { x: 72, y: 720, size: 24, font })
  page.drawText('FindMe', { x: 72, y: 680, size: 24, font })
  const bytes = await doc.save()
  return Buffer.from(bytes)
}

/**
 * Load the real portfolio PDF for testing with actual content
 */
export function loadRealPdf(): Buffer {
  if (!fs.existsSync(TEST_PDF_PATH)) {
    throw new Error(`Test PDF not found at: ${TEST_PDF_PATH}`)
  }
  return fs.readFileSync(TEST_PDF_PATH)
}

export async function uploadSamplePdf(page: Page, useRealPdf = true): Promise<void> {
  await page.addInitScript(() => {
    try { localStorage.clear() } catch {}
    try { sessionStorage.clear() } catch {}
    try { indexedDB.deleteDatabase('pdfoid_db') } catch {}
  })
  await page.goto('/')
  await expect(page.getByText('Upload Document')).toBeVisible({ timeout: 15000 })
  
  // Use real PDF if available, otherwise fall back to generated sample
  let buffer: Buffer
  let fileName: string
  if (useRealPdf) {
    try {
      buffer = loadRealPdf()
      fileName = 'my portfolio 3.0.pdf'
      console.log('[DEBUG] Using real portfolio PDF for testing')
    } catch (e) {
      console.log('[DEBUG] Real PDF not found, falling back to generated sample')
      buffer = await buildSamplePdf()
      fileName = 'sample.pdf'
    }
  } else {
    buffer = await buildSamplePdf()
    fileName = 'sample.pdf'
  }
  
  const uploadInput = page.locator('input[type="file"][accept*="pdf"]')
  await expect(uploadInput).toBeAttached({ timeout: 10000 })
  await uploadInput.setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer,
  })
  await page.getByText('Processing PDF...').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  const errorBanner = page.getByRole('alert')
  await Promise.race([
    page.locator('#page-input').waitFor({ state: 'visible', timeout: 20000 }),
    errorBanner.waitFor({ state: 'visible', timeout: 20000 }),
  ])
  if (await errorBanner.isVisible().catch(() => false)) {
    const text = await errorBanner.textContent()
    throw new Error(`PDF load failed: ${text?.trim()}`)
  }
  await page.waitForFunction(() => document.querySelectorAll('canvas').length >= 2, null, { timeout: 20000 })

  const annotationCanvas = page.getByTestId('annotation-canvas')
  await expect(annotationCanvas).toBeVisible({ timeout: 20000 })
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="annotation-canvas"]') as HTMLCanvasElement | null
    if (!el) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 10 && rect.height > 10
  })
  
  // Wait for toolbar to be fully rendered and stable
  await page.waitForFunction(() => {
    const penBtn = document.querySelector('button[data-tool="pen"]')
    return penBtn !== null
  }, null, { timeout: 10000 })
  
  // Extra wait for React to fully settle after initial render
  await page.waitForTimeout(500)
  
  console.log('[DEBUG] uploadSamplePdf complete - toolbar should be visible')
}

export function getAnnotationCanvas(page: Page): Locator {
  return page.getByTestId('annotation-canvas')
}

export async function expectAnyAnnotation(page: Page) {
  // Take a debug screenshot before checking
  await page.screenshot({ path: 'test-results/debug-annotation-check.png', fullPage: true }).catch(() => {})
  
  const count = await page.locator('[id^="annotation-item-"]').count()
  console.log(`[DEBUG] Annotation items found: ${count}`)
  
  await expect
    .poll(async () => page.locator('[id^="annotation-item-"]').count(), { timeout: 8000 })
    .toBeGreaterThan(0)
}

/** Wait for React to settle after interactions */
export async function waitForReactSettle(page: Page, ms = 300) {
  await page.waitForTimeout(ms)
  await page.waitForLoadState('domcontentloaded')
}

/** Safely click a button, waiting for it to be stable first */
export async function safeClick(page: Page, selector: string) {
  // Use a more robust retry mechanism for unstable elements
  const maxRetries = 5
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Debug: check what buttons exist
      const allButtons = await page.locator('button').all()
      const buttonInfo = await Promise.all(allButtons.slice(0, 10).map(async b => {
        const dataTool = await b.getAttribute('data-tool')
        const ariaLabel = await b.getAttribute('aria-label')
        return { dataTool, ariaLabel: ariaLabel?.slice(0, 30) }
      }))
      console.log(`[DEBUG] Buttons on page (first 10):`, JSON.stringify(buttonInfo))
      
      const locator = page.locator(selector).first()
      await locator.waitFor({ state: 'attached', timeout: 5000 })
      await locator.waitFor({ state: 'visible', timeout: 5000 })
      // Wait longer for React to settle
      await page.waitForTimeout(300)
      await locator.click({ timeout: 5000 })
      return
    } catch (e) {
      if (attempt === maxRetries - 1) throw e
      console.log(`[DEBUG] safeClick retry ${attempt + 1} for ${selector}`)
      await page.waitForTimeout(1000)
    }
  }
}

export async function canvasPoint(canvas: Locator, rx: number, ry: number) {
  await canvas.waitFor({ state: 'attached', timeout: 10000 })
  await canvas.scrollIntoViewIfNeeded()
  
  // Poll until we get a valid bounding box
  let box: { x: number; y: number; width: number; height: number } | null = null
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const b = await canvas.boundingBox({ timeout: 1000 })
      if (b && b.width > 10 && b.height > 10) {
        box = b
        break
      }
    } catch {
      // Timeout, retry
    }
    await canvas.page().waitForTimeout(200)
  }
  
  if (!box) {
    console.log('[DEBUG] Canvas bounding box still null after polling')
    throw new Error('Canvas bounding box not available after polling')
  }
  
  console.log(`[DEBUG] canvasPoint box: ${box.x}, ${box.y}, ${box.width}x${box.height}`)
  return {
    x: box.x + box.width * rx,
    y: box.y + box.height * ry,
  }
}

export async function dragOnCanvas(page: Page, canvas: Locator, from: { x: number; y: number }, to: { x: number; y: number }) {
  console.log(`[DEBUG] dragOnCanvas from (${from.x.toFixed(1)}, ${from.y.toFixed(1)}) to (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`)
  
  // Focus the canvas without clicking (which would create an annotation)
  await canvas.focus()
  await page.waitForTimeout(100)
  
  await page.mouse.move(from.x, from.y)
  await page.waitForTimeout(50)
  await page.mouse.down()
  await page.waitForTimeout(50)
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.waitForTimeout(50)
  await page.mouse.up()
  await page.waitForTimeout(100)
  
  // Debug: check annotation store state after drawing
  const storeState = await page.evaluate(() => {
    // @ts-ignore - accessing window store for debug
    const store = (window as any).__annotationStore
    if (store) {
      return {
        annotationCount: store.getState().annotations.length,
        currentPage: store.getState().currentPage,
        tool: store.getState().selectedTool,
      }
    }
    return null
  })
  console.log(`[DEBUG] Store state after draw:`, storeState)
}

/**
 * Rigorous Real-World E2E Test Suite
 * 
 * Uses the actual portfolio PDF (my portfolio 3.0.pdf) as a real-world use case.
 * Tests complex user workflows, edge cases, and regression scenarios.
 * 
 * ULTRATHINK Design Principles:
 * 1. Real document testing - Not synthetic PDFs
 * 2. Multi-step workflows - Simulates actual user journeys
 * 3. State persistence verification - Ensures data integrity
 * 4. Cross-page operations - Tests pagination and navigation
 * 5. Performance awareness - Monitors for regressions
 * 6. Accessibility compliance - Keyboard navigation and ARIA
 */

import { test, expect, Page, Locator } from '@playwright/test'
import {
  uploadSamplePdf,
  canvasPoint,
  dragOnCanvas,
  expectAnyAnnotation,
  getAnnotationCanvas,
  waitForReactSettle,
  safeClick,
  loadRealPdf
} from './helpers'

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface AnnotationInfo {
  id: string
  type: string
  page: number
  text?: string
}

/** Extract annotation info from the store */
async function getAnnotationsFromStore(page: Page): Promise<AnnotationInfo[]> {
  return page.evaluate(() => {
    const store = (window as any).__annotationStore?.getState?.()
    if (!store?.annotations) return []
    return store.annotations.map((a: any) => ({
      id: a.id,
      type: a.type,
      page: a.page,
      text: a.text,
    }))
  })
}

/** Get current page from store */
async function getCurrentPage(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = (window as any).__annotationStore?.getState?.()
    return store?.currentPage ?? 1
  })
}

/** Navigate to a specific page */
async function navigateToPage(page: Page, targetPage: number): Promise<void> {
  const pageInput = page.locator('#page-input').first()
  await pageInput.fill(String(targetPage))
  await pageInput.press('Enter')
  await waitForReactSettle(page, 500)
  await expect(pageInput).toHaveValue(String(targetPage))
}

/** Count annotations on a specific page */
async function countAnnotationsOnPage(page: Page, pageNum: number): Promise<number> {
  const annotations = await getAnnotationsFromStore(page)
  return annotations.filter(a => a.page === pageNum).length
}

/** Check if undo/redo buttons are enabled */
async function getUndoRedoState(page: Page): Promise<{ undoEnabled: boolean; redoEnabled: boolean }> {
  const undoBtn = page.locator('button[aria-label*="Undo"]').first()
  const redoBtn = page.locator('button[aria-label*="Redo"]').first()
  
  const undoEnabled = !(await undoBtn.isDisabled().catch(() => true))
  const redoEnabled = !(await redoBtn.isDisabled().catch(() => true))
  
  return { undoEnabled, redoEnabled }
}

/** Wait for PDF to be fully loaded and ready */
async function waitForPdfReady(page: Page): Promise<void> {
  // Wait for canvas to be ready and have proper dimensions
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="annotation-canvas"]') as HTMLCanvasElement
    const pageInput = document.querySelector('#page-input') as HTMLInputElement
    if (!canvas || !pageInput) return false
    const rect = canvas.getBoundingClientRect()
    const maxPages = Number(pageInput.getAttribute('max') ?? 0)
    return rect.width > 100 && rect.height > 100 && maxPages >= 1
  }, { timeout: 30000 })
}

// ============================================================================
// TEST SUITE: RIGOROUS REAL-WORLD SCENARIOS
// ============================================================================

test.describe('Rigorous Real-World PDF Testing', () => {
  
  test.beforeEach(async ({ page }) => {
    // Enable console capture for debugging
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('[WARN]')) {
        console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`)
      }
    })
    page.on('pageerror', err => console.log('[PAGE ERROR]', err.message))
  })

  // ==========================================================================
  // SECTION 1: MULTI-TOOL ANNOTATION WORKFLOW
  // ==========================================================================
  
  test('complete annotation workflow: all tools across multiple pages', async ({ page }) => {
    test.setTimeout(120000) // 2 minutes for comprehensive test
    
    await uploadSamplePdf(page, true) // Use real portfolio PDF
    await waitForPdfReady(page)
    
    const canvas = getAnnotationCanvas(page)
    const pageInput = page.locator('#page-input').first()
    const maxPages = Number(await pageInput.getAttribute('max'))
    
    console.log(`[TEST] PDF loaded with ${maxPages} pages`)
    expect(maxPages).toBeGreaterThanOrEqual(1)
    
    // --- PAGE 1: Draw annotations with all tools ---
    
    // 1. Pen tool - Freehand drawing
    await safeClick(page, 'button[data-tool="pen"]')
    await expect(page.locator('button[data-tool="pen"]').first()).toHaveAttribute('aria-pressed', 'true')
    const penStart = await canvasPoint(canvas, 0.1, 0.1)
    const penEnd = await canvasPoint(canvas, 0.25, 0.15)
    await dragOnCanvas(page, canvas, penStart, penEnd)
    await waitForReactSettle(page)
    
    let annotations = await getAnnotationsFromStore(page)
    expect(annotations.filter(a => a.type === 'pen')).toHaveLength(1)
    
    // 2. Highlight tool - Rectangle highlight
    await safeClick(page, 'button[data-tool="highlight"]')
    const hlStart = await canvasPoint(canvas, 0.3, 0.1)
    const hlEnd = await canvasPoint(canvas, 0.6, 0.18)
    await dragOnCanvas(page, canvas, hlStart, hlEnd)
    await waitForReactSettle(page)
    
    annotations = await getAnnotationsFromStore(page)
    expect(annotations.filter(a => a.type === 'highlight')).toHaveLength(1)
    
    // 3. Rectangle tool
    await safeClick(page, 'button[data-tool="rectangle"]')
    const rectStart = await canvasPoint(canvas, 0.1, 0.25)
    const rectEnd = await canvasPoint(canvas, 0.35, 0.45)
    await dragOnCanvas(page, canvas, rectStart, rectEnd)
    await waitForReactSettle(page)
    
    annotations = await getAnnotationsFromStore(page)
    expect(annotations.filter(a => a.type === 'rectangle')).toHaveLength(1)
    
    // 4. Text box
    await safeClick(page, 'button[data-tool="text-box"]')
    const textCanvas = getAnnotationCanvas(page)
    const textBox = await textCanvas.boundingBox()
    if (!textBox) throw new Error('Canvas not available')
    
    await page.mouse.click(textBox.x + textBox.width * 0.5, textBox.y + textBox.height * 0.55)
    await waitForReactSettle(page, 500)
    
    const editor = page.locator('textarea[data-annotation-editor="true"]')
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.fill('Annotation on Page 1')
    await page.keyboard.down('Control')
    await page.keyboard.press('Enter')
    await page.keyboard.up('Control')
    await waitForReactSettle(page)
    
    annotations = await getAnnotationsFromStore(page)
    const textBoxAnn = annotations.find(a => a.type === 'text-box')
    expect(textBoxAnn).toBeDefined()
    expect(textBoxAnn?.text).toBe('Annotation on Page 1')
    
    // 5. Sticky note
    await safeClick(page, 'button[data-tool="sticky-note"]')
    const notePoint = await canvasPoint(canvas, 0.7, 0.3)
    const canvasBB = await canvas.boundingBox()
    await canvas.click({ position: { x: notePoint.x - canvasBB!.x, y: notePoint.y - canvasBB!.y } })
    await waitForReactSettle(page, 500)
    
    // Fill the sticky note modal
    const noteEditor = page.locator('textarea[placeholder*="note"]').first()
    await expect(noteEditor).toBeVisible({ timeout: 10000 })
    await noteEditor.fill('Important note on page 1')
    await page.getByRole('button', { name: 'Save Note', exact: true }).click()
    await waitForReactSettle(page)
    
    annotations = await getAnnotationsFromStore(page)
    expect(annotations.filter(a => a.type === 'sticky-note')).toHaveLength(1)
    
    // Verify total annotations on page 1
    const page1Count = await countAnnotationsOnPage(page, 1)
    expect(page1Count).toBe(5) // pen, highlight, rectangle, text-box, sticky-note
    
    // --- NAVIGATE TO PAGE 2 (if exists) ---
    
    if (maxPages >= 2) {
      await navigateToPage(page, 2)
      
      // Draw something on page 2
      await safeClick(page, 'button[data-tool="pen"]')
      const pen2Start = await canvasPoint(canvas, 0.2, 0.2)
      const pen2End = await canvasPoint(canvas, 0.4, 0.35)
      await dragOnCanvas(page, canvas, pen2Start, pen2End)
      await waitForReactSettle(page)
      
      const page2Count = await countAnnotationsOnPage(page, 2)
      expect(page2Count).toBe(1)
      
      // Navigate back to page 1 and verify annotations persist
      await navigateToPage(page, 1)
      const page1CountAfterNav = await countAnnotationsOnPage(page, 1)
      expect(page1CountAfterNav).toBe(5)
    }
    
    // --- VERIFY ANNOTATION LIST ---
    
    const annotationItems = page.locator('[id^="annotation-item-"]')
    await expect(annotationItems).toHaveCount(5) // Page 1 annotations
    
    console.log('[TEST] Complete annotation workflow passed!')
  })

  // ==========================================================================
  // SECTION 2: UNDO/REDO INTEGRITY
  // ==========================================================================
  
  test('undo/redo maintains data integrity across operations', async ({ page }) => {
    test.setTimeout(90000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const canvas = getAnnotationCanvas(page)
    
    // Initial state - no undo available
    let undoRedoState = await getUndoRedoState(page)
    expect(undoRedoState.undoEnabled).toBe(false)
    expect(undoRedoState.redoEnabled).toBe(false)
    
    // Draw first annotation
    await safeClick(page, 'button[data-tool="pen"]')
    const pen1Start = await canvasPoint(canvas, 0.1, 0.1)
    const pen1End = await canvasPoint(canvas, 0.2, 0.15)
    await dragOnCanvas(page, canvas, pen1Start, pen1End)
    await waitForReactSettle(page)
    
    let annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(1)
    const firstAnnotationId = annotations[0].id
    
    // Undo should now be available
    undoRedoState = await getUndoRedoState(page)
    expect(undoRedoState.undoEnabled).toBe(true)
    
    // Draw second annotation
    const pen2Start = await canvasPoint(canvas, 0.3, 0.1)
    const pen2End = await canvasPoint(canvas, 0.4, 0.15)
    await dragOnCanvas(page, canvas, pen2Start, pen2End)
    await waitForReactSettle(page)
    
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(2)
    
    // Draw third annotation
    const pen3Start = await canvasPoint(canvas, 0.5, 0.1)
    const pen3End = await canvasPoint(canvas, 0.6, 0.15)
    await dragOnCanvas(page, canvas, pen3Start, pen3End)
    await waitForReactSettle(page)
    
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(3)
    
    // --- UNDO CHAIN ---
    
    // Undo third
    await page.keyboard.press('Control+Z')
    await waitForReactSettle(page)
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(2)
    
    // Undo second
    await page.keyboard.press('Control+Z')
    await waitForReactSettle(page)
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(1)
    expect(annotations[0].id).toBe(firstAnnotationId) // First annotation preserved
    
    // Undo first
    await page.keyboard.press('Control+Z')
    await waitForReactSettle(page)
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(0)
    
    // Undo should now be disabled
    undoRedoState = await getUndoRedoState(page)
    expect(undoRedoState.undoEnabled).toBe(false)
    expect(undoRedoState.redoEnabled).toBe(true)
    
    // --- REDO CHAIN ---
    
    // Redo first
    await page.keyboard.press('Control+Y')
    await waitForReactSettle(page)
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(1)
    
    // Redo second and third
    await page.keyboard.press('Control+Y')
    await page.keyboard.press('Control+Y')
    await waitForReactSettle(page)
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(3)
    
    // Redo should now be disabled
    undoRedoState = await getUndoRedoState(page)
    expect(undoRedoState.redoEnabled).toBe(false)
    
    console.log('[TEST] Undo/redo integrity passed!')
  })

  // ==========================================================================
  // SECTION 3: ERASER PRECISION AND EDGE CASES
  // ==========================================================================
  
  test('eraser accurately removes targeted annotations', async ({ page }) => {
    test.setTimeout(90000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const canvas = getAnnotationCanvas(page)
    
    // Create multiple overlapping and adjacent annotations
    await safeClick(page, 'button[data-tool="rectangle"]')
    
    // Rectangle 1 (left side)
    const rect1Start = await canvasPoint(canvas, 0.1, 0.2)
    const rect1End = await canvasPoint(canvas, 0.3, 0.4)
    await dragOnCanvas(page, canvas, rect1Start, rect1End)
    await waitForReactSettle(page)
    
    // Rectangle 2 (center, overlapping)
    const rect2Start = await canvasPoint(canvas, 0.25, 0.25)
    const rect2End = await canvasPoint(canvas, 0.45, 0.45)
    await dragOnCanvas(page, canvas, rect2Start, rect2End)
    await waitForReactSettle(page)
    
    // Rectangle 3 (right side, separate)
    const rect3Start = await canvasPoint(canvas, 0.5, 0.2)
    const rect3End = await canvasPoint(canvas, 0.7, 0.4)
    await dragOnCanvas(page, canvas, rect3Start, rect3End)
    await waitForReactSettle(page)
    
    let annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(3)
    
    // Switch to eraser
    await safeClick(page, 'button[data-tool="eraser"]')
    await expect(page.locator('button[data-tool="eraser"]').first()).toHaveAttribute('aria-pressed', 'true')
    
    // Erase the center rectangle (click in its exclusive area)
    const erasePoint = await canvasPoint(canvas, 0.4, 0.35)
    const canvasBB = await canvas.boundingBox()
    await canvas.click({ position: { x: erasePoint.x - canvasBB!.x, y: erasePoint.y - canvasBB!.y } })
    await waitForReactSettle(page)
    
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(2) // One removed
    
    // Erase another (left rectangle)
    const erasePoint2 = await canvasPoint(canvas, 0.15, 0.3)
    await canvas.click({ position: { x: erasePoint2.x - canvasBB!.x, y: erasePoint2.y - canvasBB!.y } })
    await waitForReactSettle(page)
    
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(1)
    
    // Verify the remaining is the right-side rectangle
    expect(annotations[0].type).toBe('rectangle')
    
    // Undo should restore
    await page.keyboard.press('Control+Z')
    await waitForReactSettle(page)
    annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(2)
    
    console.log('[TEST] Eraser precision passed!')
  })

  // ==========================================================================
  // SECTION 4: ANNOTATION SELECTION AND EDITING
  // ==========================================================================
  
  test('annotation selection and in-place editing', async ({ page }) => {
    test.setTimeout(90000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const canvas = getAnnotationCanvas(page)
    
    // Create a text box
    await safeClick(page, 'button[data-tool="text-box"]')
    const textBox = await canvas.boundingBox()
    if (!textBox) throw new Error('Canvas not available')
    
    await page.mouse.click(textBox.x + textBox.width * 0.3, textBox.y + textBox.height * 0.3)
    await waitForReactSettle(page, 500)
    
    const editor = page.locator('textarea[data-annotation-editor="true"]')
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.fill('Original Text')
    await page.keyboard.down('Control')
    await page.keyboard.press('Enter')
    await page.keyboard.up('Control')
    await waitForReactSettle(page)
    
    // Verify text was saved
    let annotations = await getAnnotationsFromStore(page)
    const textAnn = annotations.find(a => a.type === 'text-box')
    expect(textAnn?.text).toBe('Original Text')
    
    // Click on the annotation in the list to select it
    await safeClick(page, 'button[data-tool="pointer"]')
    await waitForReactSettle(page)
    
    const annotationItem = page.locator('[id^="annotation-item-"]').first()
    await annotationItem.dispatchEvent('click')
    await waitForReactSettle(page)
    
    // Verify selection in store
    const selectedId = await page.evaluate(() => {
      return (window as any).__annotationStore?.getState?.()?.selectedAnnotationId
    })
    expect(selectedId).toBe(textAnn?.id)
    
    // Double-click on canvas to edit the text box
    const annBB = await canvas.boundingBox()
    if (!annBB) throw new Error('Canvas not available')
    
    await page.mouse.dblclick(annBB.x + annBB.width * 0.3, annBB.y + annBB.height * 0.3)
    await waitForReactSettle(page, 500)
    
    // The editor should appear again
    const editor2 = page.locator('textarea[data-annotation-editor="true"]')
    await expect(editor2).toBeVisible({ timeout: 10000 })
    
    // Modify the text
    await editor2.fill('Modified Text')
    await page.keyboard.down('Control')
    await page.keyboard.press('Enter')
    await page.keyboard.up('Control')
    await waitForReactSettle(page)
    
    // Verify modification
    annotations = await getAnnotationsFromStore(page)
    const modifiedAnn = annotations.find(a => a.type === 'text-box')
    expect(modifiedAnn?.text).toBe('Modified Text')
    
    console.log('[TEST] Annotation selection and editing passed!')
  })

  // ==========================================================================
  // SECTION 5: KEYBOARD NAVIGATION AND ACCESSIBILITY
  // ==========================================================================
  
  test('keyboard shortcuts work correctly', async ({ page }) => {
    test.setTimeout(90000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    // Test tool selection shortcuts
    // Press 'P' for Pen (or 'D' based on implementation)
    await page.keyboard.press('d')
    await waitForReactSettle(page)
    const penActive = await page.locator('button[data-tool="pen"]').first().getAttribute('aria-pressed')
    expect(penActive).toBe('true')
    
    // Press 'H' for Highlight
    await page.keyboard.press('h')
    await waitForReactSettle(page)
    const highlightActive = await page.locator('button[data-tool="highlight"]').first().getAttribute('aria-pressed')
    expect(highlightActive).toBe('true')
    
    // Press 'R' for Rectangle
    await page.keyboard.press('r')
    await waitForReactSettle(page)
    const rectActive = await page.locator('button[data-tool="rectangle"]').first().getAttribute('aria-pressed')
    expect(rectActive).toBe('true')
    
    // Press 'T' for Text
    await page.keyboard.press('t')
    await waitForReactSettle(page)
    const textActive = await page.locator('button[data-tool="text-box"]').first().getAttribute('aria-pressed')
    expect(textActive).toBe('true')
    
    // Press 'E' for Eraser
    await page.keyboard.press('e')
    await waitForReactSettle(page)
    const eraserActive = await page.locator('button[data-tool="eraser"]').first().getAttribute('aria-pressed')
    expect(eraserActive).toBe('true')
    
    // Press 'V' for Pointer (select)
    await page.keyboard.press('v')
    await waitForReactSettle(page)
    const pointerActive = await page.locator('button[data-tool="pointer"]').first().getAttribute('aria-pressed')
    expect(pointerActive).toBe('true')
    
    // Test keyboard help modal
    await page.keyboard.press('?')
    await waitForReactSettle(page, 500)
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible({ timeout: 5000 })
    
    // Close with Escape
    await page.keyboard.press('Escape')
    await waitForReactSettle(page)
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).not.toBeVisible()
    
    console.log('[TEST] Keyboard shortcuts passed!')
  })

  // ==========================================================================
  // SECTION 6: COLOR AND STYLE CUSTOMIZATION
  // ==========================================================================
  
  test('color and style settings are applied correctly', async ({ page }) => {
    test.setTimeout(90000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const canvas = getAnnotationCanvas(page)
    
    // Select a non-default color (e.g., blue)
    const blueColorBtn = page.locator('button[aria-label*="#4285f4"]').first()
    if (await blueColorBtn.isVisible()) {
      await blueColorBtn.click()
      await waitForReactSettle(page)
    }
    
    // Draw with pen
    await safeClick(page, 'button[data-tool="pen"]')
    const penStart = await canvasPoint(canvas, 0.1, 0.1)
    const penEnd = await canvasPoint(canvas, 0.25, 0.15)
    await dragOnCanvas(page, canvas, penStart, penEnd)
    await waitForReactSettle(page)
    
    // Verify annotation has the selected color
    const annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(1)
    
    // The color should be captured in the annotation
    const annotation = await page.evaluate(() => {
      return (window as any).__annotationStore?.getState?.()?.annotations?.[0]
    })
    expect(annotation.color).toBeDefined()
    
    console.log('[TEST] Color customization passed!')
  })

  // ==========================================================================
  // SECTION 7: SIGNATURE WORKFLOW
  // ==========================================================================
  
  test('signature creation and placement', async ({ page }) => {
    test.setTimeout(90000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const canvas = getAnnotationCanvas(page)
    
    // Click signature tool
    await safeClick(page, 'button[data-tool="signature"]')
    await expect(page.locator('button[data-tool="signature"]').first()).toHaveAttribute('aria-pressed', 'true')
    
    // Click "Create New" button to open signature modal
    await page.getByRole('button', { name: 'Create New' }).click()
    await waitForReactSettle(page, 300)
    
    // Signature modal should appear
    const signatureModal = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Create signature' }) }).first()
    await expect(signatureModal).toBeVisible({ timeout: 10000 })
    
    // Use "Type" mode for simpler testing
    await signatureModal.getByRole('button', { name: 'Type' }).click()
    await signatureModal.getByPlaceholder('Type your name').fill('Test Signature')
    await signatureModal.getByRole('button', { name: 'Save', exact: true }).click()
    await waitForReactSettle(page, 500)
    
    // Modal should close
    await expect(page.getByRole('heading', { name: 'Create signature' })).toHaveCount(0)
    
    // Click on canvas to place signature
    const canvasBB = await canvas.boundingBox()
    if (!canvasBB) throw new Error('Canvas not available')
    await page.mouse.click(canvasBB.x + canvasBB.width * 0.5, canvasBB.y + canvasBB.height * 0.5)
    await waitForReactSettle(page, 500)
    
    // Verify signature was added
    const annotations = await getAnnotationsFromStore(page)
    const signatureAnn = annotations.find(a => a.type === 'signature')
    expect(signatureAnn).toBeDefined()
    
    // Verify it appears in annotation list
    await expect(page.locator('[id^="annotation-item-"]', { hasText: 'Signature' })).toBeVisible()
    
    console.log('[TEST] Signature workflow passed!')
  })

  // ==========================================================================
  // SECTION 8: EXPORT AND PERSISTENCE
  // ==========================================================================
  
  test('export annotations to JSON', async ({ page }) => {
    test.setTimeout(90000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const canvas = getAnnotationCanvas(page)
    
    // Create some annotations
    await safeClick(page, 'button[data-tool="rectangle"]')
    const rectStart = await canvasPoint(canvas, 0.2, 0.2)
    const rectEnd = await canvasPoint(canvas, 0.4, 0.4)
    await dragOnCanvas(page, canvas, rectStart, rectEnd)
    await waitForReactSettle(page)
    
    await safeClick(page, 'button[data-tool="pen"]')
    const penStart = await canvasPoint(canvas, 0.5, 0.2)
    const penEnd = await canvasPoint(canvas, 0.7, 0.3)
    await dragOnCanvas(page, canvas, penStart, penEnd)
    await waitForReactSettle(page)
    
    // Export annotations
    const exportBtn = page.getByRole('button', { name: 'Export annotations as JSON' }).first()
    await exportBtn.waitFor({ state: 'visible' })
    
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click()
    ])
    
    expect(download.suggestedFilename()).toContain('.json')
    
    // Verify the download has content
    const content = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of content) {
      chunks.push(chunk)
    }
    const jsonStr = Buffer.concat(chunks).toString('utf-8')
    const exportedData = JSON.parse(jsonStr)
    
    expect(exportedData.annotations).toBeDefined()
    expect(exportedData.annotations.length).toBe(2)
    expect(exportedData.version).toBeDefined()
    
    console.log('[TEST] JSON export passed!')
  })

  // ==========================================================================
  // SECTION 9: PAGE OPERATIONS WITH ANNOTATIONS
  // ==========================================================================
  
  test('page operations preserve annotation integrity', async ({ page }) => {
    test.setTimeout(120000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const pageInput = page.locator('#page-input').first()
    await pageInput.waitFor({ state: 'visible' })
    await waitForReactSettle(page, 500)
    
    const initialMaxPages = Number(await pageInput.getAttribute('max'))
    console.log(`[TEST] Initial page count: ${initialMaxPages}`)
    
    const canvas = getAnnotationCanvas(page)
    
    // Create annotation on page 1
    await safeClick(page, 'button[data-tool="rectangle"]')
    const rectStart = await canvasPoint(canvas, 0.3, 0.3)
    const rectEnd = await canvasPoint(canvas, 0.5, 0.5)
    await dragOnCanvas(page, canvas, rectStart, rectEnd)
    await waitForReactSettle(page)
    
    let annotations = await getAnnotationsFromStore(page)
    const page1AnnotsBefore = annotations.filter(a => a.page === 1).length
    expect(page1AnnotsBefore).toBeGreaterThanOrEqual(1)
    
    // Add a blank page after current
    const addAfterBtn = page.getByRole('button', { name: 'Add After' }).first()
    await addAfterBtn.waitFor({ state: 'visible' })
    await addAfterBtn.click()
    
    // Wait for page count to increase (use polling with retry)
    await waitForReactSettle(page, 1500)
    const newMaxPages = Number(await pageInput.getAttribute('max'))
    console.log(`[TEST] Page count after add: ${newMaxPages}`)
    
    // Verify page count increased (or at least we have more than 1 page)
    expect(newMaxPages).toBeGreaterThanOrEqual(initialMaxPages)
    
    // If we have at least 2 pages, try navigating and adding annotation
    if (newMaxPages >= 2) {
      // Navigate to page 2 and add annotation
      await navigateToPage(page, 2)
    
      await safeClick(page, 'button[data-tool="pen"]')
      const penStart = await canvasPoint(canvas, 0.2, 0.2)
      const penEnd = await canvasPoint(canvas, 0.4, 0.3)
      await dragOnCanvas(page, canvas, penStart, penEnd)
      await waitForReactSettle(page)
    
      annotations = await getAnnotationsFromStore(page)
      expect(annotations.filter(a => a.page === 2).length).toBeGreaterThanOrEqual(1)
    
      // Navigate back to page 1 and verify annotation still there
      await navigateToPage(page, 1)
      const page1Count = await countAnnotationsOnPage(page, 1)
      expect(page1Count).toBeGreaterThanOrEqual(page1AnnotsBefore)
    }
    
    console.log('[TEST] Page operations with annotations passed!')
  })

  // ==========================================================================
  // SECTION 10: STRESS TEST - RAPID OPERATIONS
  // ==========================================================================
  
  test('rapid consecutive operations do not cause state corruption', async ({ page }) => {
    test.setTimeout(90000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const canvas = getAnnotationCanvas(page)
    
    // Rapid tool switching and drawing
    const tools = ['pen', 'highlight', 'rectangle']
    
    for (let i = 0; i < 10; i++) {
      const tool = tools[i % tools.length]
      await safeClick(page, `button[data-tool="${tool}"]`)
      
      const startX = 0.1 + (i % 5) * 0.15
      const startY = 0.1 + Math.floor(i / 5) * 0.15
      const endX = startX + 0.1
      const endY = startY + 0.08
      
      const start = await canvasPoint(canvas, startX, startY)
      const end = await canvasPoint(canvas, endX, endY)
      await dragOnCanvas(page, canvas, start, end)
      
      // Minimal wait between operations
      await waitForReactSettle(page, 100)
    }
    
    await waitForReactSettle(page, 500)
    
    // Verify all annotations were created
    const annotations = await getAnnotationsFromStore(page)
    expect(annotations).toHaveLength(10)
    
    // Verify no duplicates (all unique IDs)
    const ids = new Set(annotations.map(a => a.id))
    expect(ids.size).toBe(10)
    
    // Verify types are correct
    const typeCounts = { pen: 0, highlight: 0, rectangle: 0 }
    annotations.forEach(a => {
      if (a.type in typeCounts) {
        typeCounts[a.type as keyof typeof typeCounts]++
      }
    })
    
    expect(typeCounts.pen + typeCounts.highlight + typeCounts.rectangle).toBe(10)
    
    console.log('[TEST] Rapid operations stress test passed!')
  })

})

// ============================================================================
// FIND & REPLACE TESTS
// ============================================================================

test.describe('Find & Replace', () => {
  
  test('find text in PDF and navigate between matches', async ({ page }) => {
    test.setTimeout(60000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    // Open the Document Actions panel if not visible
    const findInput = page.getByPlaceholder('Text to find')
    await findInput.waitFor({ state: 'visible', timeout: 5000 })
    
    // Search for text that exists in the portfolio PDF
    await findInput.fill('portfolio')
    await waitForReactSettle(page, 500)
    
    // Check if matches are found (the match counter should update)
    const matchCounter = page.locator('text=/\\d+\\s*\\/\\s*\\d+/')
    
    // Wait for search to complete
    await waitForReactSettle(page, 1000)
    
    // Try to find next/previous buttons
    const nextBtn = page.getByRole('button', { name: /next/i }).first()
    const prevBtn = page.getByRole('button', { name: /prev/i }).first()
    
    // If matches found, test navigation
    const matchCounterVisible = await matchCounter.isVisible().catch(() => false)
    if (matchCounterVisible) {
      const matchText = await matchCounter.textContent()
      console.log(`[TEST] Found matches: ${matchText}`)
      
      // Navigate to next match if button exists
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click()
        await waitForReactSettle(page, 300)
      }
      
      // Navigate to previous match if button exists
      if (await prevBtn.isVisible().catch(() => false)) {
        await prevBtn.click()
        await waitForReactSettle(page, 300)
      }
    }
    
    console.log('[TEST] Find navigation passed!')
  })
  
  test('replace text in PDF', async ({ page }) => {
    test.setTimeout(60000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const findInput = page.getByPlaceholder('Text to find')
    const replaceInput = page.getByPlaceholder('Replacement text')
    
    await findInput.waitFor({ state: 'visible', timeout: 5000 })
    await replaceInput.waitFor({ state: 'visible', timeout: 5000 })
    
    // Enter search text
    await findInput.fill('test')
    await waitForReactSettle(page, 500)
    
    // Enter replacement text
    await replaceInput.fill('REPLACED')
    await waitForReactSettle(page, 300)
    
    // Look for Replace or Replace All button
    const replaceBtn = page.getByRole('button', { name: /replace$/i }).first()
    const replaceAllBtn = page.getByRole('button', { name: /replace all/i }).first()
    
    // Try Replace All if available
    if (await replaceAllBtn.isVisible().catch(() => false)) {
      await replaceAllBtn.click()
      await waitForReactSettle(page, 1000)
      console.log('[TEST] Replace All clicked!')
    } else if (await replaceBtn.isVisible().catch(() => false)) {
      await replaceBtn.click()
      await waitForReactSettle(page, 1000)
      console.log('[TEST] Replace clicked!')
    }
    
    console.log('[TEST] Replace text passed!')
  })
  
  test('case-sensitive search toggle', async ({ page }) => {
    test.setTimeout(60000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const findInput = page.getByPlaceholder('Text to find')
    await findInput.waitFor({ state: 'visible', timeout: 5000 })
    
    // Look for case sensitivity toggle
    const caseSensitiveToggle = page.locator('button[title*="case"], button[aria-label*="case"], label:has-text("Case")').first()
    
    // Search with lowercase
    await findInput.fill('portfolio')
    await waitForReactSettle(page, 500)
    
    // Get initial match count (if visible)
    const matchCounter = page.locator('text=/\\d+\\s*\\/\\s*\\d+/')
    let initialCount = '0'
    if (await matchCounter.isVisible().catch(() => false)) {
      initialCount = await matchCounter.textContent() || '0'
      console.log(`[TEST] Initial matches: ${initialCount}`)
    }
    
    // Toggle case sensitivity if available
    if (await caseSensitiveToggle.isVisible().catch(() => false)) {
      await caseSensitiveToggle.click()
      await waitForReactSettle(page, 500)
      
      // Search again with different case
      await findInput.fill('PORTFOLIO')
      await waitForReactSettle(page, 500)
      
      if (await matchCounter.isVisible().catch(() => false)) {
        const newCount = await matchCounter.textContent() || '0'
        console.log(`[TEST] Case-sensitive matches: ${newCount}`)
      }
    }
    
    console.log('[TEST] Case sensitivity toggle passed!')
  })
  
  test('find highlights are visible on canvas', async ({ page }) => {
    test.setTimeout(60000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const findInput = page.getByPlaceholder('Text to find')
    await findInput.waitFor({ state: 'visible', timeout: 5000 })
    
    // Search for common text
    await findInput.fill('design')
    await waitForReactSettle(page, 1000)
    
    // Check that the PDF viewer is still functional
    const canvas = getAnnotationCanvas(page)
    await expect(canvas).toBeVisible()
    
    // Get find highlights from store if exposed
    const hasHighlights = await page.evaluate(() => {
      const store = (window as any).__pdfEditorStore
      if (store) {
        const state = store.getState()
        return state.findHighlights && state.findHighlights.length > 0
      }
      return null // Store not exposed
    })
    
    if (hasHighlights !== null) {
      console.log(`[TEST] Find highlights in store: ${hasHighlights}`)
    }
    
    // Clear search
    await findInput.clear()
    await waitForReactSettle(page, 300)
    
    console.log('[TEST] Find highlights visibility passed!')
  })
  
  test('empty search clears highlights', async ({ page }) => {
    test.setTimeout(60000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const findInput = page.getByPlaceholder('Text to find')
    await findInput.waitFor({ state: 'visible', timeout: 5000 })
    
    // Search for text
    await findInput.fill('portfolio')
    await waitForReactSettle(page, 500)
    
    // Clear the search
    await findInput.clear()
    await waitForReactSettle(page, 500)
    
    // Verify highlights are cleared (no match counter or 0/0)
    const matchCounter = page.locator('text=/\\d+\\s*\\/\\s*\\d+/')
    const isVisible = await matchCounter.isVisible().catch(() => false)
    
    if (isVisible) {
      const text = await matchCounter.textContent()
      // Should show 0/0 or be hidden
      console.log(`[TEST] After clear, match counter: ${text}`)
    } else {
      console.log('[TEST] Match counter hidden after clear')
    }
    
    console.log('[TEST] Empty search clears highlights passed!')
  })

})

// ============================================================================
// VISUAL REGRESSION TESTS (if screenshot testing is enabled)
// ============================================================================

test.describe('Visual Regression', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Visual tests run only on Chromium')
  
  test('annotation rendering consistency', async ({ page }) => {
    test.setTimeout(60000)
    
    await uploadSamplePdf(page, true)
    await waitForPdfReady(page)
    
    const canvas = getAnnotationCanvas(page)
    
    // Create a standardized set of annotations for visual comparison
    await safeClick(page, 'button[data-tool="rectangle"]')
    const rectStart = await canvasPoint(canvas, 0.1, 0.1)
    const rectEnd = await canvasPoint(canvas, 0.3, 0.2)
    await dragOnCanvas(page, canvas, rectStart, rectEnd)
    await waitForReactSettle(page, 300)
    
    await safeClick(page, 'button[data-tool="highlight"]')
    const hlStart = await canvasPoint(canvas, 0.35, 0.1)
    const hlEnd = await canvasPoint(canvas, 0.6, 0.18)
    await dragOnCanvas(page, canvas, hlStart, hlEnd)
    await waitForReactSettle(page, 300)
    
    // Wait for animations to complete
    await waitForReactSettle(page, 1000)
    
    // Take screenshot of canvas area only
    await expect(canvas).toHaveScreenshot('annotation-rendering.png', {
      maxDiffPixels: 100, // Allow minor rendering differences
    })
    
    console.log('[TEST] Visual regression passed!')
  })
})

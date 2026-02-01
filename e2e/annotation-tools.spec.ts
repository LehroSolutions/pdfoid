import { test, expect } from '@playwright/test'
import { uploadSamplePdf, canvasPoint, dragOnCanvas, expectAnyAnnotation, getAnnotationCanvas, waitForReactSettle, safeClick } from './helpers'

test('annotation tools: draw, edit, and erase', async ({ page }) => {
  test.setTimeout(90000)
  
  // Listen for console messages from the browser
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[AnnotationCanvas]') || text.includes('[AnnotationList]') || text.includes('[WARN]') || msg.type() === 'error') {
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text}`)
    }
  })
  
  await uploadSamplePdf(page)
  const canvas = getAnnotationCanvas(page)

  // Pen
  await safeClick(page, 'button[data-tool="pen"]')
  await expect(page.locator('button[data-tool="pen"]').first()).toHaveAttribute('aria-pressed', 'true')
  const penStart = await canvasPoint(canvas, 0.2, 0.2)
  const penEnd = await canvasPoint(canvas, 0.38, 0.28)
  await dragOnCanvas(page, canvas, penStart, penEnd)
  await waitForReactSettle(page)
  await expectAnyAnnotation(page)

  // Highlight
  await safeClick(page, 'button[data-tool="highlight"]')
  await expect(page.locator('button[data-tool="highlight"]').first()).toHaveAttribute('aria-pressed', 'true')
  const hiStart = await canvasPoint(canvas, 0.4, 0.2)
  const hiEnd = await canvasPoint(canvas, 0.7, 0.3)
  await dragOnCanvas(page, canvas, hiStart, hiEnd)
  await waitForReactSettle(page)
  await expectAnyAnnotation(page)

  // Rectangle
  await safeClick(page, 'button[data-tool="rectangle"]')
  await expect(page.locator('button[data-tool="rectangle"]').first()).toHaveAttribute('aria-pressed', 'true')
  const rectStart = await canvasPoint(canvas, 0.2, 0.42)
  const rectEnd = await canvasPoint(canvas, 0.42, 0.62)
  await dragOnCanvas(page, canvas, rectStart, rectEnd)
  await waitForReactSettle(page)
  await expectAnyAnnotation(page)

  // Text Box
  await safeClick(page, 'button[data-tool="text-box"]')
  await expect(page.locator('button[data-tool="text-box"]').first()).toHaveAttribute('aria-pressed', 'true')
  await waitForReactSettle(page)
  
  // Get fresh canvas reference
  const textCanvas = getAnnotationCanvas(page)
  await expect(textCanvas).toBeVisible()
  const textBox = await textCanvas.boundingBox()
  if (!textBox) throw new Error('Canvas bounding box not available for text-box')
  
  // Click at center of canvas using absolute coordinates
  const textClickAbsX = textBox.x + textBox.width * 0.6
  const textClickAbsY = textBox.y + textBox.height * 0.42
  console.log(`[DEBUG] Text-box click at absolute (${textClickAbsX}, ${textClickAbsY})`)
  
  // Use dispatchEvent to simulate click directly
  await page.mouse.click(textClickAbsX, textClickAbsY)
  await waitForReactSettle(page, 500)
  
  // Check annotation count after click
  const countAfterClick = await page.evaluate(() => (window as any).__annotationStore?.getState?.()?.annotations?.length ?? 0)
  console.log(`[DEBUG] Annotation count after text-box click: ${countAfterClick}`)
  
  // Check for textarea
  const editor = page.locator('textarea[data-annotation-editor="true"]')
  console.log(`[DEBUG] Looking for textarea...`)
  
  // Dump all textareas in the page
  const textareas = await page.locator('textarea').all()
  console.log(`[DEBUG] Found ${textareas.length} textarea(s) in the page`)
  for (const ta of textareas) {
    const attrs = await ta.evaluate((el) => ({
      id: el.id,
      className: el.className,
      dataAnnotationEditor: (el as HTMLElement).dataset?.annotationEditor,
      visible: (el as HTMLElement).offsetParent !== null,
      style: el.getAttribute('style'),
    }))
    console.log(`[DEBUG] Textarea: ${JSON.stringify(attrs)}`)
  }
  
  // Check if annotation canvas still exists
  const annotationCanvas = await page.locator('[data-testid="annotation-canvas"]').count()
  console.log(`[DEBUG] Annotation canvas count: ${annotationCanvas}`)
  
  // Check if the parent of annotation canvas contains any children
  const parentInfo = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="annotation-canvas"]')
    if (!canvas) return { canvasExists: false }
    const parent = canvas.parentElement
    return {
      canvasExists: true,
      parentTagName: parent?.tagName,
      siblingCount: parent?.children.length,
      siblings: Array.from(parent?.children || []).map(c => ({ tag: c.tagName, testid: (c as HTMLElement).dataset?.testid, dataDebug: (c as HTMLElement).dataset?.debugTextarea })),
    }
  })
  console.log(`[DEBUG] Parent info: ${JSON.stringify(parentInfo)}`)
  
  // Check editingAnnotation state
  const editingState = await page.evaluate(() => {
    const store = (window as any).__annotationStore?.getState?.()
    // Access React component state if possible
    const annotationCanvas = document.querySelector('[data-testid="annotation-canvas"]')
    // @ts-ignore
    const reactFiber = annotationCanvas?._reactFiber$ || annotationCanvas?.__reactFiber$ || Object.keys(annotationCanvas || {}).find(k => k.startsWith('__reactFiber'))
    return {
      annotations: store?.annotations?.slice(-2)?.map((a: any) => ({ id: a.id, type: a.type, text: a.text })),
      selectedTool: store?.selectedTool,
      reactFiberKey: reactFiber,
    }
  })
  console.log(`[DEBUG] Store state: ${JSON.stringify(editingState)}`)
  
  // Take screenshot before assertion
  await page.screenshot({ path: 'test-results/debug-textbox-click.png', fullPage: true }).catch(() => {})
  
  await expect(editor).toBeVisible({ timeout: 10000 })
  await editor.fill('Hello Box')
  await page.keyboard.down('Control')
  await page.keyboard.press('Enter')
  await page.keyboard.up('Control')
  await waitForReactSettle(page)
  await expect(page.locator('[id^="annotation-item-"]', { hasText: 'Hello Box' })).toBeVisible({ timeout: 10000 })

  // Sticky Note
  await waitForReactSettle(page)
  console.log('[DEBUG] Clicking sticky-note tool button...')
  await safeClick(page, 'button[data-tool="sticky-note"]')
  await expect(page.locator('button[data-tool="sticky-note"]').first()).toHaveAttribute('aria-pressed', 'true')
  console.log('[DEBUG] Sticky-note tool selected, waiting for React settle...')
  await waitForReactSettle(page)
  const notePoint = await canvasPoint(canvas, 0.62, 0.62)
  console.log(`[DEBUG] Sticky note click point: (${notePoint.x}, ${notePoint.y})`)
  const canvasBB = await canvas.boundingBox()
  console.log(`[DEBUG] Canvas bounding box: x=${canvasBB?.x}, y=${canvasBB?.y}, w=${canvasBB?.width}, h=${canvasBB?.height}`)
  await canvas.click({ position: { x: notePoint.x - canvasBB!.x, y: notePoint.y - canvasBB!.y } })
  console.log('[DEBUG] Canvas clicked for sticky note')
  await waitForReactSettle(page, 500)
  
  // Debug: Check for modal
  const modalVisible = await page.locator('text=Type your note here...').isVisible()
  console.log(`[DEBUG] Sticky note modal visible: ${modalVisible}`)
  
  // Debug: Check for any placeholder
  const allPlaceholders = await page.locator('[placeholder]').all()
  console.log(`[DEBUG] Found ${allPlaceholders.length} elements with placeholder`)
  for (const ph of allPlaceholders) {
    const text = await ph.getAttribute('placeholder')
    const visible = await ph.isVisible()
    console.log(`[DEBUG] Placeholder: "${text}" visible: ${visible}`)
  }
  
  const noteEditor = page.getByPlaceholder('Type your note here...')
  await expect(noteEditor).toBeVisible({ timeout: 10000 })
  console.log('[DEBUG] Note editor is visible, filling text...')
  await noteEditor.fill('Sticky note e2e')
  
  // Debug: Check the textarea value after fill
  const textareaValue = await noteEditor.inputValue()
  console.log(`[DEBUG] Textarea value after fill: "${textareaValue}"`)
  
  console.log('[DEBUG] Clicking Save Note button...')
  await page.getByRole('button', { name: 'Save Note' }).click()
  console.log('[DEBUG] Save Note clicked')
  await waitForReactSettle(page)
  
  // Debug: Check annotations after save
  const annotationsAfterSave = await page.evaluate(() => {
    return (window as any).__annotationStore?.getState?.()?.annotations?.map((a: any) => ({ id: a.id.slice(0,8), type: a.type, text: a.text?.slice(0,30), page: a.page }))
  })
  console.log(`[DEBUG] Annotations after save: ${JSON.stringify(annotationsAfterSave)}`)
  
  // Debug: Check currentPage
  const currentPage = await page.evaluate(() => {
    return (window as any).__annotationStore?.getState?.()?.currentPage
  })
  console.log(`[DEBUG] Current page in store: ${currentPage}`)
  
  // Debug: Check what annotation items are visible in the list
  const annotationItems = await page.locator('[id^="annotation-item-"]').all()
  console.log(`[DEBUG] Found ${annotationItems.length} annotation items in list`)
  for (const item of annotationItems) {
    const id = await item.getAttribute('id')
    const text = await item.textContent()
    console.log(`[DEBUG] Annotation item: id="${id}" text="${text?.slice(0, 50)}"`)
  }
  
  // Wait for the annotation list to update - poll for the sticky note to appear
  let pollCount = 0
  await expect.poll(async () => {
    pollCount++
    // Query DOM and Zustand store from within the browser
    const debugInfo = await page.evaluate(() => {
      const items = document.querySelectorAll('[id^="annotation-item-"]')
      const domIds = Array.from(items).map(el => el.id.replace('annotation-item-', ''))
      
      // Access Zustand store directly (exposed as __annotationStore)
      const store = (window as any).__annotationStore
      let storeAnnotations: any[] = []
      let currentPage = -1
      if (store) {
        const state = store.getState()
        storeAnnotations = state.annotations
        currentPage = state.currentPage
      }
      
      // Get page 1 annotations from store
      const page1Annotations = storeAnnotations.filter((a: any) => a.page === 1)
      const page1Ids = page1Annotations.map((a: any) => a.id)
      
      return {
        domCount: domIds.length,
        page1Count: page1Ids.length,
        currentPage,
        // Check which page1 annotations are NOT in DOM
        missingFromDom: page1Ids.filter((id: string) => !domIds.includes(id)),
        // Show types of page1 annotations
        page1Types: page1Annotations.map((a: any) => ({ id: a.id.slice(-8), type: a.type }))
      }
    })
    console.log(`[DEBUG] Poll ${pollCount}: DOM=${debugInfo.domCount} page1=${debugInfo.page1Count} currentPage=${debugInfo.currentPage} missingFromDom=${JSON.stringify(debugInfo.missingFromDom)}`)
    console.log(`[DEBUG] page1Types: ${JSON.stringify(debugInfo.page1Types)}`)
    
    const items = await page.locator('[id^="annotation-item-"]').all()
    for (const item of items) {
      const text = await item.textContent()
      if (text?.includes('Sticky note e2e')) {
        console.log(`[DEBUG] Poll ${pollCount}: Found sticky note in list!`)
        return true
      }
    }
    return false
  }, { timeout: 10000, intervals: [1000], message: 'Waiting for sticky note to appear in annotation list' }).toBe(true)

  // Signature
  await waitForReactSettle(page)
  await safeClick(page, 'button[data-tool="signature"]')
  await expect(page.locator('button[data-tool="signature"]').first()).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Create New' }).click()
  const signatureModal = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Create signature' }) }).first()
  await signatureModal.getByRole('button', { name: 'Type' }).click()
  await signatureModal.getByPlaceholder('Type your name').fill('Ada Lovelace')
  await signatureModal.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create signature' })).toHaveCount(0)
  const sigPoint = await canvasPoint(canvas, 0.2, 0.7)
  await page.mouse.click(sigPoint.x, sigPoint.y)
  await expect(page.locator('[id^="annotation-item-"]', { hasText: 'Signature' })).toBeVisible()

  // Pointer (selection via list)
  await waitForReactSettle(page)
  const helloBoxItem = page.locator('[id^="annotation-item-"]', { hasText: 'Hello Box' }).first()
  await helloBoxItem.scrollIntoViewIfNeeded()
  // Use dispatchEvent to bypass layout interception issues
  await helloBoxItem.dispatchEvent('click')
  await expect(page.locator('button[data-tool="pointer"]').first()).toHaveAttribute('aria-pressed', 'true')

  // Eraser
  await waitForReactSettle(page)
  await safeClick(page, 'button[data-tool="eraser"]')
  await expect(page.locator('button[data-tool="eraser"]').first()).toHaveAttribute('aria-pressed', 'true')
  const erasePoint = await canvasPoint(canvas, 0.28, 0.5)
  await page.mouse.click(erasePoint.x, erasePoint.y)
  await expect(page.locator('[id^="annotation-item-"]', { hasText: 'Rectangle' })).toHaveCount(0)
})

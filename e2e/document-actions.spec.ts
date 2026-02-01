import { test, expect } from '@playwright/test'
import { uploadSamplePdf, canvasPoint, dragOnCanvas, expectAnyAnnotation, getAnnotationCanvas, waitForReactSettle, safeClick } from './helpers'

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+5jB0GQAAAABJRU5ErkJggg==',
  'base64'
)

test('document actions: pages, transform, content, export', async ({ page }) => {
  test.setTimeout(90000)
  page.on('dialog', (dialog) => dialog.accept())
  
  // Debug: capture all console messages and errors
  page.on('console', msg => console.log(`[BROWSER CONSOLE ${msg.type()}]`, msg.text()))
  page.on('pageerror', err => console.log('[BROWSER ERROR]', err.message))
  page.on('crash', () => console.log('[BROWSER CRASH] Page crashed'))

  await uploadSamplePdf(page, false)  // Use generated sample PDF with known content
  const canvas = getAnnotationCanvas(page)
  const penStart = await canvasPoint(canvas, 0.15, 0.2)
  const penEnd = await canvasPoint(canvas, 0.3, 0.3)
  await safeClick(page, 'button[data-tool="pen"]')
  await expect(page.locator('button[data-tool="pen"]').first()).toHaveAttribute('aria-pressed', 'true')
  await dragOnCanvas(page, canvas, penStart, penEnd)
  await waitForReactSettle(page)
  await expectAnyAnnotation(page)

  // Export annotations JSON
  await waitForReactSettle(page)
  const exportBtn = page.getByRole('button', { name: 'Export annotations as JSON' }).first()
  await exportBtn.waitFor({ state: 'visible' })
  const exportJson = page.waitForEvent('download')
  await exportBtn.click()
  await exportJson

  // Save annotations (toast)
  await waitForReactSettle(page)
  const saveBtn = page.getByRole('button', { name: 'Save' }).first()
  await saveBtn.waitFor({ state: 'visible' })
  await saveBtn.click()
  await expect(page.getByText('Annotations saved successfully')).toBeVisible({ timeout: 10000 })

  // Pages: add after
  await waitForReactSettle(page)
  const pageInput = page.locator('#page-input').first()
  const initialMax = Number(await pageInput.getAttribute('max'))
  const addAfterBtn = page.getByRole('button', { name: 'Add After' }).first()
  await addAfterBtn.waitFor({ state: 'visible' })
  await addAfterBtn.click()
  await waitForReactSettle(page, 1000)
  await expect(pageInput).toHaveAttribute('max', String(initialMax + 1), { timeout: 10000 })
  
  // Debug: check current page state
  const currentPageVal = await pageInput.inputValue()
  const maxPages = await pageInput.getAttribute('max')
  console.log(`[DEBUG] After Add After: currentPage=${currentPageVal}, maxPages=${maxPages}`)

  // Move down then up (wait for button to be enabled first)
  // Note: Move Down is disabled when currentPage === numPages
  // So we first need to go to page 1 if we're on the last page
  await waitForReactSettle(page, 500)
  
  // If we're on page 2, go back to page 1 first
  if (currentPageVal === '2') {
    const prevBtn = page.getByRole('button', { name: 'Go to previous page' }).first()
    await prevBtn.click()
    await waitForReactSettle(page, 500)
  }
  
  const moveDownBtn = page.getByRole('button', { name: 'Move Down' }).first()
  await moveDownBtn.waitFor({ state: 'visible' })
  // Wait for button to be enabled (loading state cleared)
  await expect(moveDownBtn).toBeEnabled({ timeout: 10000 })
  await moveDownBtn.click()
  await waitForReactSettle(page, 1000)
  await expect(pageInput).toHaveValue('2', { timeout: 10000 })
  
  const moveUpBtn = page.getByRole('button', { name: 'Move Up' }).first()
  await moveUpBtn.waitFor({ state: 'visible' })
  await expect(moveUpBtn).toBeEnabled({ timeout: 10000 })
  await moveUpBtn.click()
  await waitForReactSettle(page, 1000)
  await expect(pageInput).toHaveValue('1', { timeout: 10000 })

  // Rotate
  await waitForReactSettle(page)
  const rotateLeftBtn = page.getByRole('button', { name: 'Rotate Left' }).first()
  await rotateLeftBtn.waitFor({ state: 'visible' })
  await rotateLeftBtn.click()
  await waitForReactSettle(page, 500)
  
  const rotateRightBtn = page.getByRole('button', { name: 'Rotate Right' }).first()
  await rotateRightBtn.waitFor({ state: 'visible' })
  await rotateRightBtn.click()
  await waitForReactSettle(page, 500)

  // Crop
  await waitForReactSettle(page)
  const cropBtn = page.getByRole('button', { name: 'Crop…' }).first()
  await cropBtn.waitFor({ state: 'visible' })
  await cropBtn.click()
  await expect(page.getByRole('heading', { name: 'Crop Page' })).toBeVisible()
  const cropInputs = page.locator('input[type="number"]')
  await cropInputs.nth(0).fill('10')
  await cropInputs.nth(1).fill('10')
  await cropInputs.nth(2).fill('10')
  await cropInputs.nth(3).fill('10')
  await page.getByRole('button', { name: 'Crop Page' }).click()
  await expect(page.getByRole('heading', { name: 'Crop Page' })).toHaveCount(0)
  await waitForReactSettle(page, 500)

  // Insert image
  await waitForReactSettle(page)
  const imageInput = page.locator('input[type="file"][accept*="image"]').first()
  await imageInput.setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: tinyPng })
  await waitForReactSettle(page, 500)

  // Find & replace
  await waitForReactSettle(page)
  await page.getByLabel('Find').first().fill('FindMe')
  await page.getByLabel('Replace').first().fill('Replaced')
  // Use aria-label to find the correct button
  const findBtn = page.locator('button[aria-label="Execute search"]').first()
  await findBtn.waitFor({ state: 'visible' })
  await expect(findBtn).toBeEnabled({ timeout: 5000 })
  await findBtn.click()
  await expect(page.getByText(/Found \d+ match/)).toBeVisible({ timeout: 15000 })
  
  const replaceAllBtn = page.locator('button[aria-label="Execute replace all"]').first()
  await replaceAllBtn.waitFor({ state: 'visible' })
  await expect(replaceAllBtn).toBeEnabled({ timeout: 5000 })
  await replaceAllBtn.click()
  await expect(page.getByText(/Replaced \d+ occurrence/)).toBeVisible({ timeout: 15000 })

  // Flatten annotations
  await waitForReactSettle(page)
  const flattenBtn = page.getByRole('button', { name: 'Flatten Annotations' }).first()
  await flattenBtn.waitFor({ state: 'visible' })
  await flattenBtn.click()
  await waitForReactSettle(page, 500)
  await expect(page.getByText('No annotations yet').first()).toBeVisible({ timeout: 10000 })

  // Clear all (confirm dialog handled globally)
  await waitForReactSettle(page)
  const clearBtn = page.locator('button[aria-label="Clear all annotations"]').first()
  await clearBtn.waitFor({ state: 'visible' })
  await clearBtn.click()
  await waitForReactSettle(page, 500)
  await expect(page.getByText('No annotations yet').first()).toBeVisible()

  // Export edited PDF
  await waitForReactSettle(page)
  const exportPdfBtn = page.getByRole('button', { name: 'Export Edited PDF' }).first()
  await exportPdfBtn.waitFor({ state: 'visible' })
  const exportPdf = page.waitForEvent('download')
  await exportPdfBtn.click()
  await exportPdf
})

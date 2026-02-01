import { test, expect } from '@playwright/test'

test('app loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'PDFoid', level: 1 })).toBeVisible()
})

/// <reference types="node" />
import { defineConfig } from '@playwright/test'

export default defineConfig({
  fullyParallel: false,
  workers: 1,
  testDir: 'e2e',
  testMatch: ['**/*.spec.ts'],
  testIgnore: ['**/src/tests/**', '**/dist/**'],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    acceptDownloads: true,
  },
  webServer: {
    command: 'npm run dev -- --host --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_E2E: '1',
      VITE_PDFJS_DISABLE_WORKER: '1',
    },
  },
})

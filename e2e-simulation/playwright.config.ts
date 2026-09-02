import { defineConfig, devices } from '@playwright/test';

/**
 * AegisOne E2E Simulation — Playwright Config
 *
 * Supports two modes via environment variable:
 *   E2E_USE_EXTENSION=true  → persistent Chromium context with unpacked extension
 *   E2E_USE_EXTENSION=false → standard browser contexts (API actors)
 */
export default defineConfig({
  testDir: './scenarios',
  timeout: 120_000,        // 2min per test — extension loading + AI inference can be slow
  expect: { timeout: 15_000 },
  fullyParallel: false,    // Simulation phases must run sequentially
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'results/playwright-results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_WEB_URL || 'http://localhost:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-standard',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'playwright-artifacts',
});

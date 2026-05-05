// playwright.config.js
// Single Chromium project. Tests run against a static file server spun up
// by the CI step (or locally via `npx http-server . -p 4000 --silent`).
// The base URL can be overridden with the PLAYWRIGHT_BASE_URL env var.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Each test file gets a fresh browser context; no shared state.
  fullyParallel: false,
  // Fail the whole run on the first failed test in CI so PRs fail fast.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000',
    // Capture trace on first retry so failures are diagnosable.
    trace: 'on-first-retry',
    // Headless everywhere; override with PWDEBUG=1 locally.
    headless: true,
    // Generous navigation timeout — the static server can be slow to start
    // in CI on the first request.
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // In CI the server is started externally (see ci.yml).
  // Locally, Playwright will spin it up automatically.
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npx http-server . -p 4000 --silent --cors',
        url: 'http://localhost:4000',
        reuseExistingServer: true,
        timeout: 30_000,
      },
});

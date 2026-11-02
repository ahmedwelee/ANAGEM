import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests: a real browser against the real thing. Playwright starts
 *   1. the backend (Spring Boot, production configuration) on an embedded PostgreSQL   :28080
 *   2. the built Angular server (SSR)                                                  :24000
 *   3. an edge proxy that routes /api to the backend and the rest to the web server    :24080
 * and tears everything down afterwards. The frontend must be built first (npm run test:build does it).
 * Set E2E_CHANNEL=chromium to use Playwright's own browser (npx playwright install chromium) instead of the installed Google Chrome.
 */
const EDGE = 'http://localhost:24080';
const channel = process.env.E2E_CHANNEL ?? (process.env.CI ? undefined : 'chrome');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1, // one shared database: tests create their own uniquely named content and run one after the other
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: EDGE, trace: 'retain-on-failure', screenshot: 'only-on-failure', channel, locale: 'en-GB' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel }, testIgnore: /phone\.spec/ },
    { name: 'phone', use: { ...devices['Pixel 7'], channel }, testMatch: /phone\.spec/ },
  ],
  webServer: [
    {
      command: '../backend/mvnw -q -B -f ../backend/pom.xml spring-boot:test-run -Dspring-boot.run.main-class=ma.anagem.cms.E2eServer',
      url: 'http://127.0.0.1:28080/actuator/health',
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 }, // lets the backend stop its embedded PostgreSQL instead of leaving it running
    },
    {
      command: 'node ../frontend/dist/anagem-frontend/server/server.mjs',
      env: { PORT: '24000', API_ORIGIN: 'http://127.0.0.1:28080', PUBLIC_BASE_URL: EDGE, ALLOWED_HOSTS: 'localhost,127.0.0.1' },
      url: 'http://127.0.0.1:24000/robots.txt',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
    { command: 'node edge.mjs', url: `${EDGE}/api/public/settings`, timeout: 30_000, reuseExistingServer: !process.env.CI },
  ],
});

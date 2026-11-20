/**
 * The game in a real browser, from the site as it is published: `npm run e2e` builds it, serves it and
 * plays with it. It needs a Chromium: `npx playwright install chromium` once, or CHROME_PATH pointing at
 * one that is already on the machine.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const own = process.env.CHROME_PATH;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // On GitHub each test that fails is also written down next to the run, with its error and its line: the
  // checks of a proposed change say what went wrong without the log having to be opened.
  reporter: process.env.GITHUB_ACTIONS ? [['list'], ['github']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    locale: 'es-ES',
    // The clock of the browser is Madrid's. E2E_ZONE puts it somewhere else, which is the way to run the
    // tests as at another hour of the day without waiting for it: `E2E_ZONE=Asia/Tokyo npm run e2e` in the
    // afternoon plays them as in the small hours. No test may depend on the hour it is run at.
    timezoneId: process.env.E2E_ZONE || 'Europe/Madrid',
    // The copy the game keeps for playing without a connection would answer in place of the site that
    // has just been built: it is only let in where it is what is being looked at (sin-conexion.spec.ts).
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    launchOptions: own ? { executablePath: own, args: ['--no-sandbox', '--disable-gpu'] } : {},
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } }, grepInvert: /@movil/ },
    // A phone: a narrow screen and a finger instead of a mouse.
    { name: 'movil', use: { ...devices['Pixel 7'] }, grep: /@movil/ },
  ],
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});

import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Read app visual review defaults from the project-owned env file.
 * Shell-provided environment variables still take priority.
 */
const appDir = fileURLToPath(new URL('.', import.meta.url))
const visualReviewEnvPath = resolve(appDir, '.env')

if (existsSync(visualReviewEnvPath)) {
  for (const rawLine of readFileSync(visualReviewEnvPath, 'utf8').split(
    /\r?\n/
  )) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    process.env[key] ??= value
  }
}

const appVisualReviewBaseUrl = process.env.ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL
const playwrightTestBaseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL

if (!appVisualReviewBaseUrl) {
  throw new Error(
    'Missing ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL. Define it in apps/asyra-design/.env or an explicit shell override.'
  )
}

if (playwrightTestBaseUrl && playwrightTestBaseUrl !== appVisualReviewBaseUrl) {
  throw new Error(
    'PLAYWRIGHT_TEST_BASE_URL must match ASYRA_DESIGN_VISUAL_REVIEW_BASE_URL for Asyra Design visual review.'
  )
}

process.env.PLAYWRIGHT_TEST_BASE_URL ??= appVisualReviewBaseUrl

const visualReviewUrl = new URL(appVisualReviewBaseUrl)
const visualReviewHost = visualReviewUrl.hostname
const visualReviewPort =
  visualReviewUrl.port ||
  (visualReviewUrl.protocol === 'https:' ? '443' : '80')
const visualReviewWebServerCommand = `yarn react:start --host ${visualReviewHost} --port ${visualReviewPort}`

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: appVisualReviewBaseUrl,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry'
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }

    // Uncomment to test in other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined
    : {
        command: visualReviewWebServerCommand,
        url: appVisualReviewBaseUrl,
        reuseExistingServer: true,
        timeout: 120 * 1000
      }
})

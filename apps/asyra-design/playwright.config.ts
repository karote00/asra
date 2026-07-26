import { defineConfig, devices } from '@playwright/test'
import {
  loadAsyraDesignEnvironment,
  resolveAsyraDesignEnvironment
} from './app-environment.mjs'
import { resolveOrdinaryPlaywrightRuntimePolicy } from './playwright-runtime-policy.mjs'

const appEnvironment = resolveAsyraDesignEnvironment(
  loadAsyraDesignEnvironment()
)
const runtimePolicy = resolveOrdinaryPlaywrightRuntimePolicy(process.env)
const ordinaryTestIgnore =
  process.env.ASYRA_E2E_SKIP_PERFORMANCE === 'true'
    ? ['collaboration.spec.ts', 'render-delta-performance.spec.ts']
    : 'collaboration.spec.ts'
const ordinaryGrepInvert =
  process.env.ASYRA_DESIGN_RUN_BALANCED_AI_CORRECTNESS === '1'
    ? undefined
    : /attaches a reference, chooses balanced detail, and incrementally edits/
const visualReviewWebServerCommand = `yarn react:start --host ${appEnvironment.viteHost} --port ${appEnvironment.vitePort}`

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ordinaryTestIgnore,
  grepInvert: ordinaryGrepInvert,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* PR/manual CI fails at the first product regression; scheduled runs retain one retry. */
  maxFailures: runtimePolicy.maxFailures,
  retries: runtimePolicy.retries,
  workers: runtimePolicy.workers,
  /* CI streams the first assertion instead of hiding it in an HTML-only report. */
  reporter: runtimePolicy.reporter,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: appEnvironment.appURL,

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
        url: appEnvironment.appURL,
        reuseExistingServer: true,
        timeout: 120 * 1000
      }
})

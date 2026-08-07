import { defineConfig, devices } from '@playwright/test'
import { loadEnvironment, resolveEnvironment } from './app-environment.mjs'
import { resolveOrdinaryPlaywrightRuntimePolicy } from './playwright-runtime-policy.mjs'

const appEnvironment = resolveEnvironment(loadEnvironment())
const runtimePolicy = resolveOrdinaryPlaywrightRuntimePolicy(process.env)
const documentBackendURL =
  process.env.E2E_DOCUMENT_BACKEND_URL?.trim() || 'http://127.0.0.1:4201'
const documentBackendPort = new URL(documentBackendURL).port || '80'
const collaborationWebSocketURL = new URL(
  '/collaboration',
  appEnvironment.collaborationHealthURL
)
collaborationWebSocketURL.protocol = 'ws:'
const ordinaryTestIgnore = [
  'collaboration-ai-agent-video.spec.ts',
  'collaboration.spec.ts',
  'crdt-endpoint-performance.spec.ts',
  'status-toast-visual.spec.ts',
  ...(process.env.E2E_CRDT_7076 === 'true' ? [] : ['crdt-7076-render.spec.ts']),
  ...(process.env.E2E_SKIP_PERFORMANCE === 'true'
    ? ['render-delta-performance.spec.ts']
    : [])
]
const visualReviewWebServerCommand = `E2E_OWN_SERVERS=1 E2E_DOCUMENT_BACKEND_URL=${documentBackendURL} VITE_COLLABORATION_WS_URL=${collaborationWebSocketURL} yarn react:start --host ${appEnvironment.viteHost} --port ${appEnvironment.vitePort}`

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ordinaryTestIgnore,
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
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      }
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
    : [
        {
          command: `DOCUMENT_BACKEND_PORT=${documentBackendPort} DOCUMENT_BACKEND_DATA_DIR=test-results/document-backend yarn document:backend`,
          url: `${documentBackendURL}/health`,
          reuseExistingServer: true,
          timeout: 120 * 1000
        },
        {
          command: `DOCUMENT_PERSISTENCE_BACKEND_URL=${documentBackendURL} yarn collaboration:server`,
          url: appEnvironment.collaborationHealthURL,
          reuseExistingServer: true,
          timeout: 120 * 1000
        },
        {
          command: visualReviewWebServerCommand,
          url: appEnvironment.appURL,
          reuseExistingServer: true,
          timeout: 120 * 1000
        }
      ]
})

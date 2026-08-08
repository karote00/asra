import { defineConfig, devices } from '@playwright/test'
import { loadEnvironment, resolveEnvironment } from './app-environment.mjs'

const appEnvironment = resolveEnvironment(loadEnvironment())
const ownsTestServers = process.env.E2E_OWN_SERVERS === '1'
const documentBackendURL =
  process.env.E2E_DOCUMENT_BACKEND_URL?.trim() || 'http://127.0.0.1:4201'
const documentBackendPort = new URL(documentBackendURL).port || '80'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['collaboration.spec.ts', 'collaboration-ai-agent-video.spec.ts'],
  timeout: 180_000,
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: appEnvironment.appURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      }
    }
  ],
  webServer: [
    {
      command: `DOCUMENT_BACKEND_PORT=${documentBackendPort} DOCUMENT_BACKEND_DATA_DIR=test-results/document-backend yarn document:backend`,
      url: `${documentBackendURL}/health`,
      reuseExistingServer: !ownsTestServers,
      timeout: 120_000
    },
    {
      command: `DOCUMENT_PERSISTENCE_BACKEND_URL=${documentBackendURL} yarn collaboration:server`,
      url: appEnvironment.collaborationHealthURL,
      reuseExistingServer: !ownsTestServers,
      timeout: 120_000
    },
    {
      command: `E2E_OWN_SERVERS=1 E2E_DOCUMENT_BACKEND_URL=${documentBackendURL} yarn start --host ${appEnvironment.viteHost} --port ${appEnvironment.vitePort}`,
      url: appEnvironment.appURL,
      reuseExistingServer: !ownsTestServers,
      timeout: 120_000
    }
  ]
})

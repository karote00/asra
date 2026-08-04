import { defineConfig, devices } from '@playwright/test'
import { loadEnvironment, resolveEnvironment } from './app-environment.mjs'

const appEnvironment = resolveEnvironment(loadEnvironment())

export default defineConfig({
  testDir: './e2e',
  testMatch: 'status-toast-visual.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: appEnvironment.appURL,
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command:
      'E2E_OWN_SERVERS=1 VITE_COLLABORATION_WS_URL=ws://127.0.0.1:4999/collaboration yarn react:start',
    url: appEnvironment.appURL,
    reuseExistingServer: false,
    timeout: 120 * 1000
  }
})

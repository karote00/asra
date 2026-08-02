import { defineConfig, devices } from '@playwright/test'
import { loadEnvironment, resolveEnvironment } from './app-environment.mjs'

const appEnvironment = resolveEnvironment(loadEnvironment())

export default defineConfig({
  testDir: './e2e',
  testMatch: 'crdt-7076-first-50-render.spec.ts',
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
    command: "E2E_OWN_SERVERS=1 VITE_COLLABORATION_WS_URL=' ' yarn react:start",
    url: appEnvironment.appURL,
    reuseExistingServer: false,
    timeout: 120 * 1000
  }
})

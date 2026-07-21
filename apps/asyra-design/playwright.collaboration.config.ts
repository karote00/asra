import { defineConfig, devices } from '@playwright/test'
import {
  loadAsyraDesignEnvironment,
  resolveAsyraDesignEnvironment
} from './app-environment.mjs'

const appEnvironment = resolveAsyraDesignEnvironment(
  loadAsyraDesignEnvironment()
)

export default defineConfig({
  testDir: './e2e',
  testMatch: 'collaboration.spec.ts',
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: appEnvironment.appURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'yarn collaboration:server',
      url: appEnvironment.collaborationHealthURL,
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: `yarn react:start --host ${appEnvironment.viteHost} --port ${appEnvironment.vitePort}`,
      url: appEnvironment.appURL,
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
})

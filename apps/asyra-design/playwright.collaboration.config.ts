import { defineConfig, devices } from '@playwright/test'
import { loadEnvironment, resolveEnvironment } from './app-environment.mjs'

const appEnvironment = resolveEnvironment(loadEnvironment())
const ownsTestServers = process.env.E2E_OWN_SERVERS === '1'

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
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'yarn collaboration:server',
      url: appEnvironment.collaborationHealthURL,
      reuseExistingServer: !ownsTestServers,
      timeout: 120_000
    },
    {
      command: `yarn react:start --host ${appEnvironment.viteHost} --port ${appEnvironment.vitePort}`,
      url: appEnvironment.appURL,
      reuseExistingServer: !ownsTestServers,
      timeout: 120_000
    }
  ]
})

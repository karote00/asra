import { defineConfig } from '@playwright/test'
import { resolveAppEnvironment } from './app-environment.mjs'

const environment = resolveAppEnvironment()
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  globalTimeout: 180_000,
  reporter: 'line',
  use: {
    baseURL: environment.url,
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    channel: 'chrome',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node ../../node_modules/vite/bin/vite.js',
    url: environment.url,
    reuseExistingServer: true,
    timeout: 60_000
  }
})

import { defineConfig } from '@playwright/test'

const appUrl = process.env.APP_URL

if (!appUrl) throw new Error('APP_URL is required')

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  use: {
    baseURL: appUrl,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    reducedMotion: 'reduce'
  },
  webServer: {
    command: 'yarn start --host 127.0.0.1',
    url: appUrl,
    reuseExistingServer: false
  }
})

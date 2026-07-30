import { defineConfig, devices } from '@playwright/test'

const requireGuardValue = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Endpoint performance resource guard requires non-empty ${name}`
    )
  }
  return value
}

const resolveDedicatedPort = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be a valid dedicated endpoint-test port`)
  }
  return value
}

requireGuardValue('ASYRA_DESIGN_ENDPOINT_OWNER')
requireGuardValue('ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN')
const guardURL = new URL(requireGuardValue('ASYRA_DESIGN_ENDPOINT_GUARD_URL'))
if (!['http:', 'https:'].includes(guardURL.protocol)) {
  throw new Error(
    'Endpoint performance resource guard URL must use http or https'
  )
}

const appPort = resolveDedicatedPort('ASYRA_DESIGN_ENDPOINT_APP_PORT', 3_021)
const collaborationPort = resolveDedicatedPort(
  'ASYRA_DESIGN_ENDPOINT_COLLABORATION_PORT',
  4_121
)
if (appPort === collaborationPort) {
  throw new Error(
    'Endpoint performance App and collaboration ports must be different'
  )
}

const appURL = `http://127.0.0.1:${appPort}`
const collaborationHealthURL = `http://127.0.0.1:${collaborationPort}/health`
const collaborationWebSocketURL =
  `ws://127.0.0.1:${collaborationPort}` + '/asyra-design-collaboration'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'crdt-endpoint-performance.spec.ts',
  fullyParallel: false,
  repeatEach: 1,
  retries: 0,
  workers: 1,
  reporter: 'line',
  timeout: 180_000,
  expect: {
    timeout: 120_000
  },
  use: {
    baseURL: appURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command:
        `ASYRA_DESIGN_COLLABORATION_WS_HOST=127.0.0.1 ` +
        `ASYRA_DESIGN_COLLABORATION_WS_PORT=${collaborationPort} ` +
        'yarn collaboration:server:start',
      url: collaborationHealthURL,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command:
        `VITE_ASYRA_DESIGN_COLLABORATION_WS_URL=${collaborationWebSocketURL} ` +
        `yarn preview --host 127.0.0.1 ` +
        `--port ${appPort} --strictPort`,
      url: appURL,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
})

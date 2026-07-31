import { chromium, defineConfig, devices } from '@playwright/test'
import { isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const requireGuardPath = (name: string): string => {
  const value = requireGuardValue(name)
  if (value.length > 160 || !isAbsolute(value)) {
    throw new Error(
      `Endpoint performance resource guard requires bounded absolute ${name}`
    )
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
const attestedArtifactEndpoint = requireGuardValue(
  'ASYRA_DESIGN_ENDPOINT_ARTIFACT_ATTESTED'
)
if (attestedArtifactEndpoint !== collaborationWebSocketURL) {
  throw new Error(
    'Endpoint performance production artifact does not match the proof server'
  )
}
const responsePreviewOutDir = requireGuardPath(
  'ASYRA_DESIGN_ENDPOINT_PREVIEW_OUT_DIR'
)
const responseManifestPath = requireGuardPath(
  'ASYRA_DESIGN_ENDPOINT_RESPONSE_MANIFEST_PATH'
)
const relativeResponseManifestPath = relative(
  responsePreviewOutDir,
  responseManifestPath
)
if (
  relativeResponseManifestPath.length === 0 ||
  relativeResponseManifestPath === '..' ||
  relativeResponseManifestPath.startsWith('../') ||
  isAbsolute(relativeResponseManifestPath)
) {
  throw new Error(
    'Endpoint performance response manifest must belong to the attested preview output'
  )
}
const responseArtifactAttestation = requireGuardValue(
  'ASYRA_DESIGN_ENDPOINT_RESPONSE_ARTIFACT_ATTESTED'
)
if (!/^[a-f0-9]{64}$/u.test(responseArtifactAttestation)) {
  throw new Error(
    'Endpoint performance response artifact attestation must be one SHA-256 digest'
  )
}

const guardLauncherPath = fileURLToPath(
  new URL('./e2e/performance-resource-guard.mjs', import.meta.url)
)
const trackedServerCommand = (
  role: 'app-server' | 'websocket-server',
  command: string
): string =>
  `exec ${JSON.stringify(process.execPath)} ${JSON.stringify(
    guardLauncherPath
  )} --tracked-role ${role} -- ${command}`
const browserLauncherEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  )
)
const guardedWebServers = [
  {
    command: trackedServerCommand(
      'websocket-server',
      'yarn collaboration:server:start'
    ),
    env: {
      ASYRA_DESIGN_APP_URL: appURL,
      ASYRA_DESIGN_COLLABORATION_WS_HOST: '127.0.0.1',
      ASYRA_DESIGN_COLLABORATION_WS_PORT: String(collaborationPort)
    },
    url: collaborationHealthURL,
    reuseExistingServer: false,
    timeout: 120_000
  },
  {
    command: trackedServerCommand(
      'app-server',
      `yarn preview --host 127.0.0.1 --port ${appPort} --strictPort ` +
        `--outDir ${JSON.stringify(responsePreviewOutDir)}`
    ),
    url: appURL,
    reuseExistingServer: false,
    timeout: 120_000
  }
]

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
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          env: {
            ...browserLauncherEnvironment,
            ASYRA_DESIGN_TRACKED_EXECUTABLE: chromium.executablePath(),
            ASYRA_DESIGN_TRACKED_ROLE: 'client-browser'
          },
          executablePath: guardLauncherPath
        }
      }
    }
  ],
  webServer: guardedWebServers
})

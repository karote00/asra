import { chromium, defineConfig, devices } from '@playwright/test'
import { isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isEndpointGuardAbsolutePath,
  resolveEndpointBrowserExecutablePath
} from './e2e/performance-resource-guard.mjs'

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
  if (!isEndpointGuardAbsolutePath(value)) {
    throw new Error(
      `Endpoint performance resource guard requires bounded absolute ${name}`
    )
  }
  return value
}

requireGuardValue('ENDPOINT_OWNER')
requireGuardValue('ENDPOINT_GUARD_TOKEN')
const guardURL = new URL(requireGuardValue('ENDPOINT_GUARD_URL'))
if (!['http:', 'https:'].includes(guardURL.protocol)) {
  throw new Error(
    'Endpoint performance resource guard URL must use http or https'
  )
}

const appPort = resolveDedicatedPort('ENDPOINT_APP_PORT', 3_021)
const collaborationPort = resolveDedicatedPort(
  'ENDPOINT_COLLABORATION_PORT',
  4_121
)
const documentBackendPort = resolveDedicatedPort(
  'ENDPOINT_DOCUMENT_BACKEND_PORT',
  4_221
)
if (new Set([appPort, collaborationPort, documentBackendPort]).size !== 3) {
  throw new Error(
    'Endpoint performance App, collaboration, and document backend ports must be different'
  )
}

const appURL = `http://127.0.0.1:${appPort}`
const collaborationHealthURL = `http://127.0.0.1:${collaborationPort}/health`
const documentBackendURL = `http://127.0.0.1:${documentBackendPort}`
const collaborationWebSocketURL =
  `ws://127.0.0.1:${collaborationPort}` + '/collaboration'
const attestedArtifactEndpoint = requireGuardValue('ENDPOINT_ARTIFACT_ATTESTED')
if (attestedArtifactEndpoint !== collaborationWebSocketURL) {
  throw new Error(
    'Endpoint performance production artifact does not match the proof server'
  )
}
const responsePreviewOutDir = requireGuardPath('ENDPOINT_PREVIEW_OUT_DIR')
const responseManifestPath = requireGuardPath('ENDPOINT_RESPONSE_MANIFEST_PATH')
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
  'ENDPOINT_RESPONSE_ARTIFACT_ATTESTED'
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
  role: 'app-server' | 'document-backend' | 'websocket-server',
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
const endpointAttributionCase =
  process.env.ENDPOINT_ATTRIBUTION_CASE?.trim() ?? ''
const endpointBrowserChannel =
  endpointAttributionCase === '27471-maximum' ? undefined : 'chrome'
const guardedWebServers = [
  {
    command: trackedServerCommand(
      'document-backend',
      'yarn document:backend:start'
    ),
    env: {
      DOCUMENT_BACKEND_DATA_DIR: 'test-results/endpoint-document-backend',
      DOCUMENT_BACKEND_PORT: String(documentBackendPort)
    },
    url: `${documentBackendURL}/health`,
    stdout: 'pipe',
    reuseExistingServer: false,
    timeout: 120_000
  },
  {
    command: trackedServerCommand(
      'websocket-server',
      'yarn collaboration:server:start'
    ),
    env: {
      APP_URL: appURL,
      COLLABORATION_WS_HOST: '127.0.0.1',
      COLLABORATION_WS_PORT: String(collaborationPort),
      DOCUMENT_PERSISTENCE_BACKEND_URL: documentBackendURL
    },
    url: collaborationHealthURL,
    stdout: 'pipe',
    reuseExistingServer: false,
    timeout: 120_000
  },
  {
    command: trackedServerCommand(
      'app-server',
      `yarn preview --host 127.0.0.1 --port ${appPort} --strictPort ` +
        `--outDir ${JSON.stringify(responsePreviewOutDir)}`
    ),
    env: {
      E2E_DOCUMENT_BACKEND_URL: documentBackendURL
    },
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
  timeout: 120_000,
  expect: {
    timeout: 120_000
  },
  use: {
    baseURL: appURL,
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(endpointBrowserChannel
          ? { channel: endpointBrowserChannel }
          : undefined),
        launchOptions: {
          env: {
            ...browserLauncherEnvironment,
            TRACKED_EXECUTABLE: resolveEndpointBrowserExecutablePath({
              attributionCase: endpointAttributionCase,
              bundledChromiumExecutablePath: chromium.executablePath()
            }),
            TRACKED_ROLE: 'client-a-browser'
          },
          executablePath: guardLauncherPath
        }
      }
    }
  ],
  webServer: guardedWebServers
})

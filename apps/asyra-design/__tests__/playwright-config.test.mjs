import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

const appDirectory = fileURLToPath(new URL('../', import.meta.url))

const listTests = (config, environment = {}) => {
  const result = spawnSync(
    'yarn',
    ['playwright', 'test', '--list', '--config', config],
    {
      cwd: appDirectory,
      encoding: 'utf8',
      env: { ...process.env, ...environment }
    }
  )
  assert.equal(
    result.status,
    0,
    `Playwright discovery failed for ${config}:\n${result.stderr}`
  )
  return result.stdout
}

test('ordinary and collaboration Playwright suites have separate discovery', () => {
  const ordinary = listTests('playwright.config.ts')
  const collaboration = listTests('playwright.collaboration.config.ts')

  assert.doesNotMatch(ordinary, /collaboration\.spec\.ts/)
  assert.match(collaboration, /collaboration\.spec\.ts/)
  assert.match(collaboration, /collaboration-ai-agent-video\.spec\.ts/)
  assert.match(collaboration, /Total: [1-9]\d* tests? in 2 files/)
})

test('CI can exclude the isolated render performance gate from the functional suite', () => {
  const ordinary = listTests('playwright.config.ts')
  const functional = listTests('playwright.config.ts', {
    ASYRA_E2E_SKIP_PERFORMANCE: 'true'
  })

  assert.match(ordinary, /render-delta-performance\.spec\.ts/)
  assert.doesNotMatch(functional, /render-delta-performance\.spec\.ts/)
})

test('the balanced AI correctness gate requires an explicit heavy-test flag', async () => {
  const ordinary = listTests('playwright.config.ts')
  const heavy = listTests('playwright.config.ts', {
    ASYRA_DESIGN_RUN_BALANCED_AI_CORRECTNESS: '1'
  })
  const manifest = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )
  const balancedCase =
    /attaches a reference, chooses balanced detail, and incrementally edits/

  assert.doesNotMatch(ordinary, balancedCase)
  assert.match(heavy, balancedCase)
  assert.match(
    manifest.scripts['test:e2e:balanced-ai-correctness'],
    /ASYRA_DESIGN_RUN_BALANCED_AI_CORRECTNESS=1/
  )
})

test('ordinary Playwright runtime policy is local-friendly and CI fail-fast', async () => {
  const { resolveOrdinaryPlaywrightRuntimePolicy } = await import(
    '../playwright-runtime-policy.mjs'
  )

  assert.deepEqual(resolveOrdinaryPlaywrightRuntimePolicy({}), {
    maxFailures: undefined,
    reporter: 'html',
    retries: 0,
    workers: undefined
  })
  assert.deepEqual(
    resolveOrdinaryPlaywrightRuntimePolicy({
      CI: 'true',
      GITHUB_EVENT_NAME: 'pull_request'
    }),
    {
      maxFailures: 1,
      reporter: 'line',
      retries: 0,
      workers: 2
    }
  )
  assert.deepEqual(
    resolveOrdinaryPlaywrightRuntimePolicy({
      CI: 'true',
      GITHUB_EVENT_NAME: 'schedule'
    }),
    {
      maxFailures: undefined,
      reporter: 'line',
      retries: 1,
      workers: 2
    }
  )
})

test('the AI CRDT recording owns dedicated fresh app and collaboration servers', async () => {
  const [configSource, manifestSource] = await Promise.all([
    readFile(
      new URL('../playwright.collaboration.config.ts', import.meta.url),
      'utf8'
    ),
    readFile(new URL('../package.json', import.meta.url), 'utf8')
  ])
  const manifest = JSON.parse(manifestSource)
  const command = manifest.scripts['test:e2e:ai-crdt-video']

  assert.match(configSource, /ASYRA_DESIGN_E2E_OWN_SERVERS/)
  assert.match(configSource, /reuseExistingServer:\s*!ownsTestServers/g)
  assert.match(command, /ASYRA_DESIGN_E2E_OWN_SERVERS=1/)
  assert.match(command, /ASYRA_DESIGN_APP_URL=http:\/\/127\.0\.0\.1:3011/)
  assert.match(command, /ASYRA_DESIGN_COLLABORATION_WS_PORT=4111/)
  assert.match(
    command,
    /VITE_ASYRA_DESIGN_COLLABORATION_WS_URL=ws:\/\/127\.0\.0\.1:4111\/asyra-design-collaboration/
  )
})

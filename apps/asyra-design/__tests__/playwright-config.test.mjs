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

const endpointPerformanceEnvironment = {
  ASYRA_DESIGN_ENDPOINT_ARTIFACT_ATTESTED:
    'ws://127.0.0.1:4121/asyra-design-collaboration',
  ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN: 'config-contract-token',
  ASYRA_DESIGN_ENDPOINT_GUARD_URL: 'http://127.0.0.1:4319',
  ASYRA_DESIGN_ENDPOINT_OWNER: 'admit-receiver-publication-frames'
}

test('ordinary and collaboration Playwright suites have separate discovery', () => {
  const ordinary = listTests('playwright.config.ts')
  const ordinaryWithEndpointGuard = listTests(
    'playwright.config.ts',
    endpointPerformanceEnvironment
  )
  const collaboration = listTests('playwright.collaboration.config.ts')

  assert.doesNotMatch(ordinary, /collaboration\.spec\.ts/)
  assert.doesNotMatch(
    ordinaryWithEndpointGuard,
    /crdt-endpoint-performance\.spec\.ts/
  )
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

test('endpoint performance discovery is isolated, guarded, and resource-bounded', async () => {
  const configURL = new URL(
    '../playwright.endpoint-performance.config.ts',
    import.meta.url
  )
  const specURL = new URL(
    '../e2e/crdt-endpoint-performance.spec.ts',
    import.meta.url
  )
  const guardURL = new URL(
    '../e2e/performance-resource-guard.mjs',
    import.meta.url
  )
  const [configSource, guardSource, specSource, manifestSource] =
    await Promise.all([
      readFile(configURL, 'utf8'),
      readFile(guardURL, 'utf8'),
      readFile(specURL, 'utf8'),
      readFile(new URL('../package.json', import.meta.url), 'utf8')
    ])
  const manifest = JSON.parse(manifestSource)
  const unguarded = spawnSync(
    'yarn',
    [
      'playwright',
      'test',
      '--list',
      '--config',
      'playwright.endpoint-performance.config.ts'
    ],
    {
      cwd: appDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN: '',
        ASYRA_DESIGN_ENDPOINT_GUARD_URL: '',
        ASYRA_DESIGN_ENDPOINT_OWNER: ''
      }
    }
  )
  const guarded = listTests(
    'playwright.endpoint-performance.config.ts',
    endpointPerformanceEnvironment
  )

  assert.notEqual(unguarded.status, 0)
  assert.match(
    `${unguarded.stdout}\n${unguarded.stderr}`,
    /endpoint performance resource guard/i
  )
  assert.match(guarded, /crdt-endpoint-performance\.spec\.ts/)
  assert.match(guarded, /empty-document two-Actor endpoint connectivity/)
  assert.match(guarded, /creation-only high-detail endpoint proof/)
  assert.match(guarded, /Total: 2 tests in 1 file/)

  assert.match(
    configSource,
    /testMatch:\s*['"]crdt-endpoint-performance\.spec\.ts['"]/
  )
  assert.match(configSource, /fullyParallel:\s*false/)
  assert.match(configSource, /repeatEach:\s*1/)
  assert.match(configSource, /retries:\s*0/)
  assert.match(configSource, /workers:\s*1/)
  assert.match(configSource, /reporter:\s*['"]line['"]/)
  assert.match(configSource, /trace:\s*['"]off['"]/)
  assert.match(configSource, /screenshot:\s*['"]off['"]/)
  assert.match(configSource, /video:\s*['"]off['"]/)
  assert.match(configSource, /reuseExistingServer:\s*false/g)
  assert.match(
    configSource,
    /trackedServerCommand\(\s*['"]websocket-server['"]/
  )
  assert.match(configSource, /yarn collaboration:server:start/)
  assert.match(configSource, /ASYRA_DESIGN_APP_URL:\s*appURL/)
  assert.doesNotMatch(
    configSource,
    /yarn collaboration:server(?!:start)|yarn react:build/
  )
  assert.match(configSource, /trackedServerCommand\(\s*['"]app-server['"]/)
  assert.match(configSource, /yarn preview/)
  assert.match(configSource, /ASYRA_DESIGN_ENDPOINT_ARTIFACT_ATTESTED/)
  assert.match(configSource, /launchOptions/)
  assert.match(configSource, /client-browser/)

  assert.match(specSource, /ASYRA_DESIGN_ENDPOINT_GUARD_URL/)
  assert.match(specSource, /ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN/)
  assert.match(specSource, /ASYRA_DESIGN_ENDPOINT_OWNER/)
  assert.match(specSource, /postHeartbeat\(['"]ready['"]/)
  assert.match(specSource, /postHeartbeat\(['"]progress['"]/)
  assert.match(specSource, /postHeartbeat\(['"]complete['"]/)
  assert.match(specSource, /postHeartbeat\(['"]failed['"]/)
  assert.match(specSource, /accepted/)
  assert.match(specSource, /aiDelivery=progressive/)
  assert.match(specSource, /aiPerformance=profile/)
  assert.match(specSource, /aiPerformanceContents=omitted/)
  assert.doesNotMatch(specSource, /(?:[?&])ai=mock/)
  assert.match(specSource, /readCanonicalElementCount/)
  assert.match(specSource, /readCounterTotal/)
  assert.match(specSource, /readFactoryPublicationCount/)
  assert.match(specSource, /readRenderProjectionElementCount/)
  assert.doesNotMatch(specSource, /window\.__Core__|\.__Core__/)
  assert.match(specSource, /research-02-original-tabby-source\.png/)
  assert.match(specSource, /totalCount:\s*7076/)
  assert.match(specSource, /vectorCount:\s*7075/)
  assert.match(specSource, /groupCount:\s*1/)
  assert.match(specSource, /115_000/)
  assert.match(specSource, /test\.skip\(\s*!endpointGuardEnabled/)
  assert.doesNotMatch(specSource, /renderLayer|getAllElements\(\)\.size/)
  assert.match(specSource, /hierarchySha256/)
  assert.match(specSource, /hierarchyOrderMatches/)
  assert.match(specSource, /equivalenceProofMs/)
  assert.match(
    specSource,
    /actorASample\.localSent\s*===\s*actorBSample\.remoteProcessed/
  )
  const creationPhaseIndex = specSource.indexOf(
    "heartbeat.setPhase('creation')"
  )
  const guardedCreationHeartbeatIndex = specSource.indexOf(
    "postHeartbeat('progress', await heartbeat.sample())"
  )
  const submitIndex = specSource.indexOf('submitExactCatTurn(actorA)')
  assert.ok(creationPhaseIndex >= 0)
  assert.ok(guardedCreationHeartbeatIndex > creationPhaseIndex)
  assert.ok(submitIndex > guardedCreationHeartbeatIndex)
  assert.match(guardSource, /child\.once\(['"]close['"]/)
  assert.doesNotMatch(guardSource, /child\.once\(['"]exit['"]/)
  assert.match(guardSource, /child-close-timeout/)
  assert.match(specSource, /waitForGuardReady\(initialHeartbeat\)/)
  assert.match(specSource, /browserErrors/)
  assert.match(
    specSource,
    /waitForGuardReady\(\s*createConnectivityHeartbeat\(['"]browser-launched['"]\)/
  )
  assert.match(
    specSource,
    /browser-launched[\s\S]*local-a-ordinary-blank-idle[\s\S]*local-a-ordinary-navigation[\s\S]*local-a-ordinary-app-ready[\s\S]*local-a-ordinary-idle[\s\S]*local-a-profiled-blank-idle[\s\S]*local-a-profiled-navigation[\s\S]*local-a-profiled-app-ready[\s\S]*local-a-profiled-idle[\s\S]*actor-a-blank-idle[\s\S]*actor-a-navigation[\s\S]*actor-a-app-ready[\s\S]*actor-a-collaboration-ready[\s\S]*actor-b-blank-idle[\s\S]*actor-b-navigation[\s\S]*actor-b-app-ready[\s\S]*actor-b-collaboration-ready[\s\S]*connected/
  )
  assert.match(specSource, /const waitForConnectivityCpuSample/)
  assert.doesNotMatch(specSource, /\bindexedDB\b|\bscreenshot\(|\bvideo\(/)
  assert.doesNotMatch(specSource, /\bundo\(|testInfo\.attach\(/)

  const actorSampleSource = specSource.slice(
    specSource.indexOf('const readActorSample'),
    specSource.indexOf('const delay')
  )
  assert.doesNotMatch(
    actorSampleSource,
    /getRuntimeEvidence|readCanonicalElements|snapshot\(/
  )
  assert.match(
    manifest.scripts['test:e2e:crdt-endpoint-performance'],
    /performance-resource-guard\.mjs/
  )
  assert.match(
    manifest.scripts['test:e2e:crdt-endpoint-performance'],
    /ASYRA_DESIGN_ENDPOINT_OWNER/
  )
  assert.match(
    manifest.scripts['test:local'],
    /performance-resource-guard\.test\.mjs/
  )
})

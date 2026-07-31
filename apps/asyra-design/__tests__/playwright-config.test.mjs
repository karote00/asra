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
  ASYRA_DESIGN_ENDPOINT_PREVIEW_OUT_DIR:
    '/project/apps/asyra-design/tmp/asyra-design-endpoint-preview/current',
  ASYRA_DESIGN_ENDPOINT_RESPONSE_ARTIFACT_ATTESTED: 'a'.repeat(64),
  ASYRA_DESIGN_ENDPOINT_RESPONSE_MANIFEST_PATH:
    '/project/apps/asyra-design/tmp/asyra-design-endpoint-preview/current/__endpoint-test__/server-responses/manifest.json',
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
  assert.doesNotMatch(ordinary, /collaboration-ai-agent-video\.spec\.ts/)
  assert.doesNotMatch(
    ordinaryWithEndpointGuard,
    /crdt-endpoint-performance\.spec\.ts/
  )
  assert.match(collaboration, /collaboration\.spec\.ts/)
  assert.match(collaboration, /collaboration-ai-agent-video\.spec\.ts/)
  assert.match(collaboration, /Total: [1-9]\d* tests? in 2 files/)
})

test('ordinary Playwright starts the always-on collaboration service before the App', async () => {
  const configSource = await readFile(
    new URL('../playwright.config.ts', import.meta.url),
    'utf8'
  )
  const serverStart = configSource.indexOf(
    "command: 'yarn collaboration:server'"
  )
  const appStart = configSource.indexOf('command: visualReviewWebServerCommand')

  assert.ok(serverStart >= 0, 'ordinary Playwright must start collaboration')
  assert.ok(appStart > serverStart, 'collaboration must be declared before App')
  assert.match(configSource, /collaborationHealthURL/)
  assert.match(configSource, /webServer:[\s\S]*\? undefined[\s\S]*: \[/)
})

test('CI can exclude the isolated render performance gate from the functional suite', () => {
  const ordinary = listTests('playwright.config.ts')
  const functional = listTests('playwright.config.ts', {
    ASYRA_E2E_SKIP_PERFORMANCE: 'true'
  })

  assert.match(ordinary, /render-delta-performance\.spec\.ts/)
  assert.doesNotMatch(functional, /render-delta-performance\.spec\.ts/)
})

test('ordinary AI profiling stays low-load while high detail remains guarded', async () => {
  const [ordinary, configSource, endpointSource, specSource] =
    await Promise.all([
      Promise.resolve(listTests('playwright.config.ts')),
      readFile(new URL('../playwright.config.ts', import.meta.url), 'utf8'),
      readFile(
        new URL('../e2e/crdt-endpoint-performance.spec.ts', import.meta.url),
        'utf8'
      ),
      readFile(
        new URL('../e2e/ai-drawing-performance.spec.ts', import.meta.url),
        'utf8'
      )
    ])

  assert.match(ordinary, /16-item product span/)
  assert.doesNotMatch(ordinary, /high-detail interactive drawing/)
  assert.match(specSource, /ASYRA_DESIGN_RUN_AI_DRAWING_PERFORMANCE/)
  assert.match(specSource, /test\.skip\(!RUN_PROFILE/)
  assert.doesNotMatch(specSource, /RUN_HIGH_DETAIL|7_075|7076/)
  assert.doesNotMatch(specSource, /production 16-item/)
  assert.match(
    specSource,
    /releaseEvidenceEligible\)\.toBe\(\s*result\.snapshot\.runtime === 'production'/
  )
  assert.match(endpointSource, /creation-only high-detail endpoint proof/)
  assert.match(endpointSource, /ai-drawing-progress-indicator/)
  assert.match(endpointSource, /'pan-changed'/)
  assert.match(endpointSource, /'zoom-changed'/)
  assert.match(
    specSource,
    /createTestDocumentIdentity\(['"]aiPerformance=profile['"]\)/
  )
  assert.doesNotMatch(
    `${configSource}\n${specSource}`,
    /ASYRA_DESIGN_RUN_BALANCED_AI_CORRECTNESS|aiDelivery|aiPerformanceContents|(?:[?&])ai=mock/
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
  const serverResponseInboxURL = new URL(
    '../e2e/server-response-inbox.ts',
    import.meta.url
  )
  const [
    configSource,
    guardSource,
    specSource,
    serverResponseInboxSource,
    manifestSource
  ] =
    await Promise.all([
      readFile(configURL, 'utf8'),
      readFile(guardURL, 'utf8'),
      readFile(specURL, 'utf8'),
      readFile(serverResponseInboxURL, 'utf8'),
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
  const invalidResponseAttestation = spawnSync(
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
        ...endpointPerformanceEnvironment,
        ASYRA_DESIGN_ENDPOINT_RESPONSE_ARTIFACT_ATTESTED: 'not-a-digest'
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
  assert.notEqual(invalidResponseAttestation.status, 0)
  assert.match(
    `${invalidResponseAttestation.stdout}\n${invalidResponseAttestation.stderr}`,
    /response artifact attestation must be one SHA-256 digest/i
  )
  assert.match(guarded, /crdt-endpoint-performance\.spec\.ts/)
  assert.doesNotMatch(
    serverResponseInboxSource,
    /MAXIMUM_COMPRESSED_RESPONSE_BYTES|maximumCompressedBytes/,
    'the attested response must not gain an arbitrary payload ceiling'
  )
  assert.match(guarded, /empty-document two-Actor endpoint connectivity/)
  assert.match(guarded, /single-Actor local attribution/)
  assert.match(guarded, /two-Actor 16-item operation and idle attribution/)
  assert.match(guarded, /creation-only high-detail endpoint proof/)
  assert.match(guarded, /Total: 4 tests in 1 file/)

  assert.match(
    configSource,
    /testMatch:\s*['"]crdt-endpoint-performance\.spec\.ts['"]/
  )
  assert.match(configSource, /fullyParallel:\s*false/)
  assert.match(configSource, /repeatEach:\s*1/)
  assert.match(configSource, /retries:\s*0/)
  assert.match(configSource, /workers:\s*1/)
  assert.match(configSource, /timeout:\s*240_000/)
  assert.match(configSource, /reporter:\s*['"]line['"]/)
  assert.match(configSource, /trace:\s*['"]off['"]/)
  assert.match(configSource, /screenshot:\s*['"]off['"]/)
  assert.match(configSource, /video:\s*['"]off['"]/)
  assert.match(configSource, /reuseExistingServer:\s*false/g)
  assert.match(
    configSource,
    /trackedServerCommand\(\s*['"]websocket-server['"]/
  )
  assert.doesNotMatch(configSource, /endpointLocalOnly|ENDPOINT_LOCAL_ONLY/)
  assert.match(configSource, /yarn collaboration:server:start/)
  assert.match(configSource, /ASYRA_DESIGN_APP_URL:\s*appURL/)
  assert.doesNotMatch(
    configSource,
    /yarn collaboration:server(?!:start)|yarn react:build/
  )
  assert.match(configSource, /trackedServerCommand\(\s*['"]app-server['"]/)
  assert.match(configSource, /yarn preview/)
  assert.match(
    configSource,
    /--outDir \$\{JSON\.stringify\(responsePreviewOutDir\)\}/
  )
  assert.match(configSource, /ASYRA_DESIGN_ENDPOINT_PREVIEW_OUT_DIR/)
  assert.match(configSource, /ASYRA_DESIGN_ENDPOINT_RESPONSE_MANIFEST_PATH/)
  assert.match(configSource, /ASYRA_DESIGN_ENDPOINT_RESPONSE_ARTIFACT_ATTESTED/)
  assert.match(configSource, /ASYRA_DESIGN_ENDPOINT_ARTIFACT_ATTESTED/)
  assert.match(configSource, /launchOptions/)
  assert.match(configSource, /client-browser/)

  assert.match(specSource, /ASYRA_DESIGN_ENDPOINT_GUARD_URL/)
  assert.match(specSource, /ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN/)
  assert.match(specSource, /ASYRA_DESIGN_ENDPOINT_OWNER/)
  assert.match(specSource, /ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE/)
  assert.match(specSource, /postPhaseBoundary/)
  assert.match(specSource, /proofKind:\s*['"]local-attribution['"]/)
  assert.match(specSource, /actorB:\s*null/)
  assert.match(specSource, /phaseTimeline/)
  assert.match(specSource, /drawingProgress/)
  assert.doesNotMatch(specSource, /counterTimeline/)
  assert.match(specSource, /postHeartbeat\(['"]ready['"]/)
  assert.match(specSource, /postHeartbeat\(['"]progress['"]/)
  assert.match(specSource, /postHeartbeat\(['"]complete['"]/)
  assert.match(specSource, /postHeartbeat\(['"]failed['"]/)
  assert.match(specSource, /const CRDT_FLOW_TIMEOUT_MS = 180_000/)
  assert.doesNotMatch(specSource, /waitFor(?:ActorA|Both)?Complete\(120_000\)/)
  assert.match(specSource, /accepted/)
  assert.match(specSource, /aiPerformance=profile/)
  assert.doesNotMatch(
    specSource,
    /aiDelivery|aiPerformanceContents|(?:[?&])ai=mock/
  )
  const localURLSource = specSource.slice(
    specSource.indexOf('const singleActorAppURL'),
    specSource.indexOf('const waitForCollaboration')
  )
  assert.match(localURLSource, /fileId/)
  assert.match(
    specSource,
    /single-Actor local attribution[\s\S]*profiledSingleActorAppURL\(fileId\)[\s\S]*waitForCollaboration\(actor\.page,\s*['"]Actor A['"]\)/
  )
  const localAttributionSource = specSource.slice(
    specSource.indexOf("test('single-Actor local attribution'"),
    specSource.indexOf("test('creation-only high-detail endpoint proof'")
  )
  assert.ok(
    localAttributionSource.indexOf('await createActor(') <
      localAttributionSource.indexOf('await waitForGuardReady('),
    'the blank Actor must exist before the stable process baseline is accepted'
  )
  assert.match(
    localAttributionSource,
    /startGuardPhase\(['"]local-request['"]\)[\s\S]*endGuardPhase\(['"]local-request['"]\)/
  )
  assert.ok(
    localAttributionSource.indexOf('prepareAiTurn(actor.page, prompt)') <
      localAttributionSource.indexOf('await waitForGuardReady('),
    'prompt fill and locator actionability must finish before request timing'
  )
  assert.ok(
    localAttributionSource.indexOf("startGuardPhase('local-request')") <
      localAttributionSource.indexOf('triggerPreparedAiTurn(preparedTurn)'),
    'the prepared request dispatch must begin inside local-request'
  )
  assert.ok(
    localAttributionSource.indexOf("endGuardPhase('local-request')") <
      localAttributionSource.indexOf(
        'assertPreparedAiTurnSettled(preparedTurn)'
      ),
    'UI correctness assertions must run after product timing'
  )
  const measuredLocalRequestSource = localAttributionSource.slice(
    localAttributionSource.indexOf("startGuardPhase('local-request')"),
    localAttributionSource.indexOf("endGuardPhase('local-request')")
  )
  assert.doesNotMatch(
    measuredLocalRequestSource,
    /getBy|\.locator\(|expect\(|\.fill\(|\.boundingBox\(/
  )
  assert.match(
    measuredLocalRequestSource,
    /triggerPreparedAiTurn\(preparedTurn\)[\s\S]*heartbeat\.waitForComplete/
  )
  assert.doesNotMatch(
    localAttributionSource,
    /startGuardPhase\(['"](?:app|collaboration|agent)/
  )
  assert.ok(
    localAttributionSource.indexOf('await installBoundedDiagnostics(') <
      localAttributionSource.indexOf('await waitForGuardReady('),
    'harness diagnostics must be installed before request identity is frozen'
  )
  assert.ok(
    localAttributionSource.indexOf(
      "waitForCollaboration(actor.page, 'Actor A')"
    ) < localAttributionSource.indexOf('await waitForGuardReady('),
    'Collaboration must be ready before request identity is frozen'
  )
  assert.ok(
    localAttributionSource.indexOf('await openAgent(actor.page)') <
      localAttributionSource.indexOf('await waitForGuardReady('),
    'Agent bootstrap must complete before request identity is frozen'
  )
  const localHeartbeatControllerSource = specSource.slice(
    specSource.indexOf('const createLocalAttributionHeartbeatController'),
    specSource.indexOf('const readCanonicalSummary')
  )
  assert.match(localHeartbeatControllerSource, /latestCompletedPhase/)
  assert.match(localHeartbeatControllerSource, /activeHeartbeatPhase/)
  assert.match(
    localHeartbeatControllerSource,
    /activePhase:\s*activeHeartbeatPhase[\s\S]*phase:\s*latestCompletedPhase/
  )
  assert.doesNotMatch(
    localAttributionSource,
    /finally\s*{[\s\S]{0,500}postPhaseBoundary\(['"]end['"]/
  )
  assert.match(
    specSource,
    /completed\.publications\.actorALocalSent\)\.toBeGreaterThan\(0\)[\s\S]*actorBRemoteProcessed\)\.toBe\(0\)/
  )
  const twoActorActivitySource = specSource.slice(
    specSource.indexOf(
      "test('two-Actor 16-item operation and idle attribution'"
    ),
    specSource.indexOf("test('creation-only high-detail endpoint proof'")
  )
  assert.match(twoActorActivitySource, /Performance\.getMetrics/)
  assert.match(twoActorActivitySource, /summarizeRendererPerformanceWindow/)
  assert.match(twoActorActivitySource, /prepareAiTurn\(\s*actorA/)
  assert.match(twoActorActivitySource, /triggerPreparedAiTurn\(preparedTurn\)/)
  assert.match(
    twoActorActivitySource,
    /completePhase\(['"]post-completion-idle['"]\)[\s\S]*assertPreparedAiTurnSettled\(preparedTurn\)/
  )
  assert.match(
    twoActorActivitySource,
    /waitForBothComplete[\s\S]*endGuardPhase\(['"]operation['"]\)[\s\S]*startPhase\(['"]post-completion-idle['"]\)[\s\S]*delay\(10_000\)[\s\S]*completePhase\(['"]post-completion-idle['"]\)/
  )
  assert.match(twoActorActivitySource, /expectedTotal\s*=\s*17/)
  assert.match(
    twoActorActivitySource,
    /proofKind:\s*['"]collaboration-attribution['"]/
  )
  assert.match(twoActorActivitySource, /actorAOperation/)
  assert.match(twoActorActivitySource, /actorBOperation/)
  assert.match(twoActorActivitySource, /actorAIdle/)
  assert.match(twoActorActivitySource, /actorBIdle/)
  assert.match(
    twoActorActivitySource,
    /actorAIdleStart[\s\S]*delay\(10_000\)[\s\S]*summarizeRendererPerformanceWindow\(\s*actorAIdleStart/
  )
  assert.match(
    twoActorActivitySource,
    /idleDurationMs:\s*idleCompletedAtMs\s*-\s*idleStartedAtMs/
  )
  assert.match(specSource, /visibleWorkerTargets/)
  const preparedTurnSource = specSource.slice(
    specSource.indexOf('const prepareAiTurn'),
    specSource.indexOf('const triggerPreparedAiTurn')
  )
  assert.match(
    preparedTurnSource,
    /\.fill\(prompt\)[\s\S]*click\(\{\s*trial:\s*true\s*\}\)[\s\S]*boundingBox\(\)[\s\S]*data-endpoint-prepared-ai-submit/
  )
  const triggerPreparedTurnSource = specSource.slice(
    specSource.indexOf('const triggerPreparedAiTurn'),
    specSource.indexOf('const assertPreparedAiTurnSettled')
  )
  assert.match(triggerPreparedTurnSource, /page\.mouse\.click/)
  assert.match(specSource, /turnAccepted/)
  assert.match(specSource, /readLatestTurnSettlement/)
  assert.match(specSource, /readLatestFactoryTransactionStatus/)
  assert.match(
    specSource,
    /AI turn settled before[\s\S]*snapshot\.turnSettlement/
  )
  assert.match(
    specSource,
    /Prepared request click did not reach the armed Send control/
  )
  assert.match(specSource, /Agent did not accept the dispatched request/)
  assert.doesNotMatch(specSource, /(?:[?&])ai=mock/)
  assert.match(specSource, /readCanonicalElementCount/)
  assert.match(specSource, /readCounterTotal/)
  assert.match(specSource, /readFactoryPublicationCount/)
  assert.match(specSource, /readRenderProjectionElementCount/)
  assert.match(specSource, /readViewportPosition/)
  assert.match(specSource, /readZoom/)
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
  const highDetailSource = specSource.slice(
    specSource.indexOf("test('creation-only high-detail endpoint proof'")
  )
  assert.match(highDetailSource, /sourceBounds/)
  assert.match(highDetailSource, /documentEventAttempts/)
  assert.match(highDetailSource, /documentEventDeliveries/)
  assert.match(highDetailSource, /documentEventPreventions/)
  assert.match(highDetailSource, /deleteKeyBlocked/)
  assert.match(highDetailSource, /historyShortcutBlocked/)
  assert.match(highDetailSource, /rectangleShortcutBlocked/)
  assert.match(highDetailSource, /ordinaryKeyboardToolSwitchAccepted/)
  assert.match(highDetailSource, /focusLocalInteractionKeyboardTarget/)
  assert.match(highDetailSource, /loadingConnected\)\.toBe\(true\)/)
  assert.match(highDetailSource, /canonicalElements\)\.toBeLessThan\(7076\)/)
  assert.match(specSource, /stableLoadingFrameCount/)
  assert.match(specSource, /turnOutcome/)
  assert.match(specSource, /AI turn settled before/)
  assert.match(
    highDetailSource,
    /blockedState\.turnAccepted\)\.toBe\(true\)[\s\S]*blockedState\.turnOutcome\)\.toBeNull\(/
  )
  assert.match(highDetailSource, /readLocalInteractionProbe/)
  assert.match(highDetailSource, /settleFailureEvidenceWithin/)
  assert.doesNotMatch(specSource, /readConversationSnapshot/)
  assert.match(
    highDetailSource,
    /const browserErrors[\s\S]*getCapturedBrowserErrors\(actorA\)[\s\S]*getCapturedBrowserErrors\(actorB\)/
  )
  assert.match(highDetailSource, /\.slice\(-4\)/)
  assert.match(highDetailSource, /drawingProgress\.milestones/)
  assert.match(
    highDetailSource,
    /peerConvergenceHeartbeat\s*=\s*await heartbeat\.assertGuarded\(\s*heartbeat\.sample\(\)/
  )
  assert.match(
    highDetailSource,
    /assertGuarded\(\s*postHeartbeat\('progress', peerConvergenceHeartbeat\)/
  )
  const creationPhaseIndex = highDetailSource.indexOf(
    "heartbeat.startPhase('creation')"
  )
  const guardedCreationHeartbeatIndex = highDetailSource.indexOf(
    "postHeartbeat('progress', await heartbeat.sample())"
  )
  const creationStartedAtIndex = highDetailSource.indexOf(
    'const creationStartedAtMs = Date.now()'
  )
  const creationMarkIndex = highDetailSource.indexOf(
    'heartbeat.markCreationStarted(creationStartedAtMs)'
  )
  assert.ok(creationPhaseIndex >= 0)
  assert.ok(guardedCreationHeartbeatIndex > creationPhaseIndex)
  assert.ok(creationStartedAtIndex > guardedCreationHeartbeatIndex)
  assert.ok(creationMarkIndex > creationStartedAtIndex)
  assert.ok(
    highDetailSource.indexOf('triggerPreparedAiTurn(preparedTurn)') >
      creationMarkIndex
  )
  assert.ok(
    highDetailSource.indexOf(
      "waitForLocalInteractionProbe(actorA, 'loading-at-zero')"
    ) < highDetailSource.indexOf('triggerPreparedAiTurn(preparedTurn)'),
    'the loading-at-zero observer must be armed before the prepared request is dispatched'
  )
  const stagedBootstrapSource = specSource.slice(
    specSource.indexOf('const prepareEndpointActorsSequentially = async ('),
    specSource.indexOf("test('empty-document two-Actor endpoint connectivity'")
  )
  const actorACreateIndex = stagedBootstrapSource.indexOf(
    'const actorA = await createActor'
  )
  const actorACollaborationReadyIndex = stagedBootstrapSource.indexOf(
    "'actor-a-collaboration-ready'"
  )
  const actorBCreateIndex = stagedBootstrapSource.indexOf(
    'const actorB = await createActor'
  )
  const preparedActorsIndex = highDetailSource.indexOf(
    'await prepareEndpointActorsSequentially'
  )
  const referenceReadyIndex = highDetailSource.indexOf(
    "waitForConnectivityCpuSample('reference-ready'"
  )
  const guardReadyIndex = highDetailSource.indexOf(
    "waitForGuardReady(createConnectivityHeartbeat('request-ready'))"
  )
  const highDetailCreationIndex = highDetailSource.indexOf(
    "heartbeat.startPhase('creation')"
  )
  const actorANavigationIndex = stagedBootstrapSource.indexOf(
    "'actor-a-navigation'"
  )
  const actorBNavigationIndex = stagedBootstrapSource.indexOf(
    "'actor-b-navigation'"
  )
  assert.ok(actorACreateIndex >= 0)
  assert.ok(actorBCreateIndex > actorACreateIndex)
  assert.ok(actorANavigationIndex > actorBCreateIndex)
  assert.ok(actorACollaborationReadyIndex > actorANavigationIndex)
  assert.ok(actorBNavigationIndex > actorACollaborationReadyIndex)
  assert.ok(preparedActorsIndex >= 0)
  assert.ok(referenceReadyIndex > preparedActorsIndex)
  assert.ok(guardReadyIndex > referenceReadyIndex)
  assert.ok(highDetailCreationIndex > preparedActorsIndex)
  assert.doesNotMatch(
    stagedBootstrapSource,
    /Promise\.all\(\[\s*actorA\.goto\([\s\S]*actorB\.goto\(/
  )
  const createActorSource = specSource.slice(
    specSource.indexOf('const createActor = async ('),
    specSource.indexOf('const prepareEndpointActorsSequentially = async (')
  )
  assert.match(
    createActorSource,
    /const context = await browser\.newContext[\s\S]*try\s*{[\s\S]*await context\.newPage\(\)[\s\S]*catch[\s\S]*await context\.close\(\)/
  )
  assert.match(guardSource, /child\.once\(['"]close['"]/)
  assert.doesNotMatch(guardSource, /child\.once\(['"]exit['"]/)
  assert.match(guardSource, /child-close-timeout/)
  assert.match(
    guardSource,
    /request\.url === PHASE_BOUNDARY_PATH[\s\S]{0,5000}recordResourceSampleFailure[\s\S]{0,1000}phase-boundary-sample-failed/
  )
  assert.match(
    highDetailSource,
    /postHeartbeat\(['"]progress['"],\s*initialHeartbeat\)/
  )
  assert.match(specSource, /browserErrors/)
  assert.match(
    specSource,
    /waitForGuardReady\(\s*createConnectivityHeartbeat\(['"]browser-launched['"]\)/
  )
  assert.match(
    specSource,
    /browser-launched[\s\S]*single-a-ordinary-blank-idle[\s\S]*single-a-ordinary-navigation[\s\S]*single-a-ordinary-app-ready[\s\S]*single-a-ordinary-collaboration-ready[\s\S]*single-a-ordinary-idle[\s\S]*single-a-profiled-blank-idle[\s\S]*single-a-profiled-navigation[\s\S]*single-a-profiled-app-ready[\s\S]*single-a-profiled-collaboration-ready[\s\S]*single-a-profiled-idle[\s\S]*actor-a-blank-idle[\s\S]*actor-a-navigation[\s\S]*actor-a-app-ready[\s\S]*actor-a-collaboration-ready[\s\S]*actor-b-blank-idle[\s\S]*actor-b-navigation[\s\S]*actor-b-app-ready[\s\S]*actor-b-collaboration-ready[\s\S]*connected/
  )
  assert.match(specSource, /const waitForConnectivityCpuSample/)
  assert.doesNotMatch(specSource, /\bindexedDB\b|\bscreenshot\(|\bvideo\(/)
  assert.doesNotMatch(specSource, /\bundo\(|testInfo\.attach\(/)

  const actorSampleSource = specSource.slice(
    specSource.indexOf('const readActorSample'),
    specSource.indexOf('const delay')
  )
  assert.match(
    actorSampleSource,
    /successfulTurnCount:\s*profile\.readCounterTotal\(['"]ai-turn:outcome:success['"]\)/
  )
  assert.match(
    actorSampleSource,
    /nonSuccessfulTurnCount:[\s\S]*ai-turn:outcome:cancelled[\s\S]*ai-turn:outcome:failed[\s\S]*ai-turn:outcome:no-change[\s\S]*ai-turn:outcome:partial/
  )
  assert.doesNotMatch(
    actorSampleSource,
    /getRuntimeEvidence|readCanonicalElements|snapshot\(/
  )
  assert.match(
    specSource,
    /requestSubmissionClickCount[\s\S]*data-endpoint-prepared-ai-submit/
  )
  assert.match(
    specSource,
    /nonSuccessfulTurnCount\s*>\s*0[\s\S]*settled without success/
  )
  assert.match(
    specSource,
    /failureTimeEvidence\?:\s*LocalInteractionProbeSnapshot\s*\|\s*null/
  )
  assert.match(
    specSource,
    /error\?:\s*EndpointHeartbeatFailure[\s\S]*response\.json[\s\S]*!response\.ok\s*\|\|\s*result\.accepted\s*!==\s*true[\s\S]*result\.reason\s*\?\?\s*response\.status/
  )
  assert.match(
    specSource,
    /preparedSend\.addEventListener\([\s\S]*once:\s*true/
  )
  assert.doesNotMatch(
    specSource,
    /closest\(['"]\[data-endpoint-prepared-ai-submit/
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
    manifest.scripts['prepare:e2e:endpoint-performance'],
    /react:build.*prepare-server-response-preview\.mjs/
  )
  assert.match(
    manifest.scripts['prepare:e2e:endpoint-performance'],
    /VITE_ASYRA_DESIGN_COLLABORATION_WS_URL=ws:\/\/127\.0\.0\.1:4121\/asyra-design-collaboration yarn react:build/
  )
  ;[
    ['test:e2e:ai-attribution:16', '16'],
    ['test:e2e:ai-attribution:16-reduced-motion', '16-reduced-motion'],
    ['test:e2e:ai-attribution:1280', '1280'],
    ['test:e2e:ai-crdt-activity:16', '16-two-actor-activity']
  ].forEach(([script, attributionCase]) => {
    assert.match(
      manifest.scripts[script],
      new RegExp(`ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE=${attributionCase}`)
    )
    assert.match(manifest.scripts[script], /performance-resource-guard\.mjs/)
  })
  assert.match(
    manifest.scripts['test:local'],
    /performance-resource-guard\.test\.mjs/
  )
})

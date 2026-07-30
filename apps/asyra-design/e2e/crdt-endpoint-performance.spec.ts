import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page
} from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { summarizeRendererPerformanceWindow } from './performance-resource-guard.mjs'
import {
  captureBrowserErrors,
  getCapturedBrowserErrors,
  waitForAppReady
} from './test-utils'
import {
  seedAsyraDesignServerResponse,
  type AsyraDesignServerResponseItemCount
} from './server-response-inbox'

const expectedFixture = Object.freeze({
  groupCount: 1,
  totalCount: 7076,
  vectorCount: 7075
})
const exactCatOnlyPrompt =
  'Draw only the cat from the reference image. Exclude the original background and place the cat on a pure white background canvas with exactly the same width and height as the uploaded photo.'
const referenceImageName = 'research-02-original-tabby-source.png'
const referenceImagePath = fileURLToPath(
  new URL(
    '../visual-review-records/research/research-02-original-tabby-source.png',
    import.meta.url
  )
)

const requireEnvironment = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Endpoint performance resource guard requires non-empty ${name}`
    )
  }
  return value
}

const endpointGuardEnabled = [
  'ASYRA_DESIGN_ENDPOINT_OWNER',
  'ASYRA_DESIGN_ENDPOINT_GUARD_URL',
  'ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN'
].every((name) => Boolean(process.env[name]?.trim()))
const endpointConnectivityOnly =
  process.env.ASYRA_DESIGN_ENDPOINT_CONNECTIVITY_ONLY === '1'
const endpointAttributionCase =
  process.env.ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE?.trim() ?? ''
const endpointLocalAttribution = ['16', '16-reduced-motion', '1280'].includes(
  endpointAttributionCase
)
const endpointTwoActorActivityAttribution =
  endpointAttributionCase === '16-two-actor-activity'
const endpointOwner = endpointGuardEnabled
  ? requireEnvironment('ASYRA_DESIGN_ENDPOINT_OWNER')
  : 'guarded-endpoint-disabled'
const guardURL = endpointGuardEnabled
  ? requireEnvironment('ASYRA_DESIGN_ENDPOINT_GUARD_URL').replace(/\/+$/, '')
  : 'http://127.0.0.1'
const guardToken = endpointGuardEnabled
  ? requireEnvironment('ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN')
  : 'guarded-endpoint-disabled'

test.skip(
  !endpointGuardEnabled,
  'The high-detail endpoint proof can run only through its resource guard'
)

interface ActorHeartbeat {
  readonly canonicalElements: number
  readonly complete: boolean
  readonly completeAtMs: number | null
  readonly elements: number
  readonly firstVisibleAtMs: number | null
  readonly renderProjectionElements: number
  readonly total: number
  readonly undoDepth: number
}

interface PublicationHeartbeat {
  readonly actorAFactory: number
  readonly actorALocalSent: number
  readonly actorBFactory: number
  readonly actorBLocalSent: number
  readonly actorBRemoteProcessed: number
  readonly failed: number
}

interface EndpointHeartbeat {
  readonly activePhase: string | null
  readonly actorA: ActorHeartbeat
  readonly actorB: ActorHeartbeat
  readonly capturedAtMs: number
  readonly elapsedMs: number | null
  readonly owner: string
  readonly ownerTiming: {
    readonly actorADurationMs: number
    readonly actorAPhase: string
    readonly actorBDurationMs: number
    readonly actorBPhase: string
  }
  readonly phase: string
  readonly proofKind:
    | 'endpoint'
    | 'local-attribution'
    | 'collaboration-attribution'
  readonly publications: PublicationHeartbeat
}

interface CanonicalSummary {
  readonly canonicalSha256: string
  readonly firstId: string | null
  readonly groupCount: number
  readonly groupChildCount: number
  readonly hierarchyOrderMatches: boolean
  readonly hierarchySha256: string
  readonly idsSha256: string
  readonly lastId: string | null
  readonly pointCount: number
  readonly renderedCount: number
  readonly totalCount: number
  readonly vectorCount: number
  readonly vectorsInGroupCount: number
  readonly whiteBackgrounds: readonly {
    readonly height: number
    readonly id: string
    readonly width: number
  }[]
}

interface LocalAttributionSummary {
  readonly mainThreadAverageTaskCorePercent: number
  readonly mainThreadLayoutDurationMs: number
  readonly mainThreadRecalcStyleDurationMs: number
  readonly mainThreadScriptDurationMs: number
  readonly mainThreadTaskDurationMs: number
  readonly renderedCount: number
  readonly requestedItems: number
  readonly totalCount: number
  readonly visibleWorkerTargetCount: number
}

interface RendererPerformanceWindow {
  readonly averageTaskCorePercent: number
  readonly durationMs: number
  readonly heapUsedEndBytes: number
  readonly heapUsedStartBytes: number
  readonly layoutDurationMs: number
  readonly recalcStyleDurationMs: number
  readonly scriptDurationMs: number
  readonly taskDurationMs: number
}

interface PreparedAiTurn {
  readonly page: Page
  readonly sendCenter: {
    readonly x: number
    readonly y: number
  }
}

interface TwoActorActivitySummary extends LocalAttributionSummary {
  readonly idleAverageTaskCorePercent: number
  readonly idleHeapUsedEndBytes: number
  readonly idleHeapUsedStartBytes: number
  readonly idleLayoutDurationMs: number
  readonly idleRecalcStyleDurationMs: number
  readonly idleScriptDurationMs: number
  readonly idleTaskDurationMs: number
  readonly operationAverageTaskCorePercent: number
  readonly operationHeapUsedEndBytes: number
  readonly operationHeapUsedStartBytes: number
  readonly operationLayoutDurationMs: number
  readonly operationRecalcStyleDurationMs: number
  readonly operationScriptDurationMs: number
  readonly operationTaskDurationMs: number
}

interface FinalActorDiagnostics {
  readonly configuration: {
    readonly contentsMode: string
    readonly deliveryMode: string
  }
  readonly factoryPublicationCount: number
  readonly historyDepth: number
  readonly localSentCount: number
  readonly counterTimeline: readonly {
    readonly atMs: number
    readonly name: string
    readonly value: number
  }[]
  readonly phaseTimeline: readonly {
    readonly atMs: number
    readonly durationMs: number
    readonly name: string
  }[]
  readonly persistencePhaseCount: number
  readonly remoteProcessedCount: number
  readonly renderProjectionAnomalies: {
    readonly failed: number
    readonly missing: number
    readonly resynced: number
  }
  readonly runtime: string
  readonly topPhases: readonly {
    readonly durationMs: number
    readonly name: string
  }[]
  readonly visibleWorkerTargets: readonly string[]
}

interface EndpointReport {
  readonly actorA: {
    readonly completeMs: number | null
    readonly diagnostics: FinalActorDiagnostics
    readonly firstVisibleMs: number | null
    readonly summary:
      | CanonicalSummary
      | LocalAttributionSummary
      | TwoActorActivitySummary
  }
  readonly actorB: {
    readonly completeMs: number | null
    readonly diagnostics: FinalActorDiagnostics
    readonly firstVisibleMs: number | null
    readonly summary:
      | CanonicalSummary
      | LocalAttributionSummary
      | TwoActorActivitySummary
  } | null
  readonly convergedMs: number | null
  readonly durationMs: number
  readonly equivalenceProofMs: number | null
  readonly idleCompletedAtMs?: number
  readonly idleDurationMs?: number
  readonly idleStartedAtMs?: number
  readonly operationCompletedAtMs?: number
  readonly operationDurationMs?: number
  readonly operationStartedAtMs?: number
  readonly owner: string
  readonly proofKind:
    | 'endpoint'
    | 'local-attribution'
    | 'collaboration-attribution'
  readonly status: 'complete'
}

type EndpointHeartbeatEnvelope = EndpointHeartbeat & {
  readonly error?: unknown
  readonly report?: EndpointReport
}

const postHeartbeat = async (
  kind: 'ready' | 'progress' | 'complete' | 'failed',
  heartbeat: EndpointHeartbeatEnvelope
): Promise<{ accepted?: boolean }> => {
  const response = await fetch(`${guardURL}/heartbeat`, {
    body: JSON.stringify({
      heartbeat,
      kind,
      token: guardToken
    }),
    headers: {
      'content-type': 'application/json'
    },
    method: 'POST',
    signal: AbortSignal.timeout(3_000)
  })
  if (!response.ok) {
    throw new Error(
      `Endpoint performance resource guard rejected ${kind} heartbeat (${response.status})`
    )
  }
  const result = (await response.json().catch(() => ({}))) as {
    accepted?: boolean
  }
  // Keep runner output bounded and never print the guard token.
  // eslint-disable-next-line no-console
  console.log(`ASYRA_ENDPOINT_HEARTBEAT ${JSON.stringify({ heartbeat, kind })}`)
  return result
}

const postPhaseBoundary = async (
  kind: 'start' | 'end',
  phase: string
): Promise<void> => {
  const response = await fetch(`${guardURL}/phase-boundary`, {
    body: JSON.stringify({
      kind,
      owner: endpointOwner,
      phase,
      token: guardToken
    }),
    headers: {
      'content-type': 'application/json'
    },
    method: 'POST',
    signal: AbortSignal.timeout(3_000)
  })
  const result = (await response.json().catch(() => ({}))) as {
    accepted?: boolean
    reason?: string
  }
  if (!response.ok || result.accepted !== true) {
    throw new Error(
      `Endpoint performance resource guard rejected ${kind} boundary for ${phase}: ${
        result.reason ?? response.status
      }`
    )
  }
}

const waitForGuardReady = async (
  heartbeat: EndpointHeartbeat
): Promise<void> => {
  const deadline = Date.now() + 10_000
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const response = await postHeartbeat('ready', heartbeat)
      if (response.accepted === true) return
      lastError = new Error(
        'Endpoint performance resource guard has not sampled the process yet'
      )
    } catch (error) {
      lastError = error
    }
    await delay(250)
  }
  throw new Error(
    `Endpoint performance resource guard did not accept readiness within 10 seconds: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  )
}

const collaborationURL = (fileId: string) =>
  `/?fileId=${encodeURIComponent(fileId)}` +
  '&aiDelivery=progressive' +
  '&aiPerformance=profile' +
  '&aiPerformanceContents=omitted'

const singleActorAppURL = (fileId: string) =>
  `/?fileId=${encodeURIComponent(fileId)}` +
  '&aiDelivery=progressive&aiPerformanceContents=omitted'
const profiledSingleActorAppURL = (fileId: string) =>
  `${singleActorAppURL(fileId)}&aiPerformance=profile`

const waitForCollaboration = async (
  page: Page,
  actor: 'Actor A' | 'Actor B'
): Promise<void> => {
  try {
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__AsyraCollaboration__?.getStatus() ?? 'missing'
          ),
        { timeout: 30_000 }
      )
      .toBe('connected')
  } catch (error) {
    const status = await page
      .evaluate(() => window.__AsyraCollaboration__?.getStatus() ?? 'missing')
      .catch(() => 'unavailable')
    const browserErrors = getCapturedBrowserErrors(page)
      .slice(-4)
      .map((message) => message.slice(0, 300))
    throw new Error(
      `${actor} collaboration did not connect; status=${status}; browserErrors=${JSON.stringify(
        browserErrors
      )}`,
      { cause: error }
    )
  }
}

const installBoundedDiagnostics = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const scope = globalThis as typeof globalThis & {
      __AsyraEndpointDiagnostics__?: {
        failed: number
        localSent: number
        remoteProcessed: number
      }
    }
    const diagnostics = {
      failed: 0,
      localSent: 0,
      remoteProcessed: 0
    }
    scope.__AsyraEndpointDiagnostics__ = diagnostics

    // The endpoint heartbeat stores only scalar counts. It never clones the
    // publication payload or the performance profile's evidence arrays.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collaboration = (window as any).__AsyraCollaboration__
    collaboration?.observePublicationOutcomes?.(
      (outcome: { direction?: string; status?: string }) => {
        if (outcome.direction === 'local' && outcome.status === 'sent') {
          diagnostics.localSent += 1
        }
        if (outcome.direction === 'remote' && outcome.status === 'processed') {
          diagnostics.remoteProcessed += 1
        }
        if (
          outcome.status === 'send-failed' ||
          outcome.status === 'process-failed'
        ) {
          diagnostics.failed += 1
        }
      }
    )

    const profile = window.__AsyraAiDrawingPerformance__
    if (!profile) {
      throw new Error('AI drawing performance profile is unavailable')
    }
    profile.reset()
  })
}

const readActorSample = async (
  page: Page
): Promise<{
  canonicalElements: number
  factoryPublications: number
  failed: number
  historyDepth: number
  latestOwnerTiming: {
    durationMs: number
    name: string
  } | null
  localSent: number
  remoteProcessed: number
  renderProjectionElements: number
  successfulTurnCount: number
}> =>
  page.evaluate(() => {
    const profile = window.__AsyraAiDrawingPerformance__
    if (!profile) {
      throw new Error('AI drawing performance profile is unavailable')
    }
    const scope = globalThis as typeof globalThis & {
      __AsyraEndpointDiagnostics__?: {
        failed: number
        localSent: number
        remoteProcessed: number
      }
    }
    const diagnostics = scope.__AsyraEndpointDiagnostics__
    if (!diagnostics) {
      throw new Error('Endpoint performance diagnostics are unavailable')
    }
    return {
      canonicalElements: profile.readCanonicalElementCount(),
      factoryPublications: profile.readFactoryPublicationCount(),
      failed: diagnostics.failed,
      historyDepth: profile.readHistoryDepth(),
      latestOwnerTiming: profile.readLatestPhaseSample(),
      localSent: diagnostics.localSent,
      remoteProcessed: diagnostics.remoteProcessed,
      renderProjectionElements: profile.readRenderProjectionElementCount(),
      successfulTurnCount: profile.readCounterTotal('ai-turn:outcome:success')
    }
  })

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs))

const waitForConnectivityCpuSample = async (
  phase: string,
  action?: () => Promise<unknown>,
  proofKind: EndpointHeartbeat['proofKind'] = 'endpoint'
): Promise<void> => {
  await postHeartbeat(
    'progress',
    createConnectivityHeartbeat('bootstrap', proofKind, phase)
  )
  await action?.()
  await delay(750)
  await postHeartbeat('progress', createConnectivityHeartbeat(phase, proofKind))
}

const createConnectivityHeartbeat = (
  phase: string,
  proofKind: EndpointHeartbeat['proofKind'] = 'endpoint',
  activePhase: string | null = null
): EndpointHeartbeat => ({
  activePhase,
  actorA: {
    canonicalElements: 0,
    complete: false,
    completeAtMs: null,
    elements: 0,
    firstVisibleAtMs: null,
    renderProjectionElements: 0,
    total: 0,
    undoDepth: 0
  },
  actorB: {
    canonicalElements: 0,
    complete: false,
    completeAtMs: null,
    elements: 0,
    firstVisibleAtMs: null,
    renderProjectionElements: 0,
    total: 0,
    undoDepth: 0
  },
  capturedAtMs: Date.now(),
  elapsedMs: null,
  owner: endpointOwner,
  ownerTiming: {
    actorADurationMs: 0,
    actorAPhase: 'harness-connectivity',
    actorBDurationMs: 0,
    actorBPhase: 'harness-connectivity'
  },
  phase,
  proofKind,
  publications: {
    actorAFactory: 0,
    actorALocalSent: 0,
    actorBFactory: 0,
    actorBLocalSent: 0,
    actorBRemoteProcessed: 0,
    failed: 0
  }
})

const createHeartbeatController = (
  actorA: Page,
  actorB: Page,
  expectedTotal = expectedFixture.totalCount,
  proofKind: EndpointHeartbeat['proofKind'] = 'endpoint'
) => {
  let active = false
  let creationStartedAtMs: number | null = null
  let activeHeartbeatPhase: string | null = null
  let latestCompletedPhase = 'actors-ready'
  let actorAFirstVisibleAtMs: number | null = null
  let actorACompleteAtMs: number | null = null
  let actorBFirstVisibleAtMs: number | null = null
  let actorBCompleteAtMs: number | null = null
  let latest: EndpointHeartbeat | null = null
  let rejectFailure: (error: Error) => void = () => undefined
  const failure = new Promise<never>((_resolve, reject) => {
    rejectFailure = reject
  })
  void failure.catch(() => undefined)

  const sample = async (): Promise<EndpointHeartbeat> => {
    const [actorASample, actorBSample] = await Promise.all([
      readActorSample(actorA),
      readActorSample(actorB)
    ])
    const elapsedMs =
      creationStartedAtMs === null ? null : Date.now() - creationStartedAtMs
    const actorARendered = actorASample.renderProjectionElements
    const actorBRendered = actorBSample.renderProjectionElements
    const actorAComplete =
      actorASample.canonicalElements === expectedTotal &&
      actorARendered === expectedTotal &&
      actorASample.successfulTurnCount === 1
    const publicationsSettled =
      actorASample.failed + actorBSample.failed === 0 &&
      actorASample.localSent > 0 &&
      actorASample.factoryPublications === actorASample.localSent &&
      actorASample.localSent === actorBSample.remoteProcessed
    const actorBComplete =
      actorBSample.canonicalElements === expectedTotal &&
      actorBRendered === expectedTotal &&
      publicationsSettled
    if (
      elapsedMs !== null &&
      actorARendered > 0 &&
      actorAFirstVisibleAtMs === null
    ) {
      actorAFirstVisibleAtMs = elapsedMs
    }
    if (
      elapsedMs !== null &&
      actorBRendered > 0 &&
      actorBFirstVisibleAtMs === null
    ) {
      actorBFirstVisibleAtMs = elapsedMs
    }
    if (elapsedMs !== null && actorAComplete && actorACompleteAtMs === null) {
      actorACompleteAtMs = elapsedMs
    }
    if (elapsedMs !== null && actorBComplete && actorBCompleteAtMs === null) {
      actorBCompleteAtMs = elapsedMs
    }
    latest = {
      activePhase: activeHeartbeatPhase,
      actorA: {
        canonicalElements: actorASample.canonicalElements,
        complete: actorAComplete,
        completeAtMs: actorACompleteAtMs,
        elements: actorARendered,
        firstVisibleAtMs: actorAFirstVisibleAtMs,
        renderProjectionElements: actorASample.renderProjectionElements,
        total: expectedTotal,
        undoDepth: actorASample.historyDepth
      },
      actorB: {
        canonicalElements: actorBSample.canonicalElements,
        complete: actorBComplete,
        completeAtMs: actorBCompleteAtMs,
        elements: actorBRendered,
        firstVisibleAtMs: actorBFirstVisibleAtMs,
        renderProjectionElements: actorBSample.renderProjectionElements,
        total: expectedTotal,
        undoDepth: actorBSample.historyDepth
      },
      capturedAtMs: Date.now(),
      elapsedMs,
      owner: endpointOwner,
      ownerTiming: {
        actorADurationMs: actorASample.latestOwnerTiming?.durationMs ?? 0,
        actorAPhase: actorASample.latestOwnerTiming?.name ?? 'unavailable',
        actorBDurationMs: actorBSample.latestOwnerTiming?.durationMs ?? 0,
        actorBPhase: actorBSample.latestOwnerTiming?.name ?? 'unavailable'
      },
      phase: latestCompletedPhase,
      proofKind,
      publications: {
        actorAFactory: actorASample.factoryPublications,
        actorALocalSent: actorASample.localSent,
        actorBFactory: actorBSample.factoryPublications,
        actorBLocalSent: actorBSample.localSent,
        actorBRemoteProcessed: actorBSample.remoteProcessed,
        failed: actorASample.failed + actorBSample.failed
      }
    }
    return latest
  }

  const run = async (): Promise<void> => {
    while (active) {
      await delay(1_000)
      if (!active) return
      try {
        await postHeartbeat('progress', await sample())
      } catch (error) {
        active = false
        rejectFailure(error instanceof Error ? error : new Error(String(error)))
        return
      }
    }
  }
  let loop: Promise<void> | null = null

  return {
    assertGuarded: <T>(operation: Promise<T>): Promise<T> =>
      Promise.race([operation, failure]),
    begin: () => {
      active = true
      loop = run()
    },
    markCreationStarted: (startedAtMs: number) => {
      creationStartedAtMs = startedAtMs
    },
    completePhase: (phase: string) => {
      latestCompletedPhase = phase
      activeHeartbeatPhase = null
    },
    readLatest: () => latest,
    sample,
    startPhase: (phase: string) => {
      activeHeartbeatPhase = phase
    },
    stop: async () => {
      active = false
      await loop
    },
    waitForActorAComplete: async (
      timeoutMs: number
    ): Promise<EndpointHeartbeat> => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const heartbeat = latest
        if (heartbeat?.actorA.complete) {
          return heartbeat
        }
        await Promise.race([delay(100), failure])
      }
      throw new Error(`Actor A timed out at ${JSON.stringify(latest)}`)
    },
    waitForBothComplete: async (
      timeoutMs: number
    ): Promise<EndpointHeartbeat> => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const heartbeat = latest
        if (heartbeat?.actorA.complete && heartbeat.actorB.complete) {
          return heartbeat
        }
        await Promise.race([delay(100), failure])
      }
      throw new Error(
        `Actor convergence timed out at ${JSON.stringify(latest)}`
      )
    }
  }
}

const createLocalAttributionHeartbeatController = (
  actorA: Page,
  expectedTotal: number
) => {
  let active = false
  let activeHeartbeatPhase: string | null = null
  let latestCompletedPhase = 'local-request-ready'
  let creationStartedAtMs: number | null = null
  let firstVisibleAtMs: number | null = null
  let completeAtMs: number | null = null
  let latest: EndpointHeartbeat | null = null
  let rejectFailure: (error: Error) => void = () => undefined
  const failure = new Promise<never>((_resolve, reject) => {
    rejectFailure = reject
  })
  void failure.catch(() => undefined)

  const sample = async (): Promise<EndpointHeartbeat> => {
    const actorASample = await readActorSample(actorA)
    const elapsedMs =
      creationStartedAtMs === null ? null : Date.now() - creationStartedAtMs
    const rendered = actorASample.renderProjectionElements
    const complete =
      actorASample.canonicalElements === expectedTotal &&
      rendered === expectedTotal &&
      actorASample.successfulTurnCount === 1
    if (elapsedMs !== null && rendered > 0 && firstVisibleAtMs === null) {
      firstVisibleAtMs = elapsedMs
    }
    if (elapsedMs !== null && complete && completeAtMs === null) {
      completeAtMs = elapsedMs
    }
    latest = {
      activePhase: activeHeartbeatPhase,
      actorA: {
        canonicalElements: actorASample.canonicalElements,
        complete,
        completeAtMs,
        elements: rendered,
        firstVisibleAtMs,
        renderProjectionElements: rendered,
        total: expectedTotal,
        undoDepth: actorASample.historyDepth
      },
      actorB: {
        canonicalElements: 0,
        complete: false,
        completeAtMs: null,
        elements: 0,
        firstVisibleAtMs: null,
        renderProjectionElements: 0,
        total: 0,
        undoDepth: 0
      },
      capturedAtMs: Date.now(),
      elapsedMs,
      owner: endpointOwner,
      ownerTiming: {
        actorADurationMs: actorASample.latestOwnerTiming?.durationMs ?? 0,
        actorAPhase: actorASample.latestOwnerTiming?.name ?? 'unavailable',
        actorBDurationMs: 0,
        actorBPhase: 'inactive-local-only'
      },
      phase: latestCompletedPhase,
      proofKind: 'local-attribution',
      publications: {
        actorAFactory: actorASample.factoryPublications,
        actorALocalSent: actorASample.localSent,
        actorBFactory: 0,
        actorBLocalSent: 0,
        actorBRemoteProcessed: 0,
        failed: actorASample.failed
      }
    }
    return latest
  }

  const run = async (): Promise<void> => {
    while (active) {
      await delay(1_000)
      if (!active) return
      try {
        await postHeartbeat('progress', await sample())
      } catch (error) {
        active = false
        rejectFailure(error instanceof Error ? error : new Error(String(error)))
        return
      }
    }
  }
  let loop: Promise<void> | null = null

  return {
    assertGuarded: <T>(operation: Promise<T>): Promise<T> =>
      Promise.race([operation, failure]),
    begin: () => {
      active = true
      loop = run()
    },
    markCreationStarted: (startedAtMs: number) => {
      creationStartedAtMs = startedAtMs
    },
    completePhase: (phase: string) => {
      latestCompletedPhase = phase
      activeHeartbeatPhase = null
    },
    readLatest: () => latest,
    sample,
    startPhase: (phase: string) => {
      activeHeartbeatPhase = phase
    },
    stop: async () => {
      active = false
      await loop
    },
    waitForComplete: async (timeoutMs: number): Promise<EndpointHeartbeat> => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (latest?.actorA.complete) {
          return latest
        }
        await Promise.race([delay(100), failure])
      }
      throw new Error(
        `Local attribution timed out at ${JSON.stringify(latest)}`
      )
    }
  }
}

const readCanonicalSummary = (page: Page): Promise<CanonicalSummary> =>
  page.evaluate(async () => {
    const profile = window.__AsyraAiDrawingPerformance__
    if (!profile) {
      throw new Error('AI drawing performance profile is unavailable')
    }
    const normalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(normalize)
      if (!value || typeof value !== 'object') return value
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)])
      )
    }
    const canonicalElements = profile
      .readCanonicalElements()
      .filter(({ type }) => type !== 'workspace')
    const hierarchy: {
      children: readonly string[]
      id: string
      parentId: string | null
      type: string
    }[] = []
    const ids: string[] = []
    const whiteBackgrounds: { height: number; id: string; width: number }[] = []
    let groupChildren: readonly string[] = []
    let groupCount = 0
    let groupId: string | null = null
    let pointCount = 0
    let renderedCount = 0
    let vectorCount = 0
    for (const element of canonicalElements) {
      const raw = element.raw as {
        children?: unknown
        parentId?: unknown
      }
      const children = Array.isArray(raw.children)
        ? raw.children.filter(
            (childId): childId is string => typeof childId === 'string'
          )
        : []
      const parentId = typeof raw.parentId === 'string' ? raw.parentId : null
      hierarchy.push({
        children,
        id: element.id,
        parentId,
        type: element.type
      })
      ids.push(element.id)
      if (element.rendered) renderedCount += 1
      if (element.type === 'group') {
        groupCount += 1
        groupChildren = children
        groupId = element.id
        continue
      }
      if (element.type !== 'vector') continue
      vectorCount += 1
      const computed = element.computed as {
        fills?: readonly { color?: string }[]
        height?: number
        points?: Record<string, unknown>
        width?: number
      }
      pointCount += Object.keys(computed.points ?? {}).length
      if (
        computed.fills?.[0]?.color === '#FFFFFF' &&
        computed.width === 1672 &&
        computed.height === 941
      ) {
        whiteBackgrounds.push({
          height: computed.height,
          id: element.id,
          width: computed.width
        })
      }
    }
    const vectorIds = canonicalElements
      .filter(({ type }) => type === 'vector')
      .map(({ id }) => id)
    const vectorsInGroupCount =
      groupId === null
        ? 0
        : hierarchy.filter(
            ({ parentId, type }) => type === 'vector' && parentId === groupId
          ).length
    const hierarchyOrderMatches =
      groupId !== null &&
      groupChildren.length === vectorIds.length &&
      groupChildren.every((childId, index) => childId === vectorIds[index])
    const canonical = canonicalElements.map(({ computed, id, raw, type }) => ({
      computed: normalize(computed),
      id,
      raw: normalize(raw),
      type
    }))
    const digest = async (value: unknown): Promise<string> => {
      const bytes = new TextEncoder().encode(JSON.stringify(value))
      const hash = await crypto.subtle.digest('SHA-256', bytes)
      return [...new Uint8Array(hash)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
    }
    const [canonicalSha256, hierarchySha256, idsSha256] = await Promise.all([
      digest(canonical),
      digest(hierarchy),
      digest(ids)
    ])
    return {
      canonicalSha256,
      firstId: ids[0] ?? null,
      groupCount,
      groupChildCount: groupChildren.length,
      hierarchyOrderMatches,
      hierarchySha256,
      idsSha256,
      lastId: ids.at(-1) ?? null,
      pointCount,
      renderedCount,
      totalCount: ids.length,
      vectorCount,
      vectorsInGroupCount,
      whiteBackgrounds
    }
  })

const visibleWorkerTargets = (page: Page): readonly string[] =>
  [...new Set(page.workers().map((worker) => worker.url()))]
    .filter((url) => url.length > 0)
    .sort()

const readFinalDiagnostics = async (
  page: Page
): Promise<FinalActorDiagnostics> => {
  const diagnostics = await page.evaluate(() => {
    const profile = window.__AsyraAiDrawingPerformance__
    if (!profile) {
      throw new Error('AI drawing performance profile is unavailable')
    }
    const scope = globalThis as typeof globalThis & {
      __AsyraEndpointDiagnostics__?: {
        localSent: number
        remoteProcessed: number
      }
    }
    const diagnostics = scope.__AsyraEndpointDiagnostics__
    if (!diagnostics) {
      throw new Error('Endpoint performance diagnostics are unavailable')
    }
    const snapshot = profile.snapshot()
    const phaseTotals = new Map<string, number>()
    for (const phase of snapshot.phases) {
      phaseTotals.set(
        phase.name,
        (phaseTotals.get(phase.name) ?? 0) + phase.durationMs
      )
    }
    const persistencePhaseCount = snapshot.phases.filter(
      ({ name }) =>
        name === 'core:persistence-capture' ||
        name === 'core:persistence-save' ||
        name === 'persistence:indexeddb-put'
    ).length
    return {
      configuration: snapshot.configuration,
      factoryPublicationCount: profile.readFactoryPublicationCount(),
      historyDepth: profile.readHistoryDepth(),
      localSentCount: diagnostics.localSent,
      counterTimeline: snapshot.counters
        .filter(({ name }) => name.startsWith('ai-drawing:'))
        .slice(-64)
        .map(({ atMs, name, value }) => ({
          atMs: Math.round(atMs * 1000) / 1000,
          name,
          value
        })),
      phaseTimeline: snapshot.phases
        .filter(({ name }) =>
          /^(?:ai-app|ai-provider|ai-runtime|ai-server-response-inbox|ai-turn):/u.test(
            name
          )
        )
        .slice(-128)
        .map(({ atMs, durationMs, name }) => ({
          atMs: Math.round(atMs * 1000) / 1000,
          durationMs: Math.round(durationMs * 1000) / 1000,
          name
        })),
      persistencePhaseCount,
      remoteProcessedCount: diagnostics.remoteProcessed,
      renderProjectionAnomalies: {
        failed: profile.readCounterTotal('render-projection-outcome-failed'),
        missing: profile.readCounterTotal('render-projection-outcome-missing'),
        resynced: profile.readCounterTotal('render-projection-outcome-resynced')
      },
      runtime: snapshot.runtime,
      topPhases: [...phaseTotals.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 24)
        .map(([name, durationMs]) => ({
          durationMs: Math.round(durationMs * 1000) / 1000,
          name
        }))
    }
  })
  return {
    ...diagnostics,
    visibleWorkerTargets: visibleWorkerTargets(page)
  }
}

const openAgent = async (page: Page): Promise<void> => {
  await page.getByTestId('ai-agent-toolbar-button').click()
  await expect(page.getByTestId('ai-agent-panel')).toBeVisible()
}

const openAgentAndAttachReference = async (page: Page): Promise<void> => {
  await openAgent(page)
  await page.getByLabel('Choose images').setInputFiles(referenceImagePath)
  await expect(
    page.getByRole('img', { name: referenceImageName })
  ).toBeVisible()
}

const prepareAiTurn = async (
  page: Page,
  prompt: string
): Promise<PreparedAiTurn> => {
  const input = page.getByLabel('Message Agent')
  await expect(input).toBeEnabled()
  await input.fill(prompt)
  const send = page.getByRole('button', { name: 'Send' })
  await expect(send).toBeEnabled()
  await send.click({ trial: true })
  const bounds = await send.boundingBox()
  if (!bounds) {
    throw new Error('Prepared AI Send button bounds are unavailable')
  }
  return {
    page,
    sendCenter: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    }
  }
}

const triggerPreparedAiTurn = async (
  prepared: PreparedAiTurn
): Promise<void> => {
  await prepared.page.mouse.click(prepared.sendCenter.x, prepared.sendCenter.y)
}

const assertPreparedAiTurnSettled = async (
  prepared: PreparedAiTurn
): Promise<void> => {
  const { page } = prepared
  const settledTurns = page.getByTestId('ai-agent-message')
  await expect(settledTurns).toHaveCount(1, { timeout: 120_000 })
  const turn = settledTurns.last()
  await expect(turn).toHaveAttribute('data-outcome', 'success')
  await expect(turn.getByText('Drawing updated successfully.')).toBeVisible()
}

const closeContexts = async (
  contexts: readonly BrowserContext[]
): Promise<void> => {
  await Promise.allSettled(contexts.map((context) => context.close()))
}

const createActor = async (
  browser: Browser,
  baseURL: string,
  options: { reducedMotion?: 'no-preference' | 'reduce' } = {}
): Promise<{ context: BrowserContext; page: Page }> => {
  const context = await browser.newContext({
    baseURL,
    reducedMotion: options.reducedMotion,
    viewport: { height: 900, width: 1440 }
  })
  try {
    const page = await context.newPage()
    captureBrowserErrors(page)
    return { context, page }
  } catch (error) {
    await context.close().catch(() => undefined)
    throw error
  }
}

const prepareEndpointActorsSequentially = async ({
  baseURL,
  browser,
  fileId,
  serverResponseItemCount,
  proofKind = 'endpoint'
}: {
  readonly baseURL: string
  readonly browser: Browser
  readonly fileId: string
  readonly serverResponseItemCount?: AsyraDesignServerResponseItemCount
  readonly proofKind?: EndpointHeartbeat['proofKind']
}): Promise<{
  actorA: Page
  actorB: Page
  contexts: readonly [BrowserContext, BrowserContext]
}> => {
  const contexts: BrowserContext[] = []
  try {
    await postHeartbeat(
      'progress',
      createConnectivityHeartbeat(
        'browser-launched',
        proofKind,
        'actor-a-context-create'
      )
    )
    const actorA = await createActor(browser, baseURL)
    contexts.push(actorA.context)

    await postHeartbeat(
      'progress',
      createConnectivityHeartbeat(
        'actor-a-context-created',
        proofKind,
        'actor-b-context-create'
      )
    )
    const actorB = await createActor(browser, baseURL)
    contexts.push(actorB.context)

    if (serverResponseItemCount !== undefined) {
      await waitForConnectivityCpuSample(
        'actor-a-server-response-seed',
        () =>
          seedAsyraDesignServerResponse(actorA.context, {
            appUrl: collaborationURL(fileId),
            fileId,
            itemCount: serverResponseItemCount
          }),
        proofKind
      )
    }
    await waitForConnectivityCpuSample(
      'actor-a-blank-idle',
      undefined,
      proofKind
    )
    await waitForConnectivityCpuSample(
      'actor-a-navigation',
      () => actorA.page.goto(collaborationURL(fileId)),
      proofKind
    )
    await waitForConnectivityCpuSample(
      'actor-a-app-ready',
      () => waitForAppReady(actorA.page),
      proofKind
    )
    await waitForConnectivityCpuSample(
      'actor-a-collaboration-ready',
      () => waitForCollaboration(actorA.page, 'Actor A'),
      proofKind
    )

    await waitForConnectivityCpuSample(
      'actor-b-blank-idle',
      undefined,
      proofKind
    )
    await waitForConnectivityCpuSample(
      'actor-b-navigation',
      () => actorB.page.goto(collaborationURL(fileId)),
      proofKind
    )
    await waitForConnectivityCpuSample(
      'actor-b-app-ready',
      () => waitForAppReady(actorB.page),
      proofKind
    )
    await waitForConnectivityCpuSample(
      'actor-b-collaboration-ready',
      () => waitForCollaboration(actorB.page, 'Actor B'),
      proofKind
    )
    await waitForConnectivityCpuSample('connected', undefined, proofKind)

    return {
      actorA: actorA.page,
      actorB: actorB.page,
      contexts: [actorA.context, actorB.context]
    }
  } catch (error) {
    await closeContexts(contexts)
    throw error
  }
}

test('empty-document two-Actor endpoint connectivity', async ({
  browser
}, testInfo) => {
  test.skip(
    !endpointConnectivityOnly || endpointLocalAttribution,
    'The focused connectivity case runs only when explicitly selected'
  )
  const baseURL = String(testInfo.project.use.baseURL ?? '')
  if (!baseURL) {
    throw new Error('Endpoint performance App URL is unavailable')
  }
  const fileId = `connectivity-${endpointOwner}-${Date.now()}`
  const contexts: BrowserContext[] = []
  try {
    await waitForGuardReady(createConnectivityHeartbeat('browser-launched'))
    await delay(750)
    const ordinarySingleActor = await createActor(browser, baseURL)
    contexts.push(ordinarySingleActor.context)
    await waitForConnectivityCpuSample('single-a-ordinary-blank-idle')
    await waitForConnectivityCpuSample('single-a-ordinary-navigation', () =>
      ordinarySingleActor.page.goto(
        singleActorAppURL(`${fileId}-ordinary-single`)
      )
    )
    await waitForConnectivityCpuSample('single-a-ordinary-app-ready', () =>
      waitForAppReady(ordinarySingleActor.page)
    )
    await waitForConnectivityCpuSample(
      'single-a-ordinary-collaboration-ready',
      () => waitForCollaboration(ordinarySingleActor.page, 'Actor A')
    )
    await waitForConnectivityCpuSample('single-a-ordinary-idle')
    expect(getCapturedBrowserErrors(ordinarySingleActor.page)).toEqual([])
    await ordinarySingleActor.context.close()

    const profiledSingleActor = await createActor(browser, baseURL)
    contexts.push(profiledSingleActor.context)
    await waitForConnectivityCpuSample('single-a-profiled-blank-idle')
    await waitForConnectivityCpuSample('single-a-profiled-navigation', () =>
      profiledSingleActor.page.goto(
        profiledSingleActorAppURL(`${fileId}-profiled-single`)
      )
    )
    await waitForConnectivityCpuSample('single-a-profiled-app-ready', () =>
      waitForAppReady(profiledSingleActor.page)
    )
    await waitForConnectivityCpuSample(
      'single-a-profiled-collaboration-ready',
      () => waitForCollaboration(profiledSingleActor.page, 'Actor A')
    )
    await waitForConnectivityCpuSample('single-a-profiled-idle')
    expect(getCapturedBrowserErrors(profiledSingleActor.page)).toEqual([])
    await profiledSingleActor.context.close()

    const actorA = await createActor(browser, baseURL)
    contexts.push(actorA.context)
    await waitForConnectivityCpuSample('actor-a-blank-idle')
    await waitForConnectivityCpuSample('actor-a-navigation', () =>
      actorA.page.goto(collaborationURL(fileId))
    )
    await waitForConnectivityCpuSample('actor-a-app-ready', () =>
      waitForAppReady(actorA.page)
    )
    await waitForConnectivityCpuSample('actor-a-collaboration-ready', () =>
      waitForCollaboration(actorA.page, 'Actor A')
    )
    const actorB = await createActor(browser, baseURL)
    contexts.push(actorB.context)
    await waitForConnectivityCpuSample('actor-b-blank-idle')
    await waitForConnectivityCpuSample('actor-b-navigation', () =>
      actorB.page.goto(collaborationURL(fileId))
    )
    await waitForConnectivityCpuSample('actor-b-app-ready', () =>
      waitForAppReady(actorB.page)
    )
    await waitForConnectivityCpuSample('actor-b-collaboration-ready', () =>
      waitForCollaboration(actorB.page, 'Actor B')
    )
    await waitForConnectivityCpuSample('connected')
    expect(
      await Promise.all([
        actorA.page.evaluate(
          () => window.__AsyraCollaboration__?.getStatus() ?? 'missing'
        ),
        actorB.page.evaluate(
          () => window.__AsyraCollaboration__?.getStatus() ?? 'missing'
        )
      ])
    ).toEqual(['connected', 'connected'])
    expect(getCapturedBrowserErrors(actorA.page)).toEqual([])
    expect(getCapturedBrowserErrors(actorB.page)).toEqual([])
  } finally {
    await closeContexts(contexts)
  }
})

test('single-Actor local attribution', async ({ browser }, testInfo) => {
  test.skip(
    !endpointLocalAttribution,
    'The local attribution case runs only in its dedicated fresh invocation'
  )
  const baseURL = String(testInfo.project.use.baseURL ?? '')
  if (!baseURL) {
    throw new Error('Endpoint performance App URL is unavailable')
  }
  const requestedItems = endpointAttributionCase === '1280' ? 1280 : 16
  const expectedTotal = requestedItems + 1
  const fileId = `single-attribution-${endpointAttributionCase}-${Date.now()}`
  const prompt =
    requestedItems === 1280
      ? 'create the 1280-item CRDT performance fixture'
      : 'create the fast CRDT performance fixture'
  const actor = await createActor(browser, baseURL, {
    reducedMotion:
      endpointAttributionCase === '16-reduced-motion'
        ? 'reduce'
        : 'no-preference'
  })
  const heartbeat = createLocalAttributionHeartbeatController(
    actor.page,
    expectedTotal
  )
  const actorSession = await actor.context.newCDPSession(actor.page)
  const testStartedAtMs = Date.now()
  const startGuardPhase = async (phase: string): Promise<void> => {
    heartbeat.startPhase(phase)
    await postHeartbeat('progress', await heartbeat.sample())
    await postPhaseBoundary('start', phase)
  }
  const endGuardPhase = async (phase: string): Promise<void> => {
    await postPhaseBoundary('end', phase)
    heartbeat.completePhase(phase)
  }

  try {
    await waitForConnectivityCpuSample(
      'local-server-response-seed',
      () =>
        seedAsyraDesignServerResponse(actor.context, {
          appUrl: profiledSingleActorAppURL(fileId),
          fileId,
          itemCount: requestedItems
        }),
      'local-attribution'
    )
    await waitForConnectivityCpuSample(
      'local-app-and-collaboration-ready',
      async () => {
        await actor.page.goto(profiledSingleActorAppURL(fileId))
        await waitForAppReady(actor.page)
        await waitForCollaboration(actor.page, 'Actor A')
      },
      'local-attribution'
    )
    await installBoundedDiagnostics(actor.page)
    await openAgent(actor.page)
    await actorSession.send('Performance.enable', { timeDomain: 'threadTicks' })
    let preparedTurn: PreparedAiTurn | null = null
    await waitForConnectivityCpuSample(
      'local-request-prepared',
      async () => {
        preparedTurn = await prepareAiTurn(actor.page, prompt)
      },
      'local-attribution'
    )
    if (!preparedTurn) {
      throw new Error('Local attribution AI turn was not prepared')
    }
    await waitForGuardReady(
      createConnectivityHeartbeat('local-request-ready', 'local-attribution')
    )

    const initialHeartbeat = await heartbeat.sample()
    expect(initialHeartbeat.actorA.canonicalElements).toBe(0)
    expect(initialHeartbeat.actorA.renderProjectionElements).toBe(0)
    await postHeartbeat('progress', initialHeartbeat)

    const operationStart = await actorSession.send('Performance.getMetrics')
    const creationStartedAtMs = Date.now()
    heartbeat.markCreationStarted(creationStartedAtMs)
    heartbeat.begin()
    await startGuardPhase('local-request')
    await heartbeat.assertGuarded(triggerPreparedAiTurn(preparedTurn))
    const completed = await heartbeat.assertGuarded(
      heartbeat.waitForComplete(120_000)
    )
    const operationEnd = await actorSession.send('Performance.getMetrics')
    const mainThreadOperation = summarizeRendererPerformanceWindow(
      operationStart,
      operationEnd
    ) as RendererPerformanceWindow
    await endGuardPhase('local-request')
    await heartbeat.stop()
    await assertPreparedAiTurnSettled(preparedTurn)

    expect(completed.actorA.canonicalElements).toBe(expectedTotal)
    expect(completed.actorA.renderProjectionElements).toBe(expectedTotal)
    expect(completed.actorA.undoDepth - initialHeartbeat.actorA.undoDepth).toBe(
      1
    )
    expect(completed.publications.actorALocalSent).toBeGreaterThan(0)
    expect(completed.publications.actorBRemoteProcessed).toBe(0)
    expect(completed.publications.failed).toBe(0)
    expect(getCapturedBrowserErrors(actor.page)).toEqual([])

    const actorADiagnostics = await readFinalDiagnostics(actor.page)
    expect(actorADiagnostics.runtime).toBe('production')
    expect(actorADiagnostics.configuration).toEqual({
      contentsMode: 'omitted',
      deliveryMode: 'progressive'
    })
    expect(actorADiagnostics.localSentCount).toBe(
      completed.publications.actorALocalSent
    )
    expect(actorADiagnostics.remoteProcessedCount).toBe(0)
    expect(actorADiagnostics.persistencePhaseCount).toBe(0)
    expect(actorADiagnostics.renderProjectionAnomalies).toEqual({
      failed: 0,
      missing: 0,
      resynced: 0
    })
    const attributionPhaseNames = actorADiagnostics.phaseTimeline.map(
      ({ name }) => name
    )
    expect(attributionPhaseNames).toEqual(
      expect.arrayContaining([
        'ai-server-response-inbox:preload-file-response',
        'ai-provider:server-response-handoff',
        'ai-runtime:provider',
        'ai-runtime:resolution',
        'ai-runtime:permission',
        'ai-runtime:execution',
        'ai-app:create-composition-group',
        'ai-app:create-composition-batch'
      ])
    )
    expect(
      actorADiagnostics.phaseTimeline.every(
        ({ atMs }, index, timeline) =>
          index === 0 || atMs >= timeline[index - 1].atMs
      )
    ).toBe(true)
    expect(
      actorADiagnostics.counterTimeline.some(
        ({ name }) => name === 'ai-drawing:loading-frame-visible'
      )
    ).toBe(true)
    const finalHeartbeat = await heartbeat.sample()
    const report: EndpointReport = {
      actorA: {
        completeMs: finalHeartbeat.actorA.completeAtMs,
        diagnostics: actorADiagnostics,
        firstVisibleMs: finalHeartbeat.actorA.firstVisibleAtMs,
        summary: {
          mainThreadAverageTaskCorePercent:
            mainThreadOperation.averageTaskCorePercent,
          mainThreadLayoutDurationMs: mainThreadOperation.layoutDurationMs,
          mainThreadRecalcStyleDurationMs:
            mainThreadOperation.recalcStyleDurationMs,
          mainThreadScriptDurationMs: mainThreadOperation.scriptDurationMs,
          mainThreadTaskDurationMs: mainThreadOperation.taskDurationMs,
          renderedCount: finalHeartbeat.actorA.renderProjectionElements,
          requestedItems,
          totalCount: finalHeartbeat.actorA.canonicalElements,
          visibleWorkerTargetCount:
            actorADiagnostics.visibleWorkerTargets.length
        }
      },
      actorB: null,
      convergedMs: null,
      durationMs: Date.now() - testStartedAtMs,
      equivalenceProofMs: null,
      owner: endpointOwner,
      proofKind: 'local-attribution',
      status: 'complete'
    }
    await postHeartbeat('complete', {
      ...finalHeartbeat,
      report
    })
    // eslint-disable-next-line no-console
    console.log(`ASYRA_ENDPOINT_REPORT ${JSON.stringify(report)}`)
  } catch (error) {
    await heartbeat.stop()
    const latest =
      heartbeat.readLatest() ??
      createConnectivityHeartbeat(
        'local-attribution-failed',
        'local-attribution'
      )
    await postHeartbeat('failed', {
      ...latest,
      error:
        error instanceof Error
          ? {
              message: error.message.slice(0, 500),
              name: error.name
            }
          : String(error).slice(0, 500)
    }).catch(() => undefined)
    throw error
  } finally {
    await Promise.allSettled([actorSession.detach(), actor.context.close()])
  }
})

test('two-Actor 16-item operation and idle attribution', async ({
  browser
}, testInfo) => {
  test.skip(
    !endpointTwoActorActivityAttribution,
    'The two-Actor activity diagnostic runs only in its dedicated invocation'
  )
  const baseURL = String(testInfo.project.use.baseURL ?? '')
  if (!baseURL) {
    throw new Error('Endpoint performance App URL is unavailable')
  }
  const requestedItems = 16
  const expectedTotal = 17
  const fileId = `two-actor-activity-16-${Date.now()}`
  const { actorA, actorB, contexts } = await prepareEndpointActorsSequentially({
    baseURL,
    browser,
    fileId,
    serverResponseItemCount: 16,
    proofKind: 'collaboration-attribution'
  })
  const heartbeat = createHeartbeatController(
    actorA,
    actorB,
    expectedTotal,
    'collaboration-attribution'
  )
  const actorASession = await contexts[0].newCDPSession(actorA)
  const actorBSession = await contexts[1].newCDPSession(actorB)
  const startGuardPhase = async (phase: string): Promise<void> => {
    heartbeat.startPhase(phase)
    await postHeartbeat('progress', await heartbeat.sample())
    await postPhaseBoundary('start', phase)
  }
  const endGuardPhase = async (phase: string): Promise<void> => {
    await postPhaseBoundary('end', phase)
    heartbeat.completePhase(phase)
  }
  const testStartedAtMs = Date.now()
  let heartbeatStop: Promise<void> | null = null

  try {
    await Promise.all([
      installBoundedDiagnostics(actorA),
      installBoundedDiagnostics(actorB),
      actorASession.send('Performance.enable', { timeDomain: 'threadTicks' }),
      actorBSession.send('Performance.enable', { timeDomain: 'threadTicks' })
    ])
    await openAgent(actorA)
    let preparedTurn: PreparedAiTurn | null = null
    await waitForConnectivityCpuSample(
      'two-actor-request-prepared',
      async () => {
        preparedTurn = await prepareAiTurn(
          actorA,
          'create the fast CRDT performance fixture'
        )
      },
      'collaboration-attribution'
    )
    if (!preparedTurn) {
      throw new Error('Two-Actor AI turn was not prepared')
    }
    await waitForGuardReady(
      createConnectivityHeartbeat('request-ready', 'collaboration-attribution')
    )

    const initialHeartbeat = await heartbeat.sample()
    expect(initialHeartbeat.actorA.canonicalElements).toBe(0)
    expect(initialHeartbeat.actorB.canonicalElements).toBe(0)
    await postHeartbeat('progress', initialHeartbeat)

    const [actorAOperationStart, actorBOperationStart] = await Promise.all([
      actorASession.send('Performance.getMetrics'),
      actorBSession.send('Performance.getMetrics')
    ])
    const operationStartedAtMs = Date.now()
    heartbeat.markCreationStarted(operationStartedAtMs)
    heartbeat.begin()
    await startGuardPhase('operation')
    await heartbeat.assertGuarded(triggerPreparedAiTurn(preparedTurn))
    const completed = await heartbeat.assertGuarded(
      heartbeat.waitForBothComplete(120_000)
    )
    heartbeatStop = heartbeat.stop()
    const operationCompletedAtMs = Date.now()
    const [actorAOperationEnd, actorBOperationEnd] = await Promise.all([
      actorASession.send('Performance.getMetrics'),
      actorBSession.send('Performance.getMetrics')
    ])
    const actorAOperation = summarizeRendererPerformanceWindow(
      actorAOperationStart,
      actorAOperationEnd
    ) as RendererPerformanceWindow
    const actorBOperation = summarizeRendererPerformanceWindow(
      actorBOperationStart,
      actorBOperationEnd
    ) as RendererPerformanceWindow
    await endGuardPhase('operation')

    heartbeat.startPhase('post-completion-idle')
    await postHeartbeat('progress', {
      ...completed,
      activePhase: 'post-completion-idle',
      capturedAtMs: Date.now(),
      phase: 'operation'
    })
    const [actorAIdleStart, actorBIdleStart] = await Promise.all([
      actorASession.send('Performance.getMetrics'),
      actorBSession.send('Performance.getMetrics')
    ])
    const idleStartedAtMs = Date.now()
    await Promise.all([
      delay(10_000),
      delay(5_000).then(() =>
        postHeartbeat('progress', {
          ...completed,
          activePhase: 'post-completion-idle',
          capturedAtMs: Date.now(),
          phase: 'operation'
        })
      )
    ])
    const [actorAIdleEnd, actorBIdleEnd] = await Promise.all([
      actorASession.send('Performance.getMetrics'),
      actorBSession.send('Performance.getMetrics')
    ])
    const idleCompletedAtMs = Date.now()
    const actorAIdle = summarizeRendererPerformanceWindow(
      actorAIdleStart,
      actorAIdleEnd
    ) as RendererPerformanceWindow
    const actorBIdle = summarizeRendererPerformanceWindow(
      actorBIdleStart,
      actorBIdleEnd
    ) as RendererPerformanceWindow
    heartbeat.completePhase('post-completion-idle')
    await heartbeatStop
    await assertPreparedAiTurnSettled(preparedTurn)

    expect(completed.actorA.canonicalElements).toBe(expectedTotal)
    expect(completed.actorA.renderProjectionElements).toBe(expectedTotal)
    expect(completed.actorB.canonicalElements).toBe(expectedTotal)
    expect(completed.actorB.renderProjectionElements).toBe(expectedTotal)
    expect(completed.publications.actorALocalSent).toBeGreaterThan(0)
    expect(completed.publications.actorALocalSent).toBe(
      completed.publications.actorBRemoteProcessed
    )
    expect(completed.publications.actorBLocalSent).toBe(0)
    expect(completed.publications.failed).toBe(0)

    const [actorADiagnostics, actorBDiagnostics] = await Promise.all([
      readFinalDiagnostics(actorA),
      readFinalDiagnostics(actorB)
    ])
    expect(
      actorADiagnostics.historyDepth - initialHeartbeat.actorA.undoDepth
    ).toBe(1)
    expect(
      actorBDiagnostics.historyDepth - initialHeartbeat.actorB.undoDepth
    ).toBe(0)
    expect(actorADiagnostics.persistencePhaseCount).toBe(0)
    expect(actorBDiagnostics.persistencePhaseCount).toBe(0)
    expect(actorBDiagnostics.localSentCount).toBe(0)
    expect(actorBDiagnostics.remoteProcessedCount).toBe(
      actorADiagnostics.localSentCount
    )
    expect(getCapturedBrowserErrors(actorA)).toEqual([])
    expect(getCapturedBrowserErrors(actorB)).toEqual([])

    const toActivitySummary = (
      operation: RendererPerformanceWindow,
      idle: RendererPerformanceWindow,
      workerTargetCount: number
    ): TwoActorActivitySummary => ({
      idleAverageTaskCorePercent: idle.averageTaskCorePercent,
      idleHeapUsedEndBytes: idle.heapUsedEndBytes,
      idleHeapUsedStartBytes: idle.heapUsedStartBytes,
      idleLayoutDurationMs: idle.layoutDurationMs,
      idleRecalcStyleDurationMs: idle.recalcStyleDurationMs,
      idleScriptDurationMs: idle.scriptDurationMs,
      idleTaskDurationMs: idle.taskDurationMs,
      mainThreadAverageTaskCorePercent: operation.averageTaskCorePercent,
      mainThreadLayoutDurationMs: operation.layoutDurationMs,
      mainThreadRecalcStyleDurationMs: operation.recalcStyleDurationMs,
      mainThreadScriptDurationMs: operation.scriptDurationMs,
      mainThreadTaskDurationMs: operation.taskDurationMs,
      operationAverageTaskCorePercent: operation.averageTaskCorePercent,
      operationHeapUsedEndBytes: operation.heapUsedEndBytes,
      operationHeapUsedStartBytes: operation.heapUsedStartBytes,
      operationLayoutDurationMs: operation.layoutDurationMs,
      operationRecalcStyleDurationMs: operation.recalcStyleDurationMs,
      operationScriptDurationMs: operation.scriptDurationMs,
      operationTaskDurationMs: operation.taskDurationMs,
      renderedCount: expectedTotal,
      requestedItems,
      totalCount: expectedTotal,
      visibleWorkerTargetCount: workerTargetCount
    })
    const finalHeartbeat: EndpointHeartbeat = {
      ...completed,
      activePhase: null,
      capturedAtMs: Date.now(),
      phase: 'post-completion-idle'
    }
    const report: EndpointReport = {
      actorA: {
        completeMs: finalHeartbeat.actorA.completeAtMs,
        diagnostics: actorADiagnostics,
        firstVisibleMs: finalHeartbeat.actorA.firstVisibleAtMs,
        summary: toActivitySummary(
          actorAOperation,
          actorAIdle,
          actorADiagnostics.visibleWorkerTargets.length
        )
      },
      actorB: {
        completeMs: finalHeartbeat.actorB.completeAtMs,
        diagnostics: actorBDiagnostics,
        firstVisibleMs: finalHeartbeat.actorB.firstVisibleAtMs,
        summary: toActivitySummary(
          actorBOperation,
          actorBIdle,
          actorBDiagnostics.visibleWorkerTargets.length
        )
      },
      convergedMs: finalHeartbeat.actorB.completeAtMs,
      durationMs: Date.now() - testStartedAtMs,
      equivalenceProofMs: null,
      idleCompletedAtMs,
      idleDurationMs: idleCompletedAtMs - idleStartedAtMs,
      idleStartedAtMs,
      operationCompletedAtMs,
      operationDurationMs: operationCompletedAtMs - operationStartedAtMs,
      operationStartedAtMs,
      owner: endpointOwner,
      proofKind: 'collaboration-attribution',
      status: 'complete'
    }
    await postHeartbeat('complete', {
      ...finalHeartbeat,
      report
    })
    // eslint-disable-next-line no-console
    console.log(`ASYRA_ENDPOINT_REPORT ${JSON.stringify(report)}`)
  } catch (error) {
    await (heartbeatStop ?? heartbeat.stop())
    const latest =
      heartbeat.readLatest() ??
      createConnectivityHeartbeat(
        'two-actor-activity-failed',
        'collaboration-attribution'
      )
    await postHeartbeat('failed', {
      ...latest,
      error:
        error instanceof Error
          ? {
              message: error.message.slice(0, 500),
              name: error.name
            }
          : String(error).slice(0, 500)
    }).catch(() => undefined)
    throw error
  } finally {
    await Promise.allSettled([
      actorASession.detach(),
      actorBSession.detach(),
      closeContexts(contexts)
    ])
  }
})

test('creation-only high-detail endpoint proof', async ({
  browser
}, testInfo) => {
  test.skip(
    endpointConnectivityOnly || endpointLocalAttribution,
    'The focused connectivity case must never create the high-detail fixture'
  )
  const baseURL = String(testInfo.project.use.baseURL ?? '')
  if (!baseURL) {
    throw new Error('Endpoint performance App URL is unavailable')
  }
  const fileId = `endpoint-${endpointOwner}-${Date.now()}`
  const { actorA, actorB, contexts } = await prepareEndpointActorsSequentially({
    baseURL,
    browser,
    fileId,
    serverResponseItemCount: 7075
  })
  const heartbeat = createHeartbeatController(actorA, actorB)
  const testStartedAtMs = Date.now()
  let report: EndpointReport | null = null

  try {
    await waitForConnectivityCpuSample('actor-a-diagnostics-ready', () =>
      installBoundedDiagnostics(actorA)
    )
    await waitForConnectivityCpuSample('actor-b-diagnostics-ready', () =>
      installBoundedDiagnostics(actorB)
    )
    await waitForConnectivityCpuSample('reference-ready', () =>
      openAgentAndAttachReference(actorA)
    )
    let preparedTurn: PreparedAiTurn | null = null
    await waitForConnectivityCpuSample('request-prepared', async () => {
      preparedTurn = await prepareAiTurn(actorA, exactCatOnlyPrompt)
    })
    if (!preparedTurn) {
      throw new Error('High-detail AI turn was not prepared')
    }
    await waitForGuardReady(createConnectivityHeartbeat('request-ready'))

    const initialHeartbeat = await heartbeat.sample()
    await postHeartbeat('progress', initialHeartbeat)

    heartbeat.startPhase('creation')
    await postHeartbeat('progress', await heartbeat.sample())
    const creationStartedAtMs = Date.now()
    heartbeat.markCreationStarted(creationStartedAtMs)
    heartbeat.begin()
    await heartbeat.assertGuarded(triggerPreparedAiTurn(preparedTurn))
    await heartbeat.assertGuarded(heartbeat.waitForActorAComplete(120_000))
    heartbeat.completePhase('creation')
    await assertPreparedAiTurnSettled(preparedTurn)
    heartbeat.startPhase('peer-convergence')
    await postHeartbeat('progress', await heartbeat.sample())
    const completed = await heartbeat.assertGuarded(
      heartbeat.waitForBothComplete(120_000)
    )
    const convergedMs = completed.actorB.completeAtMs
    if (convergedMs === null) {
      throw new Error('Actor B completion timing is unavailable')
    }
    heartbeat.completePhase('peer-convergence')
    const equivalenceProofStartedAtMs = Date.now()

    heartbeat.startPhase('canonical-summary-a')
    const actorASummary = await heartbeat.assertGuarded(
      readCanonicalSummary(actorA)
    )
    heartbeat.completePhase('canonical-summary-a')
    heartbeat.startPhase('canonical-summary-b')
    const actorBSummary = await heartbeat.assertGuarded(
      readCanonicalSummary(actorB)
    )
    heartbeat.completePhase('canonical-summary-b')
    const equivalenceProofMs = Date.now() - equivalenceProofStartedAtMs

    expect(actorASummary).toMatchObject({
      groupCount: expectedFixture.groupCount,
      groupChildCount: expectedFixture.vectorCount,
      hierarchyOrderMatches: true,
      renderedCount: expectedFixture.totalCount,
      totalCount: expectedFixture.totalCount,
      vectorCount: expectedFixture.vectorCount,
      vectorsInGroupCount: expectedFixture.vectorCount
    })
    expect(actorASummary.pointCount).toBeGreaterThanOrEqual(115_000)
    expect(actorASummary.whiteBackgrounds).toHaveLength(1)
    expect(actorASummary.whiteBackgrounds[0]).toMatchObject({
      height: 941,
      width: 1672
    })
    expect(actorBSummary).toEqual(actorASummary)

    heartbeat.startPhase('final-diagnostics')
    const [actorADiagnostics, actorBDiagnostics] =
      await heartbeat.assertGuarded(
        Promise.all([
          readFinalDiagnostics(actorA),
          readFinalDiagnostics(actorB)
        ])
      )
    const initialAUndoDepth = initialHeartbeat.actorA.undoDepth
    const initialBUndoDepth = initialHeartbeat.actorB.undoDepth
    expect(actorADiagnostics.runtime).toBe('production')
    expect(actorBDiagnostics.runtime).toBe('production')
    expect(actorADiagnostics.configuration).toEqual({
      contentsMode: 'omitted',
      deliveryMode: 'progressive'
    })
    expect(actorBDiagnostics.configuration).toEqual({
      contentsMode: 'omitted',
      deliveryMode: 'progressive'
    })
    expect(actorADiagnostics.historyDepth - initialAUndoDepth).toBe(1)
    expect(actorADiagnostics.localSentCount).toBeGreaterThan(0)
    expect(actorADiagnostics.factoryPublicationCount).toBe(
      actorADiagnostics.localSentCount
    )
    expect(actorADiagnostics.remoteProcessedCount).toBe(0)
    expect(actorADiagnostics.persistencePhaseCount).toBe(0)
    expect(actorADiagnostics.renderProjectionAnomalies).toEqual({
      failed: 0,
      missing: 0,
      resynced: 0
    })
    expect(actorBDiagnostics.historyDepth - initialBUndoDepth).toBe(0)
    expect(actorBDiagnostics.factoryPublicationCount).toBe(0)
    expect(actorBDiagnostics.localSentCount).toBe(0)
    expect(actorBDiagnostics.persistencePhaseCount).toBe(0)
    expect(actorBDiagnostics.remoteProcessedCount).toBe(
      actorADiagnostics.localSentCount
    )
    expect(actorBDiagnostics.renderProjectionAnomalies).toEqual({
      failed: 0,
      missing: 0,
      resynced: 0
    })
    expect(completed.publications.failed).toBe(0)
    expect(completed.publications.actorALocalSent).toBe(
      completed.publications.actorBRemoteProcessed
    )
    heartbeat.completePhase('final-diagnostics')

    report = {
      actorA: {
        completeMs: completed.actorA.completeAtMs,
        diagnostics: actorADiagnostics,
        firstVisibleMs: completed.actorA.firstVisibleAtMs,
        summary: actorASummary
      },
      actorB: {
        completeMs: completed.actorB.completeAtMs,
        diagnostics: actorBDiagnostics,
        firstVisibleMs: completed.actorB.firstVisibleAtMs,
        summary: actorBSummary
      },
      convergedMs,
      durationMs: Date.now() - testStartedAtMs,
      equivalenceProofMs,
      owner: endpointOwner,
      proofKind: 'endpoint',
      status: 'complete'
    }
    await heartbeat.stop()
    const finalHeartbeat = await heartbeat.sample()
    expect(finalHeartbeat.actorA.complete).toBe(true)
    expect(finalHeartbeat.actorB.complete).toBe(true)
    await postHeartbeat('complete', {
      ...finalHeartbeat,
      report
    })
    // eslint-disable-next-line no-console
    console.log(`ASYRA_ENDPOINT_REPORT ${JSON.stringify(report)}`)
  } catch (error) {
    await heartbeat.stop()
    const latest = heartbeat.readLatest() ?? {
      activePhase: null,
      actorA: {
        canonicalElements: 0,
        complete: false,
        completeAtMs: null,
        elements: 0,
        firstVisibleAtMs: null,
        renderProjectionElements: 0,
        total: expectedFixture.totalCount,
        undoDepth: 0
      },
      actorB: {
        canonicalElements: 0,
        complete: false,
        completeAtMs: null,
        elements: 0,
        firstVisibleAtMs: null,
        renderProjectionElements: 0,
        total: expectedFixture.totalCount,
        undoDepth: 0
      },
      capturedAtMs: Date.now(),
      elapsedMs: null,
      owner: endpointOwner,
      ownerTiming: {
        actorADurationMs: 0,
        actorAPhase: 'unavailable',
        actorBDurationMs: 0,
        actorBPhase: 'unavailable'
      },
      phase: 'failed',
      proofKind: 'endpoint',
      publications: {
        actorAFactory: 0,
        actorALocalSent: 0,
        actorBFactory: 0,
        actorBLocalSent: 0,
        actorBRemoteProcessed: 0,
        failed: 0
      }
    }
    await postHeartbeat('failed', {
      ...latest,
      error:
        error instanceof Error
          ? {
              message: error.message.slice(0, 500),
              name: error.name
            }
          : String(error).slice(0, 500)
    }).catch(() => undefined)
    // eslint-disable-next-line no-console
    console.log(
      `ASYRA_ENDPOINT_REPORT ${JSON.stringify({
        error:
          error instanceof Error
            ? {
                message: error.message.slice(0, 500),
                name: error.name
              }
            : String(error).slice(0, 500),
        heartbeat: latest,
        owner: endpointOwner,
        status: 'failed'
      })}`
    )
    throw error
  } finally {
    await closeContexts(contexts)
  }

  expect(report).not.toBeNull()
})

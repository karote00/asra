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
  seedPreparedAsyraDesignServerResponse,
  type AsyraDesignServerResponseItemCount,
  type PreparedAsyraDesignServerResponseSeedMetrics
} from './server-response-inbox'
import { getPreparedServerResponseVariant } from './prepared-server-response-artifacts.mjs'

const expectedFixture = Object.freeze({
  groupCount: 1,
  totalCount: 7076,
  vectorCount: 7075
})
const CRDT_FLOW_TIMEOUT_MS = 180_000
const remainingCrdtFlowTimeoutMs = (startedAtMs: number): number =>
  Math.max(1, startedAtMs + CRDT_FLOW_TIMEOUT_MS - Date.now())
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

type EndpointAiTurnOutcome =
  | 'cancelled'
  | 'failed'
  | 'no-change'
  | 'partial'
  | 'success'

interface EndpointTurnSettlementEvidence {
  readonly code: string | null
  readonly message: string | null
  readonly outcome: EndpointAiTurnOutcome
  readonly stage: string | null
  readonly status: string | null
}

interface EndpointFactoryTransactionStatusEvidence {
  readonly error?:
    | string
    | {
        readonly message: string
        readonly name: string
      }
  readonly failure?: {
    readonly cause?:
      | string
      | {
          readonly message: string
          readonly name: string
        }
    readonly kind: string
    readonly message?: string
  }
  readonly status: string
  readonly transactionId: number
}

interface PreparedLocalInteractionProbe {
  readonly canvasCenter: {
    readonly x: number
    readonly y: number
  }
  readonly initial: LocalInteractionProbeSnapshot
  readonly rectangleCenter: {
    readonly x: number
    readonly y: number
  }
  readonly selectCenter: {
    readonly x: number
    readonly y: number
  }
}

interface LocalDocumentEventCounts {
  readonly deleteKey: number
  readonly historyShortcut: number
  readonly rectangleButton: number
  readonly rectangleShortcut: number
}

interface LocalInteractionProbeSnapshot {
  readonly canonicalElements: number
  readonly documentEventAttempts: LocalDocumentEventCounts
  readonly documentEventDeliveries: LocalDocumentEventCounts
  readonly documentEventPreventions: LocalDocumentEventCounts
  readonly keyboardTargetActive: boolean
  readonly loadingAtZero: {
    readonly canonicalElements: number
    readonly connected: boolean
    readonly phase: string | null
    readonly rect: {
      readonly height: number
      readonly width: number
      readonly x: number
      readonly y: number
    }
    readonly sourceBounds: {
      readonly height: number
      readonly width: number
      readonly x: number
      readonly y: number
    }
  } | null
  readonly latestFactoryTransactionStatus: EndpointFactoryTransactionStatusEvidence | null
  readonly loadingConnected: boolean
  readonly rectangleActive: boolean
  readonly requestSubmissionClickCount: number
  readonly turnAccepted: boolean
  readonly turnOutcome: EndpointAiTurnOutcome | null
  readonly turnSettlement: EndpointTurnSettlementEvidence | null
  readonly viewport: {
    readonly x: number
    readonly y: number
  }
  readonly zoom: number
}

type LocalInteractionProbeTarget =
  | 'interaction-frame'
  | 'loading-at-zero'
  | 'loading-removed'
  | 'pan-changed'
  | 'rectangle-active'
  | 'zoom-changed'

interface LocalNavigationBaseline {
  readonly viewport: LocalInteractionProbeSnapshot['viewport']
  readonly zoom: number
}

interface LocalInteractionProbe {
  focusKeyboardTarget(): LocalInteractionProbeSnapshot
  read(): LocalInteractionProbeSnapshot
  waitFor(
    target: LocalInteractionProbeTarget,
    timeoutMs: number,
    baseline?: LocalNavigationBaseline
  ): Promise<LocalInteractionProbeSnapshot>
}

interface LocalInteractionEvidence {
  readonly blockedActionAttempts: {
    readonly deleteKeyBlocked: boolean
    readonly documentEventAttempts: LocalDocumentEventCounts
    readonly documentEventDeliveries: LocalInteractionProbeSnapshot['documentEventDeliveries']
    readonly documentEventPreventions: LocalDocumentEventCounts
    readonly historyShortcutBlocked: boolean
    readonly rectangleButtonBlocked: boolean
    readonly rectangleShortcutBlocked: boolean
    readonly rectangleToolRemainedInactive: boolean
  }
  readonly completion: {
    readonly canonicalElements: number
    readonly historyActionCount: number
    readonly loadingRemoved: boolean
    readonly ordinaryKeyboardToolSwitchAccepted: boolean
    readonly ordinaryToolSwitchAccepted: boolean
  }
  readonly loadingAtZero: NonNullable<
    LocalInteractionProbeSnapshot['loadingAtZero']
  >
  readonly pan: {
    readonly after: LocalInteractionProbeSnapshot['viewport']
    readonly before: LocalInteractionProbeSnapshot['viewport']
  }
  readonly progress: {
    readonly cooperativeYieldCount: number
    readonly longestCanonicalWorkUnitMs: number
    readonly milestones: readonly {
      readonly atMs: number
      readonly completedElements: number
      readonly sampleIndex: number
      readonly targetElements: number
    }[]
  }
  readonly zoom: {
    readonly after: number
    readonly before: number
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
  readonly drawingProgress: {
    readonly canonicalWorkUnitCount: number
    readonly cooperativeYieldCount: number
    readonly cooperativeYieldSampleCount: number
    readonly loadingFrameVisibleCount: number
    readonly longestCanonicalWorkUnitMs: number
    readonly milestones: readonly {
      readonly atMs: number
      readonly completedElements: number
      readonly sampleIndex: number
      readonly targetElements: number
    }[]
    readonly strictlyIncreasing: boolean
    readonly visibleElementLastCount: number
    readonly visibleElementSampleCount: number
  }
  readonly factoryPublicationCount: number
  readonly historyDepth: number
  readonly localSentCount: number
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
  readonly localInteraction?: LocalInteractionEvidence
  readonly owner: string
  readonly proofKind:
    | 'endpoint'
    | 'local-attribution'
    | 'collaboration-attribution'
  readonly serverResponseSeed?: PreparedAsyraDesignServerResponseSeedMetrics
  readonly status: 'complete'
}

interface EndpointHeartbeatFailure {
  readonly message: string
  readonly name: string
}

type EndpointHeartbeatEnvelope = EndpointHeartbeat & {
  readonly browserErrors?: {
    readonly actorA: readonly string[]
    readonly actorB: readonly string[]
  }
  readonly error?: EndpointHeartbeatFailure | string
  readonly failureTimeEvidence?: LocalInteractionProbeSnapshot | null
  readonly report?: EndpointReport
}

const postHeartbeat = async (
  kind: 'ready' | 'progress' | 'complete' | 'failed',
  heartbeat: EndpointHeartbeatEnvelope
): Promise<{ accepted?: boolean; reason?: string }> => {
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
  const result = (await response.json().catch(() => ({}))) as {
    accepted?: boolean
    reason?: string
  }
  if (!response.ok || result.accepted !== true) {
    throw new Error(
      `Endpoint performance resource guard rejected ${kind} heartbeat: ${
        result.reason ?? response.status
      }`
    )
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
  `/?fileId=${encodeURIComponent(fileId)}&aiPerformance=profile`

const singleActorAppURL = (fileId: string) =>
  `/?fileId=${encodeURIComponent(fileId)}`
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
  latestFactoryTransactionStatus: EndpointFactoryTransactionStatusEvidence | null
  latestTurnSettlement: EndpointTurnSettlementEvidence | null
  localSent: number
  nonSuccessfulTurnCount: number
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
      latestFactoryTransactionStatus:
        profile.readLatestFactoryTransactionStatus(),
      latestOwnerTiming: profile.readLatestPhaseSample(),
      latestTurnSettlement: profile.readLatestTurnSettlement(),
      localSent: diagnostics.localSent,
      nonSuccessfulTurnCount:
        profile.readCounterTotal('ai-turn:outcome:cancelled') +
        profile.readCounterTotal('ai-turn:outcome:failed') +
        profile.readCounterTotal('ai-turn:outcome:no-change') +
        profile.readCounterTotal('ai-turn:outcome:partial'),
      remoteProcessed: diagnostics.remoteProcessed,
      renderProjectionElements: profile.readRenderProjectionElementCount(),
      successfulTurnCount: profile.readCounterTotal('ai-turn:outcome:success')
    }
  })

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs))

const FAILURE_EVIDENCE_UNAVAILABLE = Object.freeze({
  status: 'unavailable' as const
})

const settleFailureEvidenceWithin = <T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<
  | { readonly status: 'available'; readonly value: T }
  | typeof FAILURE_EVIDENCE_UNAVAILABLE
> =>
  Promise.race([
    operation
      .then((value) => ({ status: 'available' as const, value }))
      .catch(() => FAILURE_EVIDENCE_UNAVAILABLE),
    delay(timeoutMs).then(() => FAILURE_EVIDENCE_UNAVAILABLE)
  ])

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
    if (actorASample.nonSuccessfulTurnCount > 0) {
      throw new Error(
        `Actor A AI turn settled without success: ${JSON.stringify({
          factoryTransaction: actorASample.latestFactoryTransactionStatus,
          turn: actorASample.latestTurnSettlement
        })}`
      )
    }
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
    if (actorASample.nonSuccessfulTurnCount > 0) {
      throw new Error(
        `Actor A AI turn settled without success: ${JSON.stringify({
          factoryTransaction: actorASample.latestFactoryTransactionStatus,
          turn: actorASample.latestTurnSettlement
        })}`
      )
    }
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
  page: Page,
  expectedDrawingElements: number | null = null
): Promise<FinalActorDiagnostics> => {
  const diagnostics = await page.evaluate((expectedElements) => {
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
    const endpointDiagnostics = scope.__AsyraEndpointDiagnostics__
    if (!endpointDiagnostics) {
      throw new Error('Endpoint performance diagnostics are unavailable')
    }
    const snapshot = profile.snapshot()
    const phaseTotals = new Map<string, number>()
    const firstPhaseByName = new Map<
      string,
      { atMs: number; durationMs: number; name: string }
    >()
    const canonicalWorkUnitDurations: number[] = []
    for (const phase of snapshot.phases) {
      phaseTotals.set(
        phase.name,
        (phaseTotals.get(phase.name) ?? 0) + phase.durationMs
      )
      if (
        /^(?:ai-app|ai-provider|ai-runtime|ai-server-response-inbox|ai-turn):/u.test(
          phase.name
        ) &&
        !firstPhaseByName.has(phase.name)
      ) {
        firstPhaseByName.set(phase.name, {
          atMs: Math.round(phase.atMs * 1000) / 1000,
          durationMs: Math.round(phase.durationMs * 1000) / 1000,
          name: phase.name
        })
      }
      if (phase.name === 'ai-app:create-composition-batch') {
        canonicalWorkUnitDurations.push(phase.durationMs)
      }
    }
    const drawingCounters = snapshot.counters.filter(({ name }) =>
      name.startsWith('ai-drawing:')
    )
    const visibleElementSamples = drawingCounters.filter(
      ({ name }) => name === 'ai-drawing:visible-element-count'
    )
    const targetElements =
      expectedElements === null
        ? []
        : [
            1,
            Math.ceil(expectedElements * 0.25),
            Math.ceil(expectedElements * 0.5),
            Math.ceil(expectedElements * 0.75),
            expectedElements
          ]
    let minimumSampleIndex = 0
    const milestones = targetElements.flatMap((target) => {
      const relativeIndex = visibleElementSamples
        .slice(minimumSampleIndex)
        .findIndex(({ value }) => value >= target)
      if (relativeIndex < 0) return []
      const sampleIndex = minimumSampleIndex + relativeIndex
      const sample = visibleElementSamples[sampleIndex]
      minimumSampleIndex = sampleIndex + 1
      return sample
        ? [
            {
              atMs: Math.round(sample.atMs * 1000) / 1000,
              completedElements: sample.value,
              sampleIndex,
              targetElements: target
            }
          ]
        : []
    })
    const cooperativeYieldSamples = drawingCounters.filter(
      ({ name }) => name === 'ai-drawing:cooperative-yield-count'
    )
    const persistencePhaseCount = snapshot.phases.filter(
      ({ name }) =>
        name === 'core:persistence-capture' ||
        name === 'core:persistence-save' ||
        name === 'persistence:indexeddb-put'
    ).length
    return {
      drawingProgress: {
        canonicalWorkUnitCount: canonicalWorkUnitDurations.length,
        cooperativeYieldCount: cooperativeYieldSamples.at(-1)?.value ?? 0,
        cooperativeYieldSampleCount: cooperativeYieldSamples.length,
        loadingFrameVisibleCount: drawingCounters.filter(
          ({ name }) => name === 'ai-drawing:loading-frame-visible'
        ).length,
        longestCanonicalWorkUnitMs:
          canonicalWorkUnitDurations.length === 0
            ? 0
            : Math.max(...canonicalWorkUnitDurations),
        milestones,
        strictlyIncreasing: visibleElementSamples.every(
          ({ value }, index) =>
            index === 0 ||
            value > (visibleElementSamples[index - 1]?.value ?? -1)
        ),
        visibleElementLastCount: visibleElementSamples.at(-1)?.value ?? 0,
        visibleElementSampleCount: visibleElementSamples.length
      },
      factoryPublicationCount: profile.readFactoryPublicationCount(),
      historyDepth: profile.readHistoryDepth(),
      localSentCount: endpointDiagnostics.localSent,
      phaseTimeline: [...firstPhaseByName.values()],
      persistencePhaseCount,
      remoteProcessedCount: endpointDiagnostics.remoteProcessed,
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
  }, expectedDrawingElements)
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

const installLocalInteractionProbe = async (
  page: Page
): Promise<PreparedLocalInteractionProbe> => {
  const canvasHost = page.getByTestId('asyra-canvas-host')
  const rectangleTool = page.getByTestId('tool-rectangle')
  const selectTool = page.getByTestId('tool-select')
  await expect(canvasHost).toBeVisible()
  await expect(rectangleTool).toBeVisible()
  await expect(selectTool).toHaveAttribute('data-active', 'true')
  const [canvasBounds, rectangleBounds, selectBounds] = await Promise.all([
    canvasHost.boundingBox(),
    rectangleTool.boundingBox(),
    selectTool.boundingBox()
  ])
  if (!canvasBounds || !rectangleBounds || !selectBounds) {
    throw new Error('Local interaction control bounds are unavailable')
  }

  const initial = await page.evaluate(() => {
    const scope = globalThis as typeof globalThis & {
      __AsyraEndpointLocalInteractionProbe__?: LocalInteractionProbe
    }
    if (scope.__AsyraEndpointLocalInteractionProbe__) {
      throw new Error('Local interaction probe is already installed')
    }
    const profile = window.__AsyraAiDrawingPerformance__
    if (!profile) {
      throw new Error('Local interaction probe owners are unavailable')
    }

    const initialViewport = profile.readViewportPosition()
    const initialZoom = profile.readZoom()
    const documentEventAttempts = {
      deleteKey: 0,
      historyShortcut: 0,
      rectangleButton: 0,
      rectangleShortcut: 0
    }
    const documentEventDeliveries = {
      deleteKey: 0,
      historyShortcut: 0,
      rectangleButton: 0,
      rectangleShortcut: 0
    }
    const documentEventPreventions = {
      deleteKey: 0,
      historyShortcut: 0,
      rectangleButton: 0,
      rectangleShortcut: 0
    }
    let requestSubmissionClickCount = 0
    type DocumentActionName = keyof LocalDocumentEventCounts
    const recordAttempt = (action: DocumentActionName, event: Event): void => {
      documentEventAttempts[action] += 1
      queueMicrotask(() => {
        if (event.defaultPrevented) {
          documentEventPreventions[action] += 1
        }
      })
    }
    const rectangleControl = document.querySelector<HTMLElement>(
      '[data-testid="tool-rectangle"]'
    )
    const preparedSend = document.querySelector<HTMLElement>(
      '[data-endpoint-prepared-ai-submit="true"]'
    )
    if (!rectangleControl || !preparedSend) {
      throw new Error('Local interaction controls are unavailable')
    }
    preparedSend.addEventListener(
      'click',
      () => {
        requestSubmissionClickCount += 1
      },
      { capture: true, once: true }
    )
    rectangleControl.addEventListener('click', () => {
      documentEventDeliveries.rectangleButton += 1
    })
    window.addEventListener(
      'click',
      (event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-testid="tool-rectangle"]')
        ) {
          recordAttempt('rectangleButton', event)
        }
      },
      { capture: true }
    )
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Delete') {
          recordAttempt('deleteKey', event)
        } else if (event.metaKey && event.key.toLowerCase() === 'z') {
          recordAttempt('historyShortcut', event)
        } else if (!event.metaKey && event.key.toLowerCase() === 'r') {
          recordAttempt('rectangleShortcut', event)
        }
      },
      { capture: true }
    )
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Delete') {
        documentEventDeliveries.deleteKey += 1
      } else if (event.metaKey && event.key.toLowerCase() === 'z') {
        documentEventDeliveries.historyShortcut += 1
      } else if (!event.metaKey && event.key.toLowerCase() === 'r') {
        documentEventDeliveries.rectangleShortcut += 1
      }
    })
    const acceptedTurnBaseline = profile.readCounterTotal('ai-turn:accepted')
    const turnOutcomeBaselines: Record<EndpointAiTurnOutcome, number> = {
      cancelled: profile.readCounterTotal('ai-turn:outcome:cancelled'),
      failed: profile.readCounterTotal('ai-turn:outcome:failed'),
      'no-change': profile.readCounterTotal('ai-turn:outcome:no-change'),
      partial: profile.readCounterTotal('ai-turn:outcome:partial'),
      success: profile.readCounterTotal('ai-turn:outcome:success')
    }
    const turnOutcomes: readonly EndpointAiTurnOutcome[] = [
      'cancelled',
      'failed',
      'no-change',
      'partial',
      'success'
    ]
    let loadingAtZero: LocalInteractionProbeSnapshot['loadingAtZero'] = null
    let stableLoadingFrameCount = 0

    const read = (): LocalInteractionProbeSnapshot => {
      const indicator = document.querySelector<HTMLElement>(
        '[data-testid="ai-drawing-progress-indicator"]'
      )
      const canonicalElements = profile.readCanonicalElementCount()
      const turnOutcome =
        turnOutcomes.find(
          (outcome) =>
            profile.readCounterTotal(`ai-turn:outcome:${outcome}`) >
            turnOutcomeBaselines[outcome]
        ) ?? null
      const turnAccepted =
        profile.readCounterTotal('ai-turn:accepted') > acceptedTurnBaseline
      const latestFactoryTransactionStatus =
        profile.readLatestFactoryTransactionStatus()
      const turnSettlement = profile.readLatestTurnSettlement()
      if (
        indicator?.isConnected &&
        canonicalElements === 0 &&
        turnAccepted &&
        turnOutcome === null &&
        !loadingAtZero
      ) {
        const rect = indicator.getBoundingClientRect()
        const viewport = profile.readViewportPosition()
        const zoom = profile.readZoom()
        const projectedLeft = Number.parseFloat(indicator.style.left)
        const projectedTop = Number.parseFloat(indicator.style.top)
        const projectedWidth = Number.parseFloat(indicator.style.width)
        const projectedHeight = Number.parseFloat(indicator.style.height)
        loadingAtZero = {
          canonicalElements,
          connected: true,
          phase: indicator.getAttribute('data-phase'),
          rect: {
            height: rect.height,
            width: rect.width,
            x: rect.x,
            y: rect.y
          },
          sourceBounds: {
            height: projectedHeight / zoom,
            width: projectedWidth / zoom,
            x: (projectedLeft - viewport.x) / zoom,
            y: (projectedTop - viewport.y) / zoom
          }
        }
      }
      return {
        canonicalElements,
        documentEventAttempts: { ...documentEventAttempts },
        documentEventDeliveries: { ...documentEventDeliveries },
        documentEventPreventions: { ...documentEventPreventions },
        keyboardTargetActive: document.activeElement === probeRoot,
        latestFactoryTransactionStatus,
        loadingAtZero,
        loadingConnected: indicator?.isConnected === true,
        rectangleActive:
          document
            .querySelector('[data-testid="tool-rectangle"]')
            ?.getAttribute('data-active') === 'true',
        requestSubmissionClickCount,
        turnAccepted,
        turnOutcome,
        turnSettlement,
        viewport: profile.readViewportPosition(),
        zoom: profile.readZoom()
      }
    }
    const targetReached = (
      target: LocalInteractionProbeTarget,
      snapshot: LocalInteractionProbeSnapshot,
      observedFrames: number,
      baseline: LocalNavigationBaseline,
      stableLoadingFrames: number
    ): boolean => {
      switch (target) {
        case 'interaction-frame':
          return observedFrames >= 2
        case 'loading-at-zero':
          return (
            snapshot.loadingAtZero !== null &&
            snapshot.loadingConnected &&
            snapshot.turnAccepted &&
            snapshot.turnOutcome === null &&
            stableLoadingFrames >= 2
          )
        case 'loading-removed':
          return snapshot.loadingAtZero !== null && !snapshot.loadingConnected
        case 'pan-changed':
          return (
            snapshot.viewport.x !== baseline.viewport.x ||
            snapshot.viewport.y !== baseline.viewport.y
          )
        case 'rectangle-active':
          return snapshot.rectangleActive
        case 'zoom-changed':
          return snapshot.zoom !== baseline.zoom
      }
    }

    const probeRoot = document.querySelector<HTMLElement>(
      '[data-testid="asyra-canvas-host"]'
    )
    if (!probeRoot) {
      throw new Error('Local interaction probe root is unavailable')
    }
    const probe: LocalInteractionProbe = {
      focusKeyboardTarget: () => {
        probeRoot.focus({ preventScroll: true })
        return read()
      },
      read,
      waitFor: (target, timeoutMs, baseline) =>
        new Promise((resolve, reject) => {
          const startedAt = performance.now()
          let observedFrames = 0
          const navigationBaseline = baseline ?? {
            viewport: initialViewport,
            zoom: initialZoom
          }
          const inspect = (): void => {
            observedFrames += 1
            const snapshot = read()
            if (
              snapshot.loadingConnected &&
              snapshot.canonicalElements === 0 &&
              snapshot.turnAccepted &&
              snapshot.turnOutcome === null
            ) {
              stableLoadingFrameCount += 1
            } else {
              stableLoadingFrameCount = 0
            }
            if (
              target === 'loading-at-zero' &&
              observedFrames >= 2 &&
              !snapshot.turnAccepted
            ) {
              reject(
                new Error(
                  snapshot.requestSubmissionClickCount === 0
                    ? 'Prepared request click did not reach the armed Send control.'
                    : 'Agent did not accept the dispatched request.'
                )
              )
              return
            }
            if (
              (target === 'loading-at-zero' ||
                target === 'pan-changed' ||
                target === 'zoom-changed') &&
              snapshot.turnOutcome !== null
            ) {
              reject(
                new Error(
                  `AI turn settled before "${target}" evidence with outcome "${
                    snapshot.turnOutcome
                  }": ${JSON.stringify({
                    factoryTransaction: snapshot.latestFactoryTransactionStatus,
                    turn: snapshot.turnSettlement
                  })}`
                )
              )
              return
            }
            if (
              targetReached(
                target,
                snapshot,
                observedFrames,
                navigationBaseline,
                stableLoadingFrameCount
              )
            ) {
              resolve(snapshot)
              return
            }
            if (performance.now() - startedAt >= timeoutMs) {
              reject(
                new Error(
                  `Local interaction evidence "${target}" timed out at ${JSON.stringify(
                    snapshot
                  )}`
                )
              )
              return
            }
            requestAnimationFrame(inspect)
          }
          requestAnimationFrame(inspect)
        })
    }
    scope.__AsyraEndpointLocalInteractionProbe__ = probe
    return read()
  })

  return {
    canvasCenter: {
      x: canvasBounds.x + canvasBounds.width * 0.4,
      y: canvasBounds.y + canvasBounds.height * 0.6
    },
    initial,
    rectangleCenter: {
      x: rectangleBounds.x + rectangleBounds.width / 2,
      y: rectangleBounds.y + rectangleBounds.height / 2
    },
    selectCenter: {
      x: selectBounds.x + selectBounds.width / 2,
      y: selectBounds.y + selectBounds.height / 2
    }
  }
}

const waitForLocalInteractionProbe = (
  page: Page,
  target: LocalInteractionProbeTarget,
  timeoutMs = 10_000,
  baseline?: LocalNavigationBaseline
): Promise<LocalInteractionProbeSnapshot> =>
  page.evaluate(
    ({ requestedBaseline, requestedTarget, requestedTimeoutMs }) => {
      const scope = globalThis as typeof globalThis & {
        __AsyraEndpointLocalInteractionProbe__?: LocalInteractionProbe
      }
      const probe = scope.__AsyraEndpointLocalInteractionProbe__
      if (!probe) {
        throw new Error('Local interaction probe is unavailable')
      }
      return probe.waitFor(
        requestedTarget,
        requestedTimeoutMs,
        requestedBaseline
      )
    },
    {
      requestedBaseline: baseline,
      requestedTarget: target,
      requestedTimeoutMs: timeoutMs
    }
  )

const focusLocalInteractionKeyboardTarget = (
  page: Page
): Promise<LocalInteractionProbeSnapshot> =>
  page.evaluate(() => {
    const scope = globalThis as typeof globalThis & {
      __AsyraEndpointLocalInteractionProbe__?: LocalInteractionProbe
    }
    const probe = scope.__AsyraEndpointLocalInteractionProbe__
    if (!probe) {
      throw new Error('Local interaction probe is unavailable')
    }
    return probe.focusKeyboardTarget()
  })

const readLocalInteractionProbe = (
  page: Page
): Promise<LocalInteractionProbeSnapshot> =>
  page.evaluate(() => {
    const scope = globalThis as typeof globalThis & {
      __AsyraEndpointLocalInteractionProbe__?: LocalInteractionProbe
    }
    const probe = scope.__AsyraEndpointLocalInteractionProbe__
    if (!probe) {
      throw new Error('Local interaction probe is unavailable')
    }
    return probe.read()
  })

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
  await send.evaluate((element) => {
    element.setAttribute('data-endpoint-prepared-ai-submit', 'true')
  })
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
  readonly serverResponseItemCount: AsyraDesignServerResponseItemCount
  readonly proofKind?: EndpointHeartbeat['proofKind']
}): Promise<{
  actorA: Page
  actorB: Page
  contexts: readonly [BrowserContext, BrowserContext]
  serverResponseSeed: PreparedAsyraDesignServerResponseSeedMetrics
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

    const preparedResponse = getPreparedServerResponseVariant(
      serverResponseItemCount
    )
    if (fileId !== preparedResponse.fileId) {
      throw new Error(
        'Endpoint actor fileId must match its prepared server response.'
      )
    }
    let serverResponseSeed:
      | PreparedAsyraDesignServerResponseSeedMetrics
      | undefined
    await waitForConnectivityCpuSample(
      'actor-a-server-response-seed',
      async () => {
        serverResponseSeed = await seedPreparedAsyraDesignServerResponse(
          actorA.context,
          {
            appUrl: new URL(collaborationURL(fileId), baseURL).href,
            fileId,
            publicPath: preparedResponse.publicPath
          }
        )
      },
      proofKind
    )
    if (serverResponseSeed === undefined) {
      throw new Error('Prepared server response seed metrics are unavailable.')
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
      contexts: [actorA.context, actorB.context],
      serverResponseSeed
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
  const preparedResponse = getPreparedServerResponseVariant(requestedItems)
  const expectedTotal = requestedItems + 1
  const fileId = preparedResponse.fileId
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
    let serverResponseSeed:
      | PreparedAsyraDesignServerResponseSeedMetrics
      | undefined
    await waitForConnectivityCpuSample(
      'local-server-response-seed',
      async () => {
        serverResponseSeed = await seedPreparedAsyraDesignServerResponse(
          actor.context,
          {
            appUrl: new URL(profiledSingleActorAppURL(fileId), baseURL).href,
            fileId,
            publicPath: preparedResponse.publicPath
          }
        )
      },
      'local-attribution'
    )
    if (serverResponseSeed === undefined) {
      throw new Error('Prepared server response seed metrics are unavailable.')
    }
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
      heartbeat.waitForComplete(CRDT_FLOW_TIMEOUT_MS)
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

    const actorADiagnostics = await readFinalDiagnostics(
      actor.page,
      requestedItems
    )
    expect(actorADiagnostics.runtime).toBe('production')
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
    expect(actorADiagnostics.drawingProgress.loadingFrameVisibleCount).toBe(1)
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
      serverResponseSeed,
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
              name: error.name.slice(0, 80)
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
  const preparedResponse = getPreparedServerResponseVariant(requestedItems)
  const expectedTotal = 17
  const fileId = preparedResponse.fileId
  const { actorA, actorB, contexts, serverResponseSeed } =
    await prepareEndpointActorsSequentially({
      baseURL,
      browser,
      fileId,
      serverResponseItemCount: requestedItems,
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
      heartbeat.waitForBothComplete(CRDT_FLOW_TIMEOUT_MS)
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
      readFinalDiagnostics(actorA, requestedItems),
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
      serverResponseSeed,
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
              name: error.name.slice(0, 80)
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
  const preparedResponse = getPreparedServerResponseVariant(7075)
  const fileId = preparedResponse.fileId
  const { actorA, actorB, contexts, serverResponseSeed } =
    await prepareEndpointActorsSequentially({
      baseURL,
      browser,
      fileId,
      serverResponseItemCount: preparedResponse.itemCount
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
    const localInteraction = await installLocalInteractionProbe(actorA)
    expect(localInteraction.initial.canonicalElements).toBe(0)
    expect(localInteraction.initial.rectangleActive).toBe(false)
    await waitForGuardReady(createConnectivityHeartbeat('request-ready'))

    const initialHeartbeat = await heartbeat.sample()
    await postHeartbeat('progress', initialHeartbeat)

    heartbeat.startPhase('creation')
    await postHeartbeat('progress', await heartbeat.sample())
    const creationStartedAtMs = Date.now()
    heartbeat.markCreationStarted(creationStartedAtMs)
    heartbeat.begin()
    await heartbeat.assertGuarded(triggerPreparedAiTurn(preparedTurn))
    const loadingState = await heartbeat.assertGuarded(
      waitForLocalInteractionProbe(actorA, 'loading-at-zero')
    )
    const loadingAtZero = loadingState.loadingAtZero
    if (!loadingAtZero) {
      throw new Error('Connected loading evidence at zero elements is missing')
    }
    expect(loadingAtZero.connected).toBe(true)
    expect(loadingAtZero.canonicalElements).toBe(0)
    expect(['preparing', 'drawing']).toContain(loadingAtZero.phase)
    expect(loadingAtZero.rect.width).toBeGreaterThan(0)
    expect(loadingAtZero.rect.height).toBeGreaterThan(0)
    expect(loadingAtZero.rect.width / loadingAtZero.rect.height).toBeCloseTo(
      1672 / 941,
      2
    )
    expect(loadingAtZero.sourceBounds.x).toBeCloseTo(0, 2)
    expect(loadingAtZero.sourceBounds.y).toBeCloseTo(0, 2)
    expect(loadingAtZero.sourceBounds.width).toBeCloseTo(1672, 1)
    expect(loadingAtZero.sourceBounds.height).toBeCloseTo(941, 1)

    await heartbeat.assertGuarded(
      actorA.mouse.move(
        localInteraction.canvasCenter.x,
        localInteraction.canvasCenter.y
      )
    )
    await heartbeat.assertGuarded(actorA.mouse.wheel(72, 48))
    const pannedState = await heartbeat.assertGuarded(
      waitForLocalInteractionProbe(actorA, 'pan-changed', 10_000, loadingState)
    )
    expect(pannedState.viewport).not.toEqual(loadingState.viewport)
    expect(pannedState.loadingConnected).toBe(true)
    expect(pannedState.canonicalElements).toBeLessThan(7076)

    await heartbeat.assertGuarded(actorA.keyboard.down('Meta'))
    await heartbeat.assertGuarded(actorA.mouse.wheel(0, -120))
    await heartbeat.assertGuarded(actorA.keyboard.up('Meta'))
    const zoomedState = await heartbeat.assertGuarded(
      waitForLocalInteractionProbe(actorA, 'zoom-changed', 10_000, pannedState)
    )
    expect(zoomedState.zoom).not.toBe(pannedState.zoom)
    expect(zoomedState.loadingConnected).toBe(true)
    expect(zoomedState.canonicalElements).toBeLessThan(7076)

    const keyboardTargetState = await heartbeat.assertGuarded(
      focusLocalInteractionKeyboardTarget(actorA)
    )
    expect(keyboardTargetState.keyboardTargetActive).toBe(true)
    expect(keyboardTargetState.loadingConnected).toBe(true)
    expect(keyboardTargetState.canonicalElements).toBeLessThan(7076)
    expect(keyboardTargetState.turnAccepted).toBe(true)
    expect(keyboardTargetState.turnOutcome).toBeNull()
    await heartbeat.assertGuarded(actorA.keyboard.press('r'))
    await heartbeat.assertGuarded(
      actorA.mouse.click(
        localInteraction.rectangleCenter.x,
        localInteraction.rectangleCenter.y
      )
    )
    await heartbeat.assertGuarded(actorA.keyboard.press('Delete'))
    await heartbeat.assertGuarded(actorA.keyboard.press('Meta+z'))
    const blockedState = await heartbeat.assertGuarded(
      waitForLocalInteractionProbe(actorA, 'interaction-frame')
    )
    expect(blockedState.rectangleActive).toBe(false)
    expect(blockedState.documentEventAttempts).toEqual({
      deleteKey: 1,
      historyShortcut: 1,
      rectangleButton: 1,
      rectangleShortcut: 1
    })
    expect(blockedState.documentEventDeliveries).toEqual({
      deleteKey: 0,
      historyShortcut: 0,
      rectangleButton: 0,
      rectangleShortcut: 0
    })
    expect(blockedState.documentEventPreventions).toEqual({
      deleteKey: 1,
      historyShortcut: 1,
      rectangleButton: 1,
      rectangleShortcut: 1
    })
    expect(blockedState.loadingConnected).toBe(true)
    expect(blockedState.canonicalElements).toBeLessThan(7076)
    expect(blockedState.turnAccepted).toBe(true)
    expect(blockedState.turnOutcome).toBeNull()

    await heartbeat.assertGuarded(
      heartbeat.waitForActorAComplete(
        remainingCrdtFlowTimeoutMs(creationStartedAtMs)
      )
    )
    await heartbeat.assertGuarded(assertPreparedAiTurnSettled(preparedTurn))
    const loadingRemovedState = await heartbeat.assertGuarded(
      waitForLocalInteractionProbe(actorA, 'loading-removed')
    )
    expect(loadingRemovedState.loadingConnected).toBe(false)
    await heartbeat.assertGuarded(
      actorA.mouse.click(
        localInteraction.rectangleCenter.x,
        localInteraction.rectangleCenter.y
      )
    )
    const releasedState = await heartbeat.assertGuarded(
      waitForLocalInteractionProbe(actorA, 'rectangle-active')
    )
    expect(releasedState.rectangleActive).toBe(true)
    expect(releasedState.documentEventAttempts.rectangleButton).toBe(2)
    expect(releasedState.documentEventDeliveries.rectangleButton).toBe(1)
    expect(releasedState.documentEventPreventions.rectangleButton).toBe(1)
    await heartbeat.assertGuarded(
      actorA.mouse.click(
        localInteraction.selectCenter.x,
        localInteraction.selectCenter.y
      )
    )
    const selectedState = await heartbeat.assertGuarded(
      waitForLocalInteractionProbe(actorA, 'interaction-frame')
    )
    expect(selectedState.rectangleActive).toBe(false)
    const releasedKeyboardTargetState = await heartbeat.assertGuarded(
      focusLocalInteractionKeyboardTarget(actorA)
    )
    expect(releasedKeyboardTargetState.keyboardTargetActive).toBe(true)
    await heartbeat.assertGuarded(actorA.keyboard.press('r'))
    const keyboardReleasedState = await heartbeat.assertGuarded(
      waitForLocalInteractionProbe(actorA, 'rectangle-active')
    )
    expect(keyboardReleasedState.documentEventAttempts.rectangleShortcut).toBe(
      2
    )
    expect(
      keyboardReleasedState.documentEventDeliveries.rectangleShortcut
    ).toBe(1)
    expect(
      keyboardReleasedState.documentEventPreventions.rectangleShortcut
    ).toBe(1)
    heartbeat.completePhase('creation')
    heartbeat.startPhase('peer-convergence')
    const peerConvergenceHeartbeat = await heartbeat.assertGuarded(
      heartbeat.sample()
    )
    await heartbeat.assertGuarded(
      postHeartbeat('progress', peerConvergenceHeartbeat)
    )
    const completed = await heartbeat.assertGuarded(
      heartbeat.waitForBothComplete(
        remainingCrdtFlowTimeoutMs(creationStartedAtMs)
      )
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
          readFinalDiagnostics(actorA, expectedFixture.vectorCount),
          readFinalDiagnostics(actorB)
        ])
      )
    const initialAUndoDepth = initialHeartbeat.actorA.undoDepth
    const initialBUndoDepth = initialHeartbeat.actorB.undoDepth
    const actorAHistoryActionCount =
      actorADiagnostics.historyDepth - initialAUndoDepth
    expect(actorADiagnostics.runtime).toBe('production')
    expect(actorBDiagnostics.runtime).toBe('production')
    expect(actorAHistoryActionCount).toBe(1)
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
    const drawingProgress = actorADiagnostics.drawingProgress
    expect(drawingProgress.loadingFrameVisibleCount).toBe(1)
    expect(drawingProgress.strictlyIncreasing).toBe(true)
    expect(drawingProgress.visibleElementSampleCount).toBeGreaterThanOrEqual(5)
    expect(drawingProgress.visibleElementLastCount).toBe(
      expectedFixture.vectorCount
    )
    expect(drawingProgress.milestones).toHaveLength(5)
    expect(
      drawingProgress.milestones.map(({ targetElements }) => targetElements)
    ).toEqual([
      1,
      Math.ceil(expectedFixture.vectorCount * 0.25),
      Math.ceil(expectedFixture.vectorCount * 0.5),
      Math.ceil(expectedFixture.vectorCount * 0.75),
      expectedFixture.vectorCount
    ])
    expect(
      drawingProgress.milestones.every(
        ({ sampleIndex }, index, milestones) =>
          index === 0 ||
          sampleIndex > (milestones[index - 1]?.sampleIndex ?? -1)
      )
    ).toBe(true)
    expect(drawingProgress.cooperativeYieldSampleCount).toBe(1)
    expect(drawingProgress.cooperativeYieldCount).toBe(
      drawingProgress.visibleElementSampleCount
    )
    expect(drawingProgress.canonicalWorkUnitCount).toBe(
      drawingProgress.visibleElementSampleCount
    )
    expect(drawingProgress.longestCanonicalWorkUnitMs).toBeGreaterThan(0)
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
      localInteraction: {
        blockedActionAttempts: {
          deleteKeyBlocked:
            blockedState.documentEventDeliveries.deleteKey === 0,
          documentEventAttempts: blockedState.documentEventAttempts,
          documentEventDeliveries: blockedState.documentEventDeliveries,
          documentEventPreventions: blockedState.documentEventPreventions,
          historyShortcutBlocked:
            blockedState.documentEventDeliveries.historyShortcut === 0,
          rectangleButtonBlocked:
            blockedState.documentEventDeliveries.rectangleButton === 0,
          rectangleShortcutBlocked:
            blockedState.documentEventDeliveries.rectangleShortcut === 0,
          rectangleToolRemainedInactive: !blockedState.rectangleActive
        },
        completion: {
          canonicalElements: actorASummary.totalCount,
          historyActionCount: actorAHistoryActionCount,
          loadingRemoved: !loadingRemovedState.loadingConnected,
          ordinaryKeyboardToolSwitchAccepted:
            keyboardReleasedState.rectangleActive,
          ordinaryToolSwitchAccepted: releasedState.rectangleActive
        },
        loadingAtZero,
        pan: {
          after: pannedState.viewport,
          before: loadingState.viewport
        },
        progress: {
          cooperativeYieldCount: drawingProgress.cooperativeYieldCount,
          longestCanonicalWorkUnitMs:
            drawingProgress.longestCanonicalWorkUnitMs,
          milestones: drawingProgress.milestones
        },
        zoom: {
          after: zoomedState.zoom,
          before: pannedState.zoom
        }
      },
      owner: endpointOwner,
      proofKind: 'endpoint',
      serverResponseSeed,
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
    const heartbeatStopped = await settleFailureEvidenceWithin(
      heartbeat.stop(),
      1_250
    )
    let latest = heartbeat.readLatest() ?? {
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
    let failureTimeEvidence: LocalInteractionProbeSnapshot | null = null
    if (heartbeatStopped.status === 'available') {
      const freshHeartbeat = await settleFailureEvidenceWithin(
        heartbeat.sample(),
        1_000
      )
      if (freshHeartbeat.status === 'available') {
        latest = freshHeartbeat.value
      }
      const freshFailureEvidence = await settleFailureEvidenceWithin(
        readLocalInteractionProbe(actorA),
        1_000
      )
      if (freshFailureEvidence.status === 'available') {
        failureTimeEvidence = freshFailureEvidence.value
      }
    }
    const browserErrors = {
      actorA: getCapturedBrowserErrors(actorA)
        .slice(-4)
        .map((message) => message.slice(0, 300)),
      actorB: getCapturedBrowserErrors(actorB)
        .slice(-4)
        .map((message) => message.slice(0, 300))
    }
    await postHeartbeat('failed', {
      ...latest,
      browserErrors,
      error:
        error instanceof Error
          ? {
              message: error.message.slice(0, 500),
              name: error.name.slice(0, 80)
            }
          : String(error).slice(0, 500),
      failureTimeEvidence
    }).catch(() => undefined)
    // eslint-disable-next-line no-console
    console.log(
      `ASYRA_ENDPOINT_REPORT ${JSON.stringify({
        error:
          error instanceof Error
            ? {
                message: error.message.slice(0, 500),
                name: error.name.slice(0, 80)
              }
            : String(error).slice(0, 500),
        browserErrors,
        failureTimeEvidence,
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

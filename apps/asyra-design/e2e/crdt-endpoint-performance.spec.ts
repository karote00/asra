import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page
} from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { waitForAppReady } from './test-utils'

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
  readonly actorA: ActorHeartbeat
  readonly actorB: ActorHeartbeat
  readonly elapsedMs: number | null
  readonly owner: string
  readonly ownerTiming: {
    readonly actorADurationMs: number
    readonly actorAPhase: string
    readonly actorBDurationMs: number
    readonly actorBPhase: string
  }
  readonly phase: string
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

interface FinalActorDiagnostics {
  readonly configuration: {
    readonly contentsMode: string
    readonly deliveryMode: string
  }
  readonly factoryPublicationCount: number
  readonly historyDepth: number
  readonly localSentCount: number
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
}

interface EndpointReport {
  readonly actorA: {
    readonly completeMs: number | null
    readonly diagnostics: FinalActorDiagnostics
    readonly firstVisibleMs: number | null
    readonly summary: CanonicalSummary
  }
  readonly actorB: {
    readonly completeMs: number | null
    readonly diagnostics: FinalActorDiagnostics
    readonly firstVisibleMs: number | null
    readonly summary: CanonicalSummary
  }
  readonly convergedMs: number
  readonly durationMs: number
  readonly equivalenceProofMs: number
  readonly owner: string
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

const waitForCollaboration = async (page: Page): Promise<void> => {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__AsyraCollaboration__?.getStatus() ?? 'missing'
        ),
      { timeout: 30_000 }
    )
    .toBe('connected')
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
      renderProjectionElements: profile.readRenderProjectionElementCount()
    }
  })

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs))

const createHeartbeatController = (actorA: Page, actorB: Page) => {
  let active = false
  let creationStartedAtMs: number | null = null
  let currentPhase = 'initializing'
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
      actorASample.canonicalElements === expectedFixture.totalCount &&
      actorARendered === expectedFixture.totalCount
    const publicationsSettled =
      actorASample.failed + actorBSample.failed === 0 &&
      actorASample.localSent > 0 &&
      actorASample.factoryPublications === actorASample.localSent &&
      actorASample.localSent === actorBSample.remoteProcessed
    const actorBComplete =
      actorBSample.canonicalElements === expectedFixture.totalCount &&
      actorBRendered === expectedFixture.totalCount &&
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
      actorA: {
        canonicalElements: actorASample.canonicalElements,
        complete: actorAComplete,
        completeAtMs: actorACompleteAtMs,
        elements: actorARendered,
        firstVisibleAtMs: actorAFirstVisibleAtMs,
        renderProjectionElements: actorASample.renderProjectionElements,
        total: expectedFixture.totalCount,
        undoDepth: actorASample.historyDepth
      },
      actorB: {
        canonicalElements: actorBSample.canonicalElements,
        complete: actorBComplete,
        completeAtMs: actorBCompleteAtMs,
        elements: actorBRendered,
        firstVisibleAtMs: actorBFirstVisibleAtMs,
        renderProjectionElements: actorBSample.renderProjectionElements,
        total: expectedFixture.totalCount,
        undoDepth: actorBSample.historyDepth
      },
      elapsedMs,
      owner: endpointOwner,
      ownerTiming: {
        actorADurationMs: actorASample.latestOwnerTiming?.durationMs ?? 0,
        actorAPhase: actorASample.latestOwnerTiming?.name ?? 'unavailable',
        actorBDurationMs: actorBSample.latestOwnerTiming?.durationMs ?? 0,
        actorBPhase: actorBSample.latestOwnerTiming?.name ?? 'unavailable'
      },
      phase: currentPhase,
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
    readLatest: () => latest,
    sample,
    setPhase: (phase: string) => {
      currentPhase = phase
    },
    stop: async () => {
      active = false
      await loop
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

const readFinalDiagnostics = (page: Page): Promise<FinalActorDiagnostics> =>
  page.evaluate(() => {
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

const openAgentAndAttachReference = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Open Mock AI' }).click()
  await expect(page.getByTestId('mock-ai-panel')).toBeVisible()
  await page.getByLabel('Choose images').setInputFiles(referenceImagePath)
  await expect(
    page.getByRole('img', { name: referenceImageName })
  ).toBeVisible()
}

const submitExactCatTurn = async (page: Page): Promise<void> => {
  const input = page.getByLabel('Message Agent')
  await expect(input).toBeEnabled()
  await input.fill(exactCatOnlyPrompt)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Working on your request')).toBeVisible()
  const settledTurns = page
    .getByTestId('mock-ai-panel')
    .locator('article[data-turn-id]')
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

const createActors = async (
  browser: Browser,
  baseURL: string
): Promise<{
  actorA: Page
  actorB: Page
  contexts: readonly [BrowserContext, BrowserContext]
}> => {
  const actorAContext = await browser.newContext({
    baseURL,
    viewport: { height: 900, width: 1440 }
  })
  const actorBContext = await browser.newContext({
    baseURL,
    viewport: { height: 900, width: 1440 }
  })
  return {
    actorA: await actorAContext.newPage(),
    actorB: await actorBContext.newPage(),
    contexts: [actorAContext, actorBContext]
  }
}

test('creation-only high-detail endpoint proof', async ({
  browser
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? '')
  if (!baseURL) {
    throw new Error('Endpoint performance App URL is unavailable')
  }
  const { actorA, actorB, contexts } = await createActors(browser, baseURL)
  const heartbeat = createHeartbeatController(actorA, actorB)
  const fileId = `endpoint-${endpointOwner}-${Date.now()}`
  const testStartedAtMs = Date.now()
  let report: EndpointReport | null = null

  try {
    heartbeat.setPhase('navigate')
    await Promise.all([
      actorA.goto(collaborationURL(fileId)),
      actorB.goto(collaborationURL(fileId))
    ])
    heartbeat.setPhase('app-ready')
    await Promise.all([waitForAppReady(actorA), waitForAppReady(actorB)])
    heartbeat.setPhase('collaboration-ready')
    await Promise.all([
      waitForCollaboration(actorA),
      waitForCollaboration(actorB)
    ])
    await Promise.all([
      installBoundedDiagnostics(actorA),
      installBoundedDiagnostics(actorB)
    ])
    heartbeat.setPhase('reference-ready')
    await openAgentAndAttachReference(actorA)

    const initialHeartbeat = await heartbeat.sample()
    await waitForGuardReady(initialHeartbeat)

    heartbeat.setPhase('creation')
    const creationStartedAtMs = Date.now()
    heartbeat.markCreationStarted(creationStartedAtMs)
    await postHeartbeat('progress', await heartbeat.sample())
    heartbeat.begin()
    await heartbeat.assertGuarded(submitExactCatTurn(actorA))
    heartbeat.setPhase('peer-convergence')
    await postHeartbeat('progress', await heartbeat.sample())
    const completed = await heartbeat.assertGuarded(
      heartbeat.waitForBothComplete(120_000)
    )
    const convergedMs = completed.actorB.completeAtMs
    if (convergedMs === null) {
      throw new Error('Actor B completion timing is unavailable')
    }
    const equivalenceProofStartedAtMs = Date.now()

    heartbeat.setPhase('canonical-summary-a')
    const actorASummary = await heartbeat.assertGuarded(
      readCanonicalSummary(actorA)
    )
    heartbeat.setPhase('canonical-summary-b')
    const actorBSummary = await heartbeat.assertGuarded(
      readCanonicalSummary(actorB)
    )
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

    heartbeat.setPhase('final-diagnostics')
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
      status: 'complete'
    }
    heartbeat.setPhase('complete')
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
    heartbeat.setPhase('failed')
    await heartbeat.stop()
    const latest = heartbeat.readLatest() ?? {
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
      elapsedMs: null,
      owner: endpointOwner,
      ownerTiming: {
        actorADurationMs: 0,
        actorAPhase: 'unavailable',
        actorBDurationMs: 0,
        actorBPhase: 'unavailable'
      },
      phase: 'failed',
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

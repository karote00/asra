import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type TestInfo,
  type Video
} from '@playwright/test'
import { Buffer } from 'node:buffer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { decodeProfiledWebSocketFrame } from '../src/collaboration/websocket-profile-frame'
import { getTransactionSnapshot, undo, waitForAppReady } from './test-utils'

interface CanonicalAiDrawingSnapshot {
  readonly blueStrokeIds: readonly string[]
  readonly groupCount: number
  readonly ids: readonly string[]
  readonly pointCount: number
  readonly redFillIds: readonly string[]
  readonly totalCount: number
  readonly vectorCount: number
  readonly whiteBackgrounds: readonly {
    readonly height: number
    readonly id: string
    readonly width: number
  }[]
}

interface TimelineEntry {
  readonly actorAElapsed: string
  readonly capturedAtMs: number
  readonly step: string
}

interface ProgressiveCreationEvidence {
  readonly firstPublicationAtMs: number
  readonly firstVisibleAtMs: number
  readonly observedElementCounts: readonly number[]
  readonly peerFirstVisibleMs: number
  readonly processedPublicationCount: number
}

interface CollaborationOutcomeEvidence {
  readonly capturedAtMs: number
  readonly direction: string
  readonly error?: {
    readonly message: string
    readonly name: string
  }
  readonly publicationId: string
  readonly status: string
}

interface FactoryPublicationEvidence {
  readonly capturedAtMs: number
  readonly deliveryCount: number
  readonly publicationId: string
  readonly sharedDeliveryModes: readonly string[]
}

interface FactoryCommitEvidence {
  readonly capturedAtMs: number
  readonly origin: string
  readonly transactionId: number
}

interface PersistedAiDrawingEvidence extends CanonicalAiDrawingSnapshot {
  readonly byteLength: number
  readonly sha256: string
}

interface LiveAiDrawingEvidence extends CanonicalAiDrawingSnapshot {
  readonly byteLength: number
  readonly sha256: string
}

const canonicalSummary = (
  evidence: CanonicalAiDrawingSnapshot
): CanonicalAiDrawingSnapshot => ({
  blueStrokeIds: evidence.blueStrokeIds,
  groupCount: evidence.groupCount,
  ids: evidence.ids,
  pointCount: evidence.pointCount,
  redFillIds: evidence.redFillIds,
  totalCount: evidence.totalCount,
  vectorCount: evidence.vectorCount,
  whiteBackgrounds: evidence.whiteBackgrounds
})

interface PerformanceProfileSnapshot {
  readonly configuration: {
    readonly contentsMode: 'omitted' | 'present'
    readonly deliveryMode: 'atomic' | 'progressive'
  }
  readonly counters: readonly {
    readonly atMs: number
    readonly name: string
    readonly value: number
  }[]
  readonly phases: readonly {
    readonly atMs: number
    readonly durationMs: number
    readonly name: string
  }[]
  readonly releaseEvidenceEligible: boolean
  readonly runtime: 'development' | 'production'
}

interface WebSocketPayloadProfile {
  readonly deliveryBytesByRoute: readonly {
    readonly bytes: number
    readonly count: number
    readonly route: string
  }[]
  readonly duplicateDeliveryIdCount: number
  readonly duplicatePropertySnapshotIdCount: number
  readonly duplicatePublicationIdCount: number
  readonly maxPropertySnapshotsPerDelivery: number
  readonly maxPropertySnapshotBytes: number
  readonly publicationCount: number
  readonly publicationFrameCount: number
  readonly propertySnapshotBytesByType: readonly {
    readonly bytes: number
    readonly count: number
    readonly type: string
  }[]
  readonly propertySnapshotCount: number
  readonly totalPropertySnapshotBytes: number
  readonly totalDeliveryBytes: number
  readonly totalFrameWireBytes: number
  readonly totalPublicationBytes: number
  readonly uniqueDeliveryIdCount: number
  readonly uniquePropertySnapshotIdCount: number
  readonly uniquePublicationIdCount: number
}

const exactCatOnlyPrompt =
  'Draw only the cat from the reference image. Exclude the original background and place the cat on a pure white background canvas with exactly the same width and height as the uploaded photo.'
const referenceImageName = 'research-02-original-tabby-source.png'
const referenceImagePath = fileURLToPath(
  new URL(
    '../visual-review-records/research/research-02-original-tabby-source.png',
    import.meta.url
  )
)
const visualRecordDirectory = fileURLToPath(
  new URL('../visual-review-records/crdt-ai-agent/', import.meta.url)
)

const collaborationUrl = (fileId: string) =>
  `/?fileId=${encodeURIComponent(fileId)}&ai=mock&aiDelivery=progressive`

const profiledCollaborationUrl = (fileId: string) =>
  `${collaborationUrl(fileId)}&aiPerformance=profile`

const startWebSocketPayloadProfile = async (
  context: BrowserContext,
  page: Page
): Promise<() => Promise<WebSocketPayloadProfile>> => {
  const session = await context.newCDPSession(page)
  await session.send('Network.enable')
  const publicationIds = new Set<string>()
  const deliveryIds = new Set<string>()
  const propertySnapshotIds = new Set<string>()
  const deliveryBytesByRoute = new Map<
    string,
    { bytes: number; count: number }
  >()
  const propertySnapshotBytesByType = new Map<
    string,
    { bytes: number; count: number }
  >()
  let duplicateDeliveryIdCount = 0
  let duplicatePropertySnapshotIdCount = 0
  let duplicatePublicationIdCount = 0
  let maxPropertySnapshotsPerDelivery = 0
  let maxPropertySnapshotBytes = 0
  let publicationCount = 0
  let publicationFrameCount = 0
  let propertySnapshotCount = 0
  let totalPropertySnapshotBytes = 0
  let totalDeliveryBytes = 0
  let totalFrameWireBytes = 0
  let totalPublicationBytes = 0
  const onFrame = ({
    response
  }: {
    response: { opcode: number; payloadData: string }
  }) => {
    let frame: ReturnType<typeof decodeProfiledWebSocketFrame>
    try {
      frame = decodeProfiledWebSocketFrame(response)
    } catch {
      return
    }
    if (!frame) return
    const value = frame.value
    if (!value || typeof value !== 'object') return
    const message = value as {
      type?: unknown
      publication?: unknown
      publications?: unknown
    }
    let publications: readonly unknown[] | undefined
    if (message.type === 'send-publication') {
      publications = [message.publication]
    } else if (
      message.type === 'send-publications' &&
      Array.isArray(message.publications)
    ) {
      publications = message.publications
    }
    if (!publications) return
    publicationFrameCount += 1
    totalFrameWireBytes += frame.wireByteLength
    publications.forEach((publicationValue) => {
      if (!publicationValue || typeof publicationValue !== 'object') return
      const publication = publicationValue as {
        publicationId?: unknown
        deliveries?: unknown
      }
      publicationCount += 1
      totalPublicationBytes += Buffer.byteLength(JSON.stringify(publication))
      if (typeof publication.publicationId === 'string') {
        if (publicationIds.has(publication.publicationId)) {
          duplicatePublicationIdCount += 1
        }
        publicationIds.add(publication.publicationId)
      }
      if (!Array.isArray(publication.deliveries)) return
      publication.deliveries.forEach((deliveryValue) => {
        if (!deliveryValue || typeof deliveryValue !== 'object') return
        const delivery = deliveryValue as {
          channel?: unknown
          deliveryId?: unknown
          eventName?: unknown
          payload?: unknown
        }
        const bytes = Buffer.byteLength(JSON.stringify(delivery))
        totalDeliveryBytes += bytes
        const route = `${String(delivery.channel)}/${String(
          delivery.eventName
        )}`
        const routeEntry = deliveryBytesByRoute.get(route) ?? {
          bytes: 0,
          count: 0
        }
        routeEntry.bytes += bytes
        routeEntry.count += 1
        deliveryBytesByRoute.set(route, routeEntry)
        if (
          route === 'props/addProperty' &&
          delivery.payload &&
          typeof delivery.payload === 'object'
        ) {
          const data = (delivery.payload as { data?: unknown }).data
          if (Array.isArray(data)) {
            maxPropertySnapshotsPerDelivery = Math.max(
              maxPropertySnapshotsPerDelivery,
              data.length
            )
            data.forEach((snapshotValue) => {
              if (!snapshotValue || typeof snapshotValue !== 'object') return
              const snapshot = snapshotValue as {
                id?: unknown
                type?: unknown
              }
              const snapshotBytes = Buffer.byteLength(
                JSON.stringify(snapshotValue)
              )
              const type = String(snapshot.type)
              const typeEntry = propertySnapshotBytesByType.get(type) ?? {
                bytes: 0,
                count: 0
              }
              typeEntry.bytes += snapshotBytes
              typeEntry.count += 1
              propertySnapshotBytesByType.set(type, typeEntry)
              maxPropertySnapshotBytes = Math.max(
                maxPropertySnapshotBytes,
                snapshotBytes
              )
              propertySnapshotCount += 1
              totalPropertySnapshotBytes += snapshotBytes
              if (typeof snapshot.id === 'string') {
                if (propertySnapshotIds.has(snapshot.id)) {
                  duplicatePropertySnapshotIdCount += 1
                }
                propertySnapshotIds.add(snapshot.id)
              }
            })
          }
        }
        if (typeof delivery.deliveryId === 'string') {
          if (deliveryIds.has(delivery.deliveryId)) {
            duplicateDeliveryIdCount += 1
          }
          deliveryIds.add(delivery.deliveryId)
        }
      })
    })
  }
  session.on('Network.webSocketFrameSent', onFrame)

  return async () => {
    session.off('Network.webSocketFrameSent', onFrame)
    await session.send('Network.disable')
    return {
      deliveryBytesByRoute: [...deliveryBytesByRoute.entries()]
        .map(([route, evidence]) => ({ route, ...evidence }))
        .sort((left, right) => right.bytes - left.bytes),
      duplicateDeliveryIdCount,
      duplicatePropertySnapshotIdCount,
      duplicatePublicationIdCount,
      maxPropertySnapshotsPerDelivery,
      maxPropertySnapshotBytes,
      publicationCount,
      publicationFrameCount,
      propertySnapshotBytesByType: [...propertySnapshotBytesByType.entries()]
        .map(([type, evidence]) => ({ type, ...evidence }))
        .sort((left, right) => right.bytes - left.bytes),
      propertySnapshotCount,
      totalPropertySnapshotBytes,
      totalDeliveryBytes,
      totalFrameWireBytes,
      totalPublicationBytes,
      uniqueDeliveryIdCount: deliveryIds.size,
      uniquePropertySnapshotIdCount: propertySnapshotIds.size,
      uniquePublicationIdCount: publicationIds.size
    }
  }
}

const prepareCompleteCatViewport = async (page: Page) => {
  const viewport = await page.locator('#viewport-anchor').boundingBox()
  if (!viewport) {
    throw new Error('The Asyra Design viewport bounds are unavailable')
  }
  const output = {
    height: 941,
    width: 1672,
    x: 0,
    y: 0
  }
  const padding = 32
  const scale = Math.min(
    (viewport.width - padding * 2) / output.width,
    (viewport.height - padding * 2) / output.height,
    1
  )
  const position = {
    x: viewport.x + (viewport.width - output.width * scale) / 2,
    y: viewport.y + (viewport.height - output.height * scale) / 2
  }
  await page.evaluate(
    ({ nextPosition, nextScale }) => {
      window.__Core__.setSystemProperty('zoom', nextScale)
      window.__Core__.setSystemProperty('viewportPosition', nextPosition)
    },
    {
      nextPosition: position,
      nextScale: scale
    }
  )
  await page.waitForTimeout(250)
  return { output, position, scale, viewport }
}

const waitForCollaboration = async (page: Page) => {
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__AsyraCollaboration__?.getStatus() ?? 'missing'
      )
    )
    .toBe('connected')
}

const captureCollaborationOutcomes = async (page: Page) => {
  await page.evaluate(() => {
    const runtime = globalThis as typeof globalThis & {
      __aiCrdtOutcomes?: CollaborationOutcomeEvidence[]
    }
    runtime.__aiCrdtOutcomes = []
    const collaboration = window.__AsyraCollaboration__ as
      | (NonNullable<Window['__AsyraCollaboration__']> & {
          observePublicationOutcomes(
            subscriber: (outcome: {
              direction: string
              error?: unknown
              publicationId: string
              status: string
            }) => void
          ): () => void
        })
      | undefined
    collaboration?.observePublicationOutcomes((outcome) => {
      runtime.__aiCrdtOutcomes?.push({
        capturedAtMs: performance.timeOrigin + performance.now(),
        direction: outcome.direction,
        ...(outcome.error instanceof Error
          ? {
              error: {
                message: outcome.error.message,
                name: outcome.error.name
              }
            }
          : {}),
        publicationId: outcome.publicationId,
        status: outcome.status
      })
    })
  })
}

const captureProgressiveRuntimeEvidence = async (page: Page) => {
  await page.evaluate(() => {
    const runtime = globalThis as typeof globalThis & {
      __aiCreateDeliveryModes?: string[]
      __aiFactoryCommits?: FactoryCommitEvidence[]
      __aiFactoryPublications?: FactoryPublicationEvidence[]
    }
    runtime.__aiCreateDeliveryModes = []
    runtime.__aiFactoryCommits = []
    runtime.__aiFactoryPublications = []
    if (window.__AsyraAiDrawingPerformance__) {
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = window as any
    const factory = scope.__Core__?.deps?.factory
    if (!factory) {
      throw new Error('Progressive runtime evidence owners are unavailable')
    }
    factory.subscribeToSharedPublication(
      (publication: {
        deliveries: readonly { sharedDelivery: string }[]
        publicationId: string
      }) => {
        runtime.__aiFactoryPublications?.push({
          capturedAtMs: performance.timeOrigin + performance.now(),
          deliveryCount: publication.deliveries.length,
          publicationId: publication.publicationId,
          sharedDeliveryModes: [
            ...new Set(
              publication.deliveries.map((delivery) => delivery.sharedDelivery)
            )
          ]
        })
      }
    )
    factory.subscribeToTransactionStatus(
      (status: {
        origin: string
        status: string
        timestamp: number
        transactionId: number
      }) => {
        if (status.status !== 'committed') return
        runtime.__aiFactoryCommits?.push({
          capturedAtMs: status.timestamp,
          origin: status.origin,
          transactionId: status.transactionId
        })
      }
    )
  })
}

const getCollaborationDiagnostics = (page: Page) =>
  page.evaluate(() => {
    const runtime = globalThis as typeof globalThis & {
      __aiCreateDeliveryModes?: string[]
      __aiFactoryCommits?: FactoryCommitEvidence[]
      __aiFactoryPublications?: FactoryPublicationEvidence[]
      __aiCrdtOutcomes?: CollaborationOutcomeEvidence[]
    }
    const profileEvidence =
      window.__AsyraAiDrawingPerformance__?.getRuntimeEvidence()
    return {
      createDeliveryModes: runtime.__aiCreateDeliveryModes ?? [],
      factoryCommits:
        profileEvidence?.factoryCommits ?? runtime.__aiFactoryCommits ?? [],
      factoryPublications:
        profileEvidence?.factoryPublications ??
        runtime.__aiFactoryPublications ??
        [],
      outcomes: runtime.__aiCrdtOutcomes ?? [],
      status: window.__AsyraCollaboration__?.getStatus() ?? 'missing'
    }
  })

const getCanonicalAiDrawingSnapshot = (
  page: Page
): Promise<CanonicalAiDrawingSnapshot> =>
  page.evaluate(() => {
    const canonicalElements =
      window.__AsyraAiDrawingPerformance__?.readCanonicalElements() ??
      Array.from(window.__Core__.deps.sceneTree.getAllElements().entries()).map(
        ([id, element]) => ({
          computed: element.getAllComputedData(),
          id,
          raw: element.save(),
          rendered: Boolean(window.__Core__.deps.render.getElementById(id)),
          type: String(element.get('type'))
        })
      )

    const blueStrokeIds: string[] = []
    const ids: string[] = []
    const redFillIds: string[] = []
    const whiteBackgrounds: {
      height: number
      id: string
      width: number
    }[] = []
    let groupCount = 0
    let pointCount = 0
    let vectorCount = 0

    for (const element of canonicalElements) {
      const { id, type } = element
      if (type === 'workspace') {
        continue
      }
      ids.push(id)
      if (type === 'group') {
        groupCount += 1
      }
      if (type !== 'vector') {
        continue
      }
      vectorCount += 1
      const computed = element.computed as {
        fills?: readonly { color?: string }[]
        height?: number
        points?: Record<string, unknown>
        strokes?: readonly { fill?: { color?: string } }[]
        width?: number
      }
      pointCount += Object.keys(computed?.points ?? {}).length
      const primaryFill = computed?.fills?.[0]
      if (primaryFill?.color === '#DC2626') {
        redFillIds.push(id)
      }
      if (
        primaryFill?.color === '#FFFFFF' &&
        computed?.width === 1672 &&
        computed?.height === 941
      ) {
        whiteBackgrounds.push({
          height: computed.height,
          id,
          width: computed.width
        })
      }
      if (computed?.strokes?.[0]?.fill?.color === '#2563EB') {
        blueStrokeIds.push(id)
      }
    }

    return {
      blueStrokeIds: blueStrokeIds.sort(),
      groupCount,
      ids: ids.sort(),
      pointCount,
      redFillIds: redFillIds.sort(),
      totalCount: ids.length,
      vectorCount,
      whiteBackgrounds: whiteBackgrounds.sort((left, right) =>
        left.id.localeCompare(right.id)
      )
    }
  })

const getLiveAiDrawingEvidence = (page: Page): Promise<LiveAiDrawingEvidence> =>
  page.evaluate(async () => {
    const canonicalElements =
      window.__AsyraAiDrawingPerformance__?.readCanonicalElements() ??
      Array.from(window.__Core__.deps.sceneTree.getAllElements().entries()).map(
        ([id, element]) => ({
          computed: element.getAllComputedData(),
          id,
          raw: element.save(),
          rendered: Boolean(window.__Core__.deps.render.getElementById(id)),
          type: String(element.get('type'))
        })
      )
    const normalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(normalize)
      if (!value || typeof value !== 'object') return value
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)])
      )
    }
    const blueStrokeIds: string[] = []
    const ids: string[] = []
    const redFillIds: string[] = []
    const whiteBackgrounds: {
      height: number
      id: string
      width: number
    }[] = []
    let groupCount = 0
    let pointCount = 0
    let vectorCount = 0

    for (const element of canonicalElements) {
      const { id, type } = element
      if (type === 'workspace') continue
      ids.push(id)
      if (type === 'group') groupCount += 1
      if (type !== 'vector') continue
      vectorCount += 1
      const computed = element.computed as {
        fills?: readonly { color?: string }[]
        height?: number
        points?: Record<string, unknown>
        strokes?: readonly { fill?: { color?: string } }[]
        width?: number
      }
      pointCount += Object.keys(computed.points ?? {}).length
      const primaryFill = computed.fills?.[0]
      if (primaryFill?.color === '#DC2626') redFillIds.push(id)
      if (
        primaryFill?.color === '#FFFFFF' &&
        computed.width === 1672 &&
        computed.height === 941
      ) {
        whiteBackgrounds.push({
          height: computed.height,
          id,
          width: computed.width
        })
      }
      if (computed.strokes?.[0]?.fill?.color === '#2563EB') {
        blueStrokeIds.push(id)
      }
    }

    const canonical = canonicalElements
      .filter(({ type }) => type !== 'workspace')
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ computed, id, raw, rendered, type }) => ({
        computed: normalize(computed),
        id,
        raw: normalize(raw),
        rendered,
        type
      }))
    const bytes = new TextEncoder().encode(JSON.stringify(canonical))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return {
      blueStrokeIds: blueStrokeIds.sort(),
      byteLength: bytes.byteLength,
      groupCount,
      ids: ids.sort(),
      pointCount,
      redFillIds: redFillIds.sort(),
      sha256: [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join(''),
      totalCount: ids.length,
      vectorCount,
      whiteBackgrounds: whiteBackgrounds.sort((left, right) =>
        left.id.localeCompare(right.id)
      )
    }
  })

const getAppliedRenderProjectionCount = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      window.__AsyraAiDrawingPerformance__
        ?.snapshot()
        .counters.filter(
          ({ name }) => name === 'render-projection-outcome-applied'
        )
        .reduce((total, { value }) => total + value, 0) ?? 0
  )

const getLiveCanonicalElementCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const profile = window.__AsyraAiDrawingPerformance__
    if (!profile) {
      throw new Error('AI drawing performance profile is unavailable')
    }
    return profile.readCanonicalElementCount()
  })

const waitForAppliedRenderProjection = async (
  page: Page,
  predicate: (count: number) => boolean,
  timeout: number,
  sourcePage?: Page
): Promise<number> => {
  let observed = 0
  try {
    await expect
      .poll(
        async () => {
          observed = await getAppliedRenderProjectionCount(page)
          return predicate(observed)
        },
        { timeout }
      )
      .toBe(true)
  } catch (error) {
    const [
      snapshot,
      diagnostics,
      liveEvidence,
      sourceSnapshot,
      sourceDiagnostics
    ] = await Promise.all([
      page.evaluate(
        () => window.__AsyraAiDrawingPerformance__?.snapshot() ?? null
      ),
      getCollaborationDiagnostics(page),
      Promise.race([
        getLiveAiDrawingEvidence(page),
        page.waitForTimeout(10_000).then(() => null)
      ]),
      sourcePage
        ? sourcePage.evaluate(
            () => window.__AsyraAiDrawingPerformance__?.snapshot() ?? null
          )
        : Promise.resolve(null),
      sourcePage
        ? getCollaborationDiagnostics(sourcePage)
        : Promise.resolve(null)
    ])
    const phaseTotals = new Map<string, number>()
    const counterTotals = new Map<string, number>()
    snapshot?.phases.forEach(({ durationMs, name }) => {
      phaseTotals.set(name, (phaseTotals.get(name) ?? 0) + durationMs)
    })
    snapshot?.counters.forEach(({ name, value }) => {
      counterTotals.set(name, (counterTotals.get(name) ?? 0) + value)
    })
    const sourcePhaseTotals = new Map<string, number>()
    const sourceCounterTotals = new Map<string, number>()
    sourceSnapshot?.phases.forEach(({ durationMs, name }) => {
      sourcePhaseTotals.set(
        name,
        (sourcePhaseTotals.get(name) ?? 0) + durationMs
      )
    })
    sourceSnapshot?.counters.forEach(({ name, value }) => {
      sourceCounterTotals.set(
        name,
        (sourceCounterTotals.get(name) ?? 0) + value
      )
    })
    throw new Error(
      `Actor B render convergence timed out: ${JSON.stringify({
        source: sourceDiagnostics
          ? {
              outcomeCounts: Object.fromEntries(
                sourceDiagnostics.outcomes.reduce<Map<string, number>>(
                  (counts, outcome) =>
                    counts.set(
                      outcome.status,
                      (counts.get(outcome.status) ?? 0) + 1
                    ),
                  new Map()
                )
              ),
              status: sourceDiagnostics.status,
              topCounters: [...sourceCounterTotals.entries()]
                .sort((left, right) => right[1] - left[1])
                .slice(0, 10),
              topPhases: [...sourcePhaseTotals.entries()]
                .sort((left, right) => right[1] - left[1])
                .slice(0, 12)
                .map(([name, durationMs]) => [name, Math.round(durationMs)])
            }
          : null,
        collaboration: {
          outcomeCounts: Object.fromEntries(
            diagnostics.outcomes.reduce<Map<string, number>>(
              (counts, outcome) =>
                counts.set(
                  outcome.status,
                  (counts.get(outcome.status) ?? 0) + 1
                ),
              new Map()
            )
          ),
          status: diagnostics.status
        },
        observedRenderProjectionCount: observed,
        live: liveEvidence
          ? {
              sha256: liveEvidence.sha256.slice(0, 12),
              totalCount: liveEvidence.totalCount
            }
          : null,
        topCounters: [...counterTotals.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, 10),
        topPhases: [...phaseTotals.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, 12)
          .map(([name, durationMs]) => [name, Math.round(durationMs)])
      })}; cause: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  return observed
}

const getPersistedAiDrawingEvidence = (
  page: Page,
  fileId: string
): Promise<PersistedAiDrawingEvidence | null> =>
  page.evaluate(
    async ({ key }) => {
      interface SavedElement {
        children?: readonly string[]
        id?: string
        props?: Record<string, string>
        type?: unknown
        [key: string]: unknown
      }
      type SavedProperty = Record<string, unknown>
      const saved = await new Promise<{
        props?: Record<string, SavedProperty>
        sceneTree?: {
          elements?: Record<string, SavedElement>
        }
      } | null>((resolve, reject) => {
        const openRequest = indexedDB.open('asyra-documents')
        openRequest.onerror = () =>
          reject(openRequest.error ?? new Error('IndexedDB open failed'))
        openRequest.onsuccess = () => {
          const database = openRequest.result
          const transaction = database.transaction('documents', 'readonly')
          const request = transaction.objectStore('documents').get(key)
          request.onerror = () =>
            reject(request.error ?? new Error('IndexedDB read failed'))
          request.onsuccess = () => resolve(request.result ?? null)
          transaction.oncomplete = () => database.close()
          transaction.onabort = () => database.close()
        }
      })
      if (!saved) return null

      const properties = saved.props ?? {}
      const elements = Object.entries(saved.sceneTree?.elements ?? {})
        .filter(([, element]) => element.type !== 'workspace')
        .sort(([left], [right]) => left.localeCompare(right))
      const reachablePropertyIds = new Set<string>()
      const pendingPropertyIds = elements.flatMap(([, element]) =>
        Object.values(element.props ?? {})
      )
      const discoverPropertyIds = (value: unknown): void => {
        if (typeof value === 'string') {
          if (
            Object.hasOwn(properties, value) &&
            !reachablePropertyIds.has(value)
          ) {
            pendingPropertyIds.push(value)
          }
          return
        }
        if (Array.isArray(value)) {
          value.forEach(discoverPropertyIds)
          return
        }
        if (value && typeof value === 'object') {
          Object.values(value).forEach(discoverPropertyIds)
        }
      }
      while (pendingPropertyIds.length > 0) {
        const propertyId = pendingPropertyIds.shift()
        if (!propertyId || reachablePropertyIds.has(propertyId)) continue
        const property = properties[propertyId]
        if (!property) continue
        reachablePropertyIds.add(propertyId)
        discoverPropertyIds(property)
      }

      const normalize = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(normalize)
        if (!value || typeof value !== 'object') return value
        return Object.fromEntries(
          Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([childKey, child]) => [childKey, normalize(child)])
        )
      }
      const canonical = normalize({
        elements: elements.map(([id, element]) => ({ id, ...element })),
        props: [...reachablePropertyIds]
          .sort((left, right) => left.localeCompare(right))
          .map((id) => ({ id, ...properties[id] }))
      })
      const bytes = new TextEncoder().encode(JSON.stringify(canonical))
      const digest = await crypto.subtle.digest('SHA-256', bytes)

      const blueStrokeIds: string[] = []
      const ids: string[] = []
      const redFillIds: string[] = []
      const whiteBackgrounds: {
        height: number
        id: string
        width: number
      }[] = []
      let groupCount = 0
      let pointCount = 0
      let vectorCount = 0
      for (const [id, element] of elements) {
        ids.push(id)
        if (element.type === 'group') {
          groupCount += 1
          continue
        }
        if (element.type !== 'vector') continue
        vectorCount += 1
        const elementProperties = element.props ?? {}
        const points = properties[elementProperties.points] as
          | { points?: readonly string[] }
          | undefined
        pointCount += points?.points?.length ?? 0
        const fills = properties[elementProperties.fills] as
          | { fills?: readonly string[] }
          | undefined
        const primaryFill = properties[fills?.fills?.[0] ?? ''] as
          | { color?: unknown }
          | undefined
        if (primaryFill?.color === '#DC2626') {
          redFillIds.push(id)
        }
        const dimension = properties[elementProperties.dimension] as
          | { height?: unknown; width?: unknown }
          | undefined
        if (
          primaryFill?.color === '#FFFFFF' &&
          dimension?.width === 1672 &&
          dimension.height === 941
        ) {
          whiteBackgrounds.push({
            height: dimension.height,
            id,
            width: dimension.width
          })
        }
        const strokes = properties[elementProperties.strokes] as
          | { strokes?: readonly string[] }
          | undefined
        const primaryStroke = properties[strokes?.strokes?.[0] ?? ''] as
          | { fill?: { color?: unknown } }
          | undefined
        if (primaryStroke?.fill?.color === '#2563EB') {
          blueStrokeIds.push(id)
        }
      }

      return {
        blueStrokeIds: blueStrokeIds.sort(),
        byteLength: bytes.byteLength,
        groupCount,
        ids: ids.sort(),
        pointCount,
        redFillIds: redFillIds.sort(),
        sha256: [...new Uint8Array(digest)]
          .map((value) => value.toString(16).padStart(2, '0'))
          .join(''),
        totalCount: ids.length,
        vectorCount,
        whiteBackgrounds: whiteBackgrounds.sort((left, right) =>
          left.id.localeCompare(right.id)
        )
      }
    },
    { key: `FILE:${fileId}` }
  )

const waitForPersistedAiDrawingEvidence = async (
  page: Page,
  fileId: string,
  predicate: (evidence: PersistedAiDrawingEvidence) => boolean,
  timeout = 30_000
): Promise<PersistedAiDrawingEvidence> => {
  const deadline = Date.now() + timeout
  let attempt = 0
  while (Date.now() < deadline) {
    const attemptStartedAtMs = Date.now()
    const evidence = await getPersistedAiDrawingEvidence(page, fileId)
    attempt += 1
    // eslint-disable-next-line no-console
    console.log(
      `AI_CRDT_PERSISTENCE ${JSON.stringify({
        attempt,
        durationMs: Date.now() - attemptStartedAtMs,
        sha256: evidence?.sha256.slice(0, 12) ?? null,
        totalCount: evidence?.totalCount ?? null
      })}`
    )
    if (evidence && predicate(evidence)) return evidence
    await page.waitForTimeout(1_000)
  }
  throw new Error(`Persisted AI drawing evidence timed out for ${fileId}`)
}

const waitForLiveAiDrawingEvidence = async (
  page: Page,
  predicate: (evidence: LiveAiDrawingEvidence) => boolean,
  timeout = 30_000
): Promise<LiveAiDrawingEvidence> => {
  const deadline = Date.now() + timeout
  let latest: LiveAiDrawingEvidence | undefined
  while (Date.now() < deadline) {
    latest = await getLiveAiDrawingEvidence(page)
    if (predicate(latest)) return latest
    await page.waitForTimeout(500)
  }
  throw new Error(
    `Local live AI drawing evidence timed out: ${JSON.stringify(latest)}`
  )
}

const expectLivePeerEvidence = async (
  actorA: Page,
  actorB: Page,
  predicate: (evidence: LiveAiDrawingEvidence) => boolean,
  timeout = 30_000
): Promise<LiveAiDrawingEvidence> => {
  const expected = await waitForLiveAiDrawingEvidence(
    actorA,
    predicate,
    timeout
  )
  const {
    byteLength: expectedByteLength,
    sha256: expectedSha256,
    ...expectedSnapshot
  } = expected
  const expectedSnapshotSerialized = JSON.stringify(expectedSnapshot)
  const deadline = Date.now() + timeout
  let attempt = 0
  let latestPeer: LiveAiDrawingEvidence | undefined
  while (Date.now() < deadline) {
    const attemptStartedAtMs = Date.now()
    latestPeer = await getLiveAiDrawingEvidence(actorB)
    const {
      byteLength: latestPeerByteLength,
      sha256: latestPeerSha256,
      ...latestPeerSnapshot
    } = latestPeer
    const canonicalMatches =
      JSON.stringify(latestPeerSnapshot) === expectedSnapshotSerialized
    const digestMatches =
      canonicalMatches &&
      latestPeerByteLength === expectedByteLength &&
      latestPeerSha256 === expectedSha256
    attempt += 1
    // eslint-disable-next-line no-console
    console.log(
      `AI_CRDT_PEER_LIVE ${JSON.stringify({
        attempt,
        canonicalMatches,
        digestMatches,
        durationMs: Date.now() - attemptStartedAtMs,
        sha256: latestPeerSha256.slice(0, 12),
        totalCount: latestPeerSnapshot.totalCount
      })}`
    )
    if (canonicalMatches && digestMatches) return expected
    const [actorADiagnostics, actorBDiagnostics] = await Promise.all([
      getCollaborationDiagnostics(actorA),
      getCollaborationDiagnostics(actorB)
    ])
    const failedOutcome = [
      ...actorADiagnostics.outcomes,
      ...actorBDiagnostics.outcomes
    ].find(
      ({ status }) => status === 'send-failed' || status === 'process-failed'
    )
    if (
      failedOutcome ||
      actorADiagnostics.status !== 'connected' ||
      actorBDiagnostics.status !== 'connected'
    ) {
      throw new Error(
        `CRDT publication failed before live convergence: ${JSON.stringify({
          actorA: {
            diagnostics: actorADiagnostics,
            live: await getLiveAiDrawingEvidence(actorA)
          },
          actorB: {
            diagnostics: actorBDiagnostics,
            live: await getLiveAiDrawingEvidence(actorB)
          }
        })}`
      )
    }
    await actorA.waitForTimeout(500)
  }
  throw new Error(
    `Live CRDT convergence timed out: ${JSON.stringify({
      actorA: {
        diagnostics: await getCollaborationDiagnostics(actorA),
        live: await getLiveAiDrawingEvidence(actorA)
      },
      actorB: {
        diagnostics: await getCollaborationDiagnostics(actorB),
        live: await getLiveAiDrawingEvidence(actorB)
      }
    })}`
  )
}

const resetPerformanceProfile = async (page: Page) => {
  await page.evaluate(() => {
    if (!window.__AsyraAiDrawingPerformance__) {
      throw new Error('AI drawing performance profile is unavailable')
    }
    window.__AsyraAiDrawingPerformance__.reset()
  })
}

const getPerformanceProfile = async (
  page: Page
): Promise<{
  readonly productDurationMs: number
  readonly snapshot: PerformanceProfileSnapshot
}> => {
  const snapshot = await page.evaluate(
    () => window.__AsyraAiDrawingPerformance__?.snapshot() ?? null
  )
  if (!snapshot) {
    throw new Error('AI drawing performance profile is unavailable')
  }
  const productSample = snapshot.phases.find(
    ({ name }) => name === 'ai-turn:accepted-to-settled'
  )
  if (!productSample) {
    throw new Error('Accepted-to-settled product sample is unavailable')
  }
  return {
    productDurationMs: productSample.durationMs,
    snapshot
  }
}

const observeProgressiveCreation = async (
  actorA: Page,
  actorB: Page,
  isTurnSettled: () => boolean,
  timeout = 300_000
): Promise<ProgressiveCreationEvidence> => {
  const observedElementCounts: number[] = []
  let firstVisibleAtMs: number | undefined
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const [
      actorADiagnostics,
      actorBDiagnostics,
      actorBCanonicalElementCount,
      actorBRenderProjectionCount
    ] = await Promise.all([
      getCollaborationDiagnostics(actorA),
      getCollaborationDiagnostics(actorB),
      getLiveCanonicalElementCount(actorB),
      getAppliedRenderProjectionCount(actorB)
    ])
    if (
      actorBCanonicalElementCount > 0 &&
      actorBCanonicalElementCount < 7076 &&
      actorBRenderProjectionCount > 0 &&
      observedElementCounts.at(-1) !== actorBCanonicalElementCount
    ) {
      firstVisibleAtMs ??= Date.now()
      observedElementCounts.push(actorBCanonicalElementCount)
    }
    const firstPublicationAtMs =
      actorADiagnostics.factoryPublications[0]?.capturedAtMs
    const processedPublicationCount = actorBDiagnostics.outcomes.filter(
      ({ direction, status }) =>
        direction === 'remote' && status === 'processed'
    ).length
    if (
      !isTurnSettled() &&
      firstPublicationAtMs !== undefined &&
      firstVisibleAtMs !== undefined &&
      processedPublicationCount >= 2 &&
      observedElementCounts.length >= 2
    ) {
      return Object.freeze({
        firstPublicationAtMs,
        firstVisibleAtMs,
        observedElementCounts: Object.freeze([...observedElementCounts]),
        peerFirstVisibleMs: firstVisibleAtMs - firstPublicationAtMs,
        processedPublicationCount
      })
    }
    const failedOutcome = [
      ...actorADiagnostics.outcomes,
      ...actorBDiagnostics.outcomes
    ].find(
      ({ status }) => status === 'send-failed' || status === 'process-failed'
    )
    if (
      failedOutcome ||
      actorADiagnostics.status !== 'connected' ||
      actorBDiagnostics.status !== 'connected' ||
      isTurnSettled()
    ) {
      throw new Error(
        `Progressive creation did not expose multiple batches before settlement: ${JSON.stringify(
          {
            actorADiagnostics,
            actorBDiagnostics,
            actorBCanonicalElementCount,
            actorBRenderProjectionCount,
            turnSettled: isTurnSettled(),
            observedElementCounts
          }
        )}`
      )
    }
    await actorA.waitForTimeout(100)
  }

  throw new Error(
    `Progressive creation observation timed out: ${JSON.stringify({
      actorB: await getCollaborationDiagnostics(actorB),
      observedElementCounts
    })}`
  )
}

const openMockAi = async (page: Page) => {
  await page.getByRole('button', { name: 'Open Mock AI' }).click()
  await expect(page.getByTestId('mock-ai-panel')).toBeVisible()
  await expect(page.getByLabel('Message Agent')).toBeFocused()
}

const dropReferenceImage = async (page: Page) => {
  const imageBase64 = (await readFile(referenceImagePath)).toString('base64')
  const dataTransfer = await page.evaluateHandle(
    ({ base64, fileName }) => {
      const bytes = Uint8Array.from(globalThis.atob(base64), (character) =>
        character.charCodeAt(0)
      )
      const transfer = new DataTransfer()
      transfer.items.add(
        new File([bytes], fileName, {
          type: 'image/png'
        })
      )
      return transfer
    },
    {
      base64: imageBase64,
      fileName: referenceImageName
    }
  )
  try {
    const dropTarget = page.getByTestId('agent-image-drop-target')
    await dropTarget.dispatchEvent('dragenter', { dataTransfer })
    await dropTarget.dispatchEvent('dragover', { dataTransfer })
    await dropTarget.dispatchEvent('drop', { dataTransfer })
  } finally {
    await dataTransfer.dispose()
  }
  await expect(
    page.getByRole('img', {
      name: referenceImageName
    })
  ).toBeVisible()
}

const submitTurn = async (
  page: Page,
  intent: string,
  expectedSettledCount: number
) => {
  const input = page.getByLabel('Message Agent')
  await expect(input).toBeEnabled()
  await input.fill(intent)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Working on your request')).toBeVisible()

  const settledTurns = page
    .getByTestId('mock-ai-panel')
    .locator('article[data-turn-id]')
  await expect(settledTurns).toHaveCount(expectedSettledCount, {
    timeout: 300_000
  })
  const turn = settledTurns.last()
  await expect(turn).toHaveAttribute('data-outcome', 'success')
  await expect(turn.getByText('Drawing updated successfully.')).toBeVisible()
  await expect(turn.getByText(/^Elapsed \d/)).toBeVisible()
  return turn
}

const expectPeerSnapshot = async (
  actorA: Page,
  actorB: Page,
  timeout = 300_000
) => {
  const expected = await getCanonicalAiDrawingSnapshot(actorA)
  const expectedSerialized = JSON.stringify(expected)
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const [peer, actorADiagnostics, actorBDiagnostics] = await Promise.all([
      getCanonicalAiDrawingSnapshot(actorB),
      getCollaborationDiagnostics(actorA),
      getCollaborationDiagnostics(actorB)
    ])
    if (JSON.stringify(peer) === expectedSerialized) {
      return expected
    }
    const failedOutcome = [
      ...actorADiagnostics.outcomes,
      ...actorBDiagnostics.outcomes
    ].find(
      ({ status }) => status === 'send-failed' || status === 'process-failed'
    )
    if (
      failedOutcome ||
      actorADiagnostics.status !== 'connected' ||
      actorBDiagnostics.status !== 'connected'
    ) {
      throw new Error(
        `CRDT publication failed before convergence: ${JSON.stringify({
          actorA: actorADiagnostics,
          actorB: actorBDiagnostics
        })}`
      )
    }
    await actorA.waitForTimeout(500)
  }
  throw new Error(
    `CRDT convergence timed out: ${JSON.stringify({
      actorA: await getCollaborationDiagnostics(actorA),
      actorB: await getCollaborationDiagnostics(actorB)
    })}`
  )
}

const captureCheckpoint = async (
  actorA: Page,
  actorB: Page,
  testInfo: TestInfo,
  name: string
) => {
  const actorAPath = `${visualRecordDirectory}${name}-actor-a.png`
  const actorBPath = `${visualRecordDirectory}${name}-actor-b.png`
  await Promise.all([
    actorA.screenshot({ path: actorAPath }),
    actorB.screenshot({ path: actorBPath })
  ])
  await Promise.all([
    testInfo.attach(`${name}-actor-a`, {
      contentType: 'image/png',
      path: actorAPath
    }),
    testInfo.attach(`${name}-actor-b`, {
      contentType: 'image/png',
      path: actorBPath
    })
  ])
}

const createSideBySideRecorder = async (
  context: BrowserContext,
  actorA: Page,
  actorB: Page
) => {
  const page = await context.newPage()
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #111827; }
          main { display: grid; grid-template-columns: 1fr 1fr; width: 100%; height: 100%; gap: 2px; }
          section { position: relative; min-width: 0; background: #0f172a; }
          img { display: block; width: 100%; height: 100%; object-fit: fill; }
          .actor {
            position: absolute; left: 16px; top: 16px; z-index: 2;
            padding: 7px 11px; border-radius: 999px;
            color: #fff; background: rgba(15, 23, 42, .88);
            font: 600 14px/1.2 ui-sans-serif, system-ui, sans-serif;
          }
          #status {
            position: fixed; z-index: 3; left: 50%; bottom: 18px; transform: translateX(-50%);
            min-width: 420px; padding: 10px 16px; border-radius: 10px;
            color: #fff; background: rgba(15, 23, 42, .92); text-align: center;
            font: 600 15px/1.3 ui-sans-serif, system-ui, sans-serif;
            box-shadow: 0 8px 28px rgba(0, 0, 0, .3);
          }
        </style>
      </head>
      <body>
        <main>
          <section><div class="actor">Actor A · Agent operator</div><img id="actor-a" /></section>
          <section><div class="actor">Actor B · CRDT peer</div><img id="actor-b" /></section>
        </main>
        <div id="status">Opening both Asyra Design clients…</div>
      </body>
    </html>
  `)

  let active = true
  let currentStep = 'Opening both Asyra Design clients…'
  const startedAt = Date.now()
  const refresh = async () => {
    while (active) {
      try {
        const [left, right] = await Promise.all([
          actorA.screenshot({ type: 'jpeg', quality: 68 }),
          actorB.screenshot({ type: 'jpeg', quality: 68 })
        ])
        await page.evaluate(
          ({ elapsedSeconds, leftSource, rightSource, step }) => {
            const leftImage =
              document.querySelector<HTMLImageElement>('#actor-a')
            const rightImage =
              document.querySelector<HTMLImageElement>('#actor-b')
            const status = document.querySelector<HTMLDivElement>('#status')
            if (leftImage) leftImage.src = leftSource
            if (rightImage) rightImage.src = rightSource
            if (status) {
              status.textContent = `${step} · ${elapsedSeconds.toFixed(1)}s`
            }
          },
          {
            elapsedSeconds: (Date.now() - startedAt) / 1000,
            leftSource: `data:image/jpeg;base64,${left.toString('base64')}`,
            rightSource: `data:image/jpeg;base64,${right.toString('base64')}`,
            step: currentStep
          }
        )
      } catch {
        // Navigation can briefly make a source page unavailable for capture.
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  const refreshPromise = refresh()

  return {
    page,
    setStep: (step: string) => {
      currentStep = step
    },
    stop: async () => {
      active = false
      await refreshPromise
      await page.waitForTimeout(750)
    }
  }
}

const saveVideo = async (
  context: BrowserContext,
  video: Video | null,
  destination: string
) => {
  await context.close()
  if (!video) {
    throw new Error('The side-by-side recorder did not expose a video')
  }
  await video.saveAs(destination)
}

test('proves the high-detail progressive CRDT flow without generating media', async ({
  browser
}, testInfo) => {
  test.skip(
    process.env.ASYRA_DESIGN_RUN_HIGH_DETAIL_AI_CRDT !== '1',
    'High-detail CRDT correctness is an independent explicit gate.'
  )
  test.setTimeout(600_000)
  const flowStartedAtMs = Date.now()
  const actorAContext = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { height: 720, width: 1280 }
  })
  const actorBContext = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { height: 720, width: 1280 }
  })
  const actorA = await actorAContext.newPage()
  const actorB = await actorBContext.newPage()
  let actorACpuProfile: object | undefined
  let actorACpuProfilePath: string | undefined
  let actorACpuProfileStop: (() => Promise<void>) | undefined
  let actorACpuProfileTimer: ReturnType<typeof setTimeout> | undefined
  let actorBCpuProfile: object | undefined
  let actorBCpuProfilePath: string | undefined
  let actorBCpuProfileStop: (() => Promise<void>) | undefined
  let stopWebSocketPayloadProfile:
    | (() => Promise<WebSocketPayloadProfile>)
    | undefined
  const timings: Record<string, number> = {}
  const productProfiles: Record<
    string,
    {
      readonly productDurationMs: number
      readonly snapshot: PerformanceProfileSnapshot
    }
  > = {}

  try {
    const fileId = `ai-crdt-high-detail-${Date.now()}`
    await Promise.all([
      actorA.goto(profiledCollaborationUrl(fileId)),
      actorB.goto(profiledCollaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(actorA), waitForAppReady(actorB)])
    await Promise.all([
      waitForCollaboration(actorA),
      waitForCollaboration(actorB),
      captureCollaborationOutcomes(actorA),
      captureCollaborationOutcomes(actorB)
    ])
    if (process.env.ASYRA_DESIGN_CAPTURE_WEBSOCKET_PAYLOAD_PROFILE === '1') {
      stopWebSocketPayloadProfile = await startWebSocketPayloadProfile(
        actorAContext,
        actorA
      )
    }
    await openMockAi(actorA)
    await dropReferenceImage(actorA)
    await captureProgressiveRuntimeEvidence(actorA)
    const actorBPersistenceBaseline = await getPersistedAiDrawingEvidence(
      actorB,
      fileId
    )
    const [actorATransactionBaseline, actorBTransactionBaseline] =
      await Promise.all([
        getTransactionSnapshot(actorA),
        getTransactionSnapshot(actorB)
      ])
    const expectActorBPersistenceUnchanged = async (checkpoint: string) => {
      expect(
        await getPersistedAiDrawingEvidence(actorB, fileId),
        `Actor B persistence changed after ${checkpoint}`
      ).toEqual(actorBPersistenceBaseline)
    }

    if (process.env.ASYRA_DESIGN_CAPTURE_RENDERER_CPU_PROFILE === '1') {
      const actorASession = await actorAContext.newCDPSession(actorA)
      await actorASession.send('Profiler.enable')
      await actorASession.send('Profiler.setSamplingInterval', {
        interval: 1_000
      })
      await actorASession.send('Profiler.start')
      let stopPromise: Promise<void> | undefined
      actorACpuProfileStop = () => {
        stopPromise ??= (async () => {
          const { profile } = await actorASession.send('Profiler.stop')
          actorACpuProfile = profile
          actorACpuProfilePath = testInfo.outputPath(
            'actor-a-renderer.cpuprofile'
          )
          await writeFile(
            actorACpuProfilePath,
            JSON.stringify(actorACpuProfile)
          )
          await actorASession.send('Profiler.disable')
        })()
        return stopPromise
      }

      const actorBSession = await actorBContext.newCDPSession(actorB)
      await actorBSession.send('Profiler.enable')
      await actorBSession.send('Profiler.setSamplingInterval', {
        interval: 1_000
      })
      await actorBSession.send('Profiler.start')
      let stopActorBPromise: Promise<void> | undefined
      actorBCpuProfileStop = () => {
        stopActorBPromise ??= (async () => {
          const { profile } = await actorBSession.send('Profiler.stop')
          actorBCpuProfile = profile
          actorBCpuProfilePath = testInfo.outputPath(
            'actor-b-renderer.cpuprofile'
          )
          await writeFile(
            actorBCpuProfilePath,
            JSON.stringify(actorBCpuProfile)
          )
          await actorBSession.send('Profiler.disable')
        })()
        return stopActorBPromise
      }
      actorACpuProfileTimer = setTimeout(() => {
        void actorACpuProfileStop?.()
        void actorBCpuProfileStop?.()
      }, 45_000)
    }

    await Promise.all([
      resetPerformanceProfile(actorA),
      resetPerformanceProfile(actorB)
    ])
    const creationStartedAtMs = Date.now()
    // eslint-disable-next-line no-console
    console.log('AI_CRDT_PHASE creation-submitted')
    const createdTurnPromise = submitTurn(actorA, exactCatOnlyPrompt, 1)
    let createdTurnSettled = false
    void createdTurnPromise.then(
      () => {
        createdTurnSettled = true
      },
      () => {
        createdTurnSettled = true
      }
    )
    void createdTurnPromise.catch(() => undefined)
    const progressiveCreation = await observeProgressiveCreation(
      actorA,
      actorB,
      () => createdTurnSettled
    )
    // eslint-disable-next-line no-console
    console.log(
      `AI_CRDT_PHASE progressive-visible ${JSON.stringify(progressiveCreation)}`
    )
    await createdTurnPromise
    const actorASettledAtMs = Date.now()
    productProfiles.creation = await getPerformanceProfile(actorA)
    // eslint-disable-next-line no-console
    console.log(
      `AI_CRDT_PHASE creation-settled ${Math.round(
        productProfiles.creation.productDurationMs
      )}`
    )
    const creationCommit = (
      await getCollaborationDiagnostics(actorA)
    ).factoryCommits.find(({ origin }) => origin === 'action')
    if (!creationCommit) {
      throw new Error('Actor A canonical creation commit evidence is missing')
    }
    const creationConvergenceDeadlineMs = creationCommit.capturedAtMs + 30_000
    const remainingCreationConvergenceMs = () =>
      Math.max(1, creationConvergenceDeadlineMs - Date.now())
    await waitForAppliedRenderProjection(
      actorB,
      (count) => count >= 7076,
      remainingCreationConvergenceMs(),
      actorA
    )
    const created = await expectLivePeerEvidence(
      actorA,
      actorB,
      ({ totalCount }) => totalCount === 7076,
      remainingCreationConvergenceMs()
    )
    const createdConvergedAtMs = Date.now()
    const actorACreated = await waitForPersistedAiDrawingEvidence(
      actorA,
      fileId,
      ({ totalCount }) => totalCount === 7076
    )
    expect(canonicalSummary(actorACreated)).toEqual(canonicalSummary(created))
    // eslint-disable-next-line no-console
    console.log(`AI_CRDT_PHASE actor-a-persisted ${actorACreated.totalCount}`)
    await expectActorBPersistenceUnchanged('creation')
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorATransactionBaseline.undoCount + 1
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBTransactionBaseline.undoCount
    )
    // eslint-disable-next-line no-console
    console.log('AI_CRDT_PHASE creation-converged')

    expect(
      progressiveCreation.observedElementCounts.length
    ).toBeGreaterThanOrEqual(2)
    expect(
      progressiveCreation.observedElementCounts.every(
        (count, index, counts) => index === 0 || count > counts[index - 1]
      )
    ).toBe(true)
    expect(progressiveCreation.peerFirstVisibleMs).toBeGreaterThanOrEqual(0)
    expect(progressiveCreation.peerFirstVisibleMs).toBeLessThanOrEqual(2_000)
    expect(created).toMatchObject({
      groupCount: 1,
      totalCount: 7076,
      vectorCount: 7075
    })
    expect(created.pointCount).toBeGreaterThan(100_000)
    expect(created.whiteBackgrounds).toHaveLength(1)
    expect(created.whiteBackgrounds[0]).toMatchObject({
      height: 941,
      width: 1672
    })
    expect(productProfiles.creation.snapshot.runtime).toBe('production')
    expect(productProfiles.creation.snapshot.releaseEvidenceEligible).toBe(true)
    timings.creationHarnessMs = actorASettledAtMs - creationStartedAtMs
    timings.creationProductMs = productProfiles.creation.productDurationMs
    timings.creationPeerConvergenceMs =
      createdConvergedAtMs - creationCommit.capturedAtMs

    await Promise.all([
      resetPerformanceProfile(actorA),
      resetPerformanceProfile(actorB)
    ])
    const whiskerStartedAtMs = Date.now()
    await submitTurn(actorA, 'make the whiskers blue', 2)
    const whiskerSettledAtMs = Date.now()
    productProfiles.blueWhiskers = await getPerformanceProfile(actorA)
    await waitForAppliedRenderProjection(actorB, (count) => count > 0, 5_000)
    const blueWhiskers = await expectLivePeerEvidence(
      actorA,
      actorB,
      ({ blueStrokeIds }) => blueStrokeIds.length >= 2
    )
    const actorABlueWhiskers = await waitForPersistedAiDrawingEvidence(
      actorA,
      fileId,
      ({ blueStrokeIds }) => blueStrokeIds.length >= 2
    )
    expect(canonicalSummary(actorABlueWhiskers)).toEqual(
      canonicalSummary(blueWhiskers)
    )
    const whiskerConvergedAtMs = Date.now()
    await expectActorBPersistenceUnchanged('blue-whiskers follow-up')
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorATransactionBaseline.undoCount + 2
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBTransactionBaseline.undoCount
    )
    // eslint-disable-next-line no-console
    console.log('AI_CRDT_PHASE whiskers-converged')
    expect(blueWhiskers.ids).toEqual(created.ids)
    expect(blueWhiskers.totalCount).toBe(created.totalCount)
    expect(blueWhiskers.pointCount).toBe(created.pointCount)
    expect(blueWhiskers.blueStrokeIds.length).toBeGreaterThanOrEqual(2)
    timings.blueWhiskerHarnessMs = whiskerSettledAtMs - whiskerStartedAtMs
    timings.blueWhiskerProductMs =
      productProfiles.blueWhiskers.productDurationMs
    timings.blueWhiskerPeerConvergenceMs =
      whiskerConvergedAtMs - whiskerSettledAtMs

    await Promise.all([
      resetPerformanceProfile(actorA),
      resetPerformanceProfile(actorB)
    ])
    const pupilStartedAtMs = Date.now()
    await submitTurn(actorA, 'make the pupils red', 3)
    const pupilSettledAtMs = Date.now()
    productProfiles.redPupils = await getPerformanceProfile(actorA)
    await waitForAppliedRenderProjection(actorB, (count) => count > 0, 5_000)
    const redPupils = await expectLivePeerEvidence(
      actorA,
      actorB,
      ({ redFillIds }) => redFillIds.length === 2
    )
    const actorARedPupils = await waitForPersistedAiDrawingEvidence(
      actorA,
      fileId,
      ({ redFillIds }) => redFillIds.length === 2
    )
    expect(canonicalSummary(actorARedPupils)).toEqual(
      canonicalSummary(redPupils)
    )
    const pupilConvergedAtMs = Date.now()
    await expectActorBPersistenceUnchanged('red-pupils follow-up')
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorATransactionBaseline.undoCount + 3
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBTransactionBaseline.undoCount
    )
    // eslint-disable-next-line no-console
    console.log('AI_CRDT_PHASE pupils-converged')
    expect(redPupils.ids).toEqual(created.ids)
    expect(redPupils.totalCount).toBe(created.totalCount)
    expect(redPupils.pointCount).toBe(created.pointCount)
    expect(redPupils.blueStrokeIds).toEqual(blueWhiskers.blueStrokeIds)
    expect(redPupils.redFillIds).toHaveLength(2)
    timings.redPupilHarnessMs = pupilSettledAtMs - pupilStartedAtMs
    timings.redPupilProductMs = productProfiles.redPupils.productDurationMs
    timings.redPupilPeerConvergenceMs = pupilConvergedAtMs - pupilSettledAtMs

    await undo(actorB)
    expect(await getLiveAiDrawingEvidence(actorB)).toEqual(redPupils)
    expect(await getLiveAiDrawingEvidence(actorA)).toEqual(redPupils)
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBTransactionBaseline.undoCount
    )
    expect((await getPersistedAiDrawingEvidence(actorA, fileId))?.sha256).toBe(
      actorARedPupils.sha256
    )
    await expectActorBPersistenceUnchanged('Actor B no-op undo')

    await actorA.getByRole('button', { name: 'Undo AI change' }).click()
    await expect(
      actorA.getByRole('button', { name: 'Redo AI change' })
    ).toBeVisible()
    const undonePupils = await expectLivePeerEvidence(
      actorA,
      actorB,
      (evidence) =>
        evidence.redFillIds.length === 0 &&
        evidence.blueStrokeIds.length === blueWhiskers.blueStrokeIds.length
    )
    const actorAUndonePupils = await waitForPersistedAiDrawingEvidence(
      actorA,
      fileId,
      (evidence) =>
        evidence.redFillIds.length === 0 &&
        evidence.blueStrokeIds.length === blueWhiskers.blueStrokeIds.length
    )
    expect(canonicalSummary(actorAUndonePupils)).toEqual(
      canonicalSummary(undonePupils)
    )
    expect(actorAUndonePupils.sha256).toBe(actorABlueWhiskers.sha256)
    await expectActorBPersistenceUnchanged('Actor A undo')
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorATransactionBaseline.undoCount + 2
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBTransactionBaseline.undoCount
    )
    expect(undonePupils.ids).toEqual(created.ids)
    expect(undonePupils.pointCount).toBe(created.pointCount)

    await actorA.getByRole('button', { name: 'Redo AI change' }).click()
    await expect(
      actorA.getByRole('button', { name: 'Undo AI change' })
    ).toBeVisible()
    const redonePupils = await expectLivePeerEvidence(
      actorA,
      actorB,
      ({ sha256 }) => sha256 === redPupils.sha256
    )
    const actorARedonePupils = await waitForPersistedAiDrawingEvidence(
      actorA,
      fileId,
      ({ redFillIds }) => redFillIds.length === 2
    )
    expect(canonicalSummary(actorARedonePupils)).toEqual(
      canonicalSummary(redonePupils)
    )
    expect(actorARedonePupils.sha256).toBe(actorARedPupils.sha256)
    await expectActorBPersistenceUnchanged('Actor A redo')
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorATransactionBaseline.undoCount + 3
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBTransactionBaseline.undoCount
    )
    expect(redonePupils).toEqual(redPupils)

    timings.fullFlowHarnessMs = Date.now() - flowStartedAtMs
    timings.fullFlowProductMs = Object.values(productProfiles).reduce(
      (total, { productDurationMs }) => total + productDurationMs,
      0
    )

    expect(timings.creationProductMs).toBeLessThanOrEqual(30_000)
    expect(timings.creationPeerConvergenceMs).toBeLessThanOrEqual(30_000)
    expect(timings.blueWhiskerPeerConvergenceMs).toBeLessThanOrEqual(5_000)
    expect(timings.redPupilPeerConvergenceMs).toBeLessThanOrEqual(5_000)
    expect(timings.fullFlowProductMs).toBeLessThanOrEqual(120_000)
    expect(timings.fullFlowHarnessMs).toBeLessThanOrEqual(180_000)
    const outcomes = [
      ...(await getCollaborationDiagnostics(actorA)).outcomes,
      ...(await getCollaborationDiagnostics(actorB)).outcomes
    ]
    expect(
      outcomes.some(
        ({ status }) => status === 'send-failed' || status === 'process-failed'
      )
    ).toBe(false)
    await testInfo.attach('high-detail-crdt-timing-summary.json', {
      body: JSON.stringify(
        {
          canonical: {
            created,
            redPupils,
            redonePupils,
            undonePupils
          },
          productProfiles,
          progressiveCreation,
          timings
        },
        null,
        2
      ),
      contentType: 'application/json'
    })
  } finally {
    if (stopWebSocketPayloadProfile) {
      const payloadProfile = await stopWebSocketPayloadProfile()
      // eslint-disable-next-line no-console
      console.log(
        `AI_CRDT_WEBSOCKET_PAYLOAD_PROFILE ${JSON.stringify(payloadProfile)}`
      )
      await testInfo.attach('actor-a-websocket-payload-profile.json', {
        body: JSON.stringify(payloadProfile, null, 2),
        contentType: 'application/json'
      })
    }
    if (actorACpuProfileTimer) {
      clearTimeout(actorACpuProfileTimer)
    }
    if (actorACpuProfileStop) {
      await actorACpuProfileStop()
    }
    if (actorBCpuProfileStop) {
      await actorBCpuProfileStop()
    }
    if (actorACpuProfilePath) {
      await testInfo.attach('actor-a-renderer.cpuprofile', {
        contentType: 'application/json',
        path: actorACpuProfilePath
      })
    }
    if (actorBCpuProfilePath) {
      await testInfo.attach('actor-b-renderer.cpuprofile', {
        contentType: 'application/json',
        path: actorBCpuProfilePath
      })
    }
    await Promise.all([actorAContext.close(), actorBContext.close()])
  }
})

test('records two live CRDT clients while Agent creates and incrementally edits the same cat', async ({
  browser
}, testInfo) => {
  test.skip(
    process.env.ASYRA_DESIGN_RUN_AI_CRDT_VIDEO !== '1',
    'The dual-client AI recording is an explicit resource-aware visual gate.'
  )
  test.setTimeout(900_000)
  await mkdir(visualRecordDirectory, { recursive: true })

  const actorAContext = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { height: 720, width: 1280 }
  })
  const actorBContext = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { height: 720, width: 1280 }
  })
  const actorA = await actorAContext.newPage()
  const actorB = await actorBContext.newPage()
  const recorderContext = await browser.newContext({
    deviceScaleFactor: 1,
    recordVideo: {
      dir: testInfo.outputPath('side-by-side-video'),
      size: { height: 720, width: 2560 }
    },
    viewport: { height: 720, width: 2560 }
  })
  const recorder = await createSideBySideRecorder(
    recorderContext,
    actorA,
    actorB
  )
  const video = recorder.page.video()
  const videoPath = `${visualRecordDirectory}ai-cat-crdt-progressive-side-by-side.webm`
  const timeline: TimelineEntry[] = []
  let progressiveCreation: ProgressiveCreationEvidence | null = null

  try {
    const fileId = `ai-crdt-video-${Date.now()}`
    recorder.setStep('Opening Asyra Design in two independent actor contexts')
    await Promise.all([
      actorA.goto(collaborationUrl(fileId)),
      actorB.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(actorA), waitForAppReady(actorB)])
    await Promise.all([
      waitForCollaboration(actorA),
      waitForCollaboration(actorB)
    ])
    await Promise.all([
      captureCollaborationOutcomes(actorA),
      captureCollaborationOutcomes(actorB)
    ])
    await captureProgressiveRuntimeEvidence(actorA)

    recorder.setStep('Opening the Agent panel on Actor A')
    await openMockAi(actorA)
    recorder.setStep('Dragging the local tabby reference into the Agent panel')
    await dropReferenceImage(actorA)
    recorder.setStep('Framing the complete 1672 × 941 output before drawing')
    const [actorAFrame, actorBFrame] = await Promise.all([
      prepareCompleteCatViewport(actorA),
      prepareCompleteCatViewport(actorB)
    ])
    expect(actorAFrame.scale).toBeGreaterThan(0)
    expect(actorAFrame.scale).toBeLessThan(1)
    expect(actorBFrame.scale).toBeGreaterThan(0)
    expect(actorBFrame.scale).toBeLessThan(1)

    const actorABefore = await getTransactionSnapshot(actorA)
    const actorBBefore = await getTransactionSnapshot(actorB)
    recorder.setStep(
      'Drawing only the cat on a same-size pure white background'
    )
    const createdTurnPromise = submitTurn(actorA, exactCatOnlyPrompt, 1)
    let createdTurnSettled = false
    void createdTurnPromise.then(
      () => {
        createdTurnSettled = true
      },
      () => {
        createdTurnSettled = true
      }
    )
    void createdTurnPromise.catch(() => undefined)
    progressiveCreation = await observeProgressiveCreation(
      actorA,
      actorB,
      () => createdTurnSettled
    )
    recorder.setStep(
      `Peer is drawing progressively across ${progressiveCreation.processedPublicationCount} canonical publications`
    )
    await captureCheckpoint(
      actorA,
      actorB,
      testInfo,
      'progressive-00-in-progress'
    )
    const createdTurn = await createdTurnPromise
    const created = await expectPeerSnapshot(actorA, actorB, 600_000)
    expect(created).toMatchObject({
      groupCount: 1,
      totalCount: 7076,
      vectorCount: 7075
    })
    expect(created.pointCount).toBeGreaterThan(100_000)
    expect(created.whiteBackgrounds).toHaveLength(1)
    expect(created.whiteBackgrounds[0]).toMatchObject({
      height: 941,
      width: 1672
    })
    expect(created.blueStrokeIds).toEqual([])
    expect(created.redFillIds).toEqual([])
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorABefore.undoCount + 1
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBBefore.undoCount
    )
    timeline.push({
      actorAElapsed: await createdTurn.getByText(/^Elapsed \d/).innerText(),
      capturedAtMs: Date.now(),
      step: 'created'
    })
    recorder.setStep('Creation converged on both CRDT actors')
    await captureCheckpoint(actorA, actorB, testInfo, 'progressive-01-created')

    recorder.setStep('Changing the existing whiskers to blue')
    const whiskerTurn = await submitTurn(actorA, 'make the whiskers blue', 2)
    const blueWhiskers = await expectPeerSnapshot(actorA, actorB)
    expect(blueWhiskers.ids).toEqual(created.ids)
    expect(blueWhiskers.totalCount).toBe(created.totalCount)
    expect(blueWhiskers.pointCount).toBe(created.pointCount)
    expect(blueWhiskers.blueStrokeIds.length).toBeGreaterThanOrEqual(2)
    expect(blueWhiskers.redFillIds).toEqual([])
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorABefore.undoCount + 2
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBBefore.undoCount
    )
    timeline.push({
      actorAElapsed: await whiskerTurn.getByText(/^Elapsed \d/).innerText(),
      capturedAtMs: Date.now(),
      step: 'blue-whiskers'
    })
    recorder.setStep('Blue whiskers converged on both CRDT actors')
    await captureCheckpoint(
      actorA,
      actorB,
      testInfo,
      'progressive-02-blue-whiskers'
    )

    recorder.setStep('Changing the existing pupils to red')
    const pupilTurn = await submitTurn(actorA, 'make the pupils red', 3)
    const redPupils = await expectPeerSnapshot(actorA, actorB)
    expect(redPupils.ids).toEqual(created.ids)
    expect(redPupils.totalCount).toBe(created.totalCount)
    expect(redPupils.pointCount).toBe(created.pointCount)
    expect(redPupils.blueStrokeIds).toEqual(blueWhiskers.blueStrokeIds)
    expect(redPupils.redFillIds).toHaveLength(2)
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorABefore.undoCount + 3
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBBefore.undoCount
    )
    timeline.push({
      actorAElapsed: await pupilTurn.getByText(/^Elapsed \d/).innerText(),
      capturedAtMs: Date.now(),
      step: 'red-pupils'
    })
    recorder.setStep('Red pupils converged; ending the CRDT test')
    await captureCheckpoint(
      actorA,
      actorB,
      testInfo,
      'progressive-03-red-pupils'
    )
    await writeFile(
      `${visualRecordDirectory}progressive-timeline.json`,
      `${JSON.stringify({ progressiveCreation, timeline }, null, 2)}\n`,
      'utf8'
    )
  } finally {
    await recorder.stop()
    await saveVideo(recorderContext, video, videoPath)
    await Promise.all([actorAContext.close(), actorBContext.close()])
  }

  await testInfo.attach('ai-cat-crdt-progressive-side-by-side', {
    contentType: 'video/webm',
    path: videoPath
  })
})

import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type TestInfo
} from '@playwright/test'
import { Buffer } from 'node:buffer'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { decodeProfiledWebSocketFrame } from '../src/collaboration/websocket-profile-frame'
import { getUndoHistoryDepth, undo, waitForAppReady } from './test-utils'
import { seedAsyraDesignServerResponse } from './server-response-inbox'

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
}

interface FactoryCommitEvidence {
  readonly capturedAtMs: number
  readonly origin: string
  readonly transactionId: number
  readonly undoableChangeCount: number
}

interface DiagnosticErrorEvidence {
  readonly message: string
  readonly name: string
}

interface FactoryTransactionStatusEvidence {
  readonly capturedAtMs: number
  readonly changeCount: number
  readonly error?: DiagnosticErrorEvidence | string
  readonly failure?: {
    readonly cause?: DiagnosticErrorEvidence | string
    readonly kind: string
    readonly message?: string
  }
  readonly nonRollbackableChangeCount: number
  readonly origin: string
  readonly rollbackableChangeCount: number
  readonly status: string
  readonly transactionId: number
  readonly undoableChangeCount: number
}

interface PersistedAiDrawingEvidence extends CanonicalAiDrawingSnapshot {
  readonly byteLength: number
  readonly sha256: string
}

interface LiveAiDrawingEvidence extends CanonicalAiDrawingSnapshot {
  readonly byteLength: number
  readonly sha256: string
}

interface LiveHierarchyEvidence {
  readonly children?: readonly string[]
  readonly id: string
  readonly parentId: string
  readonly type: string
}

interface CanonicalElementFingerprint {
  readonly computedByteLength: number
  readonly computedHash: string
  readonly id: string
  readonly rawByteLength: number
  readonly rawHash: string
  readonly rendered: boolean
  readonly type: string
}

interface CanonicalElementDetail {
  readonly computed: unknown
  readonly raw: unknown
  readonly rendered: boolean
  readonly type: string
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
const RUN_HIGH_DETAIL_CRDT =
  process.env.ASYRA_DESIGN_RUN_HIGH_DETAIL_AI_CRDT === '1'
const CAPTURE_HIGH_DETAIL_CRDT_VISUAL_REVIEW =
  process.env.ASYRA_DESIGN_CAPTURE_AI_CRDT_VISUAL_REVIEW === '1'
const recordingWindowWidth = 1280
const recordingWindowHeight = 500
const recordingWindowLeft = 224
const recordingWindowTop = 33
const recordingOperationDeadlineMs = 300_000

const collaborationUrl = (fileId: string) =>
  `/?fileId=${encodeURIComponent(fileId)}`

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
        slices?: unknown
      }
      publicationCount += 1
      totalPublicationBytes += Buffer.byteLength(JSON.stringify(publication))
      if (typeof publication.publicationId === 'string') {
        if (publicationIds.has(publication.publicationId)) {
          duplicatePublicationIdCount += 1
        }
        publicationIds.add(publication.publicationId)
      }
      if (!Array.isArray(publication.slices)) return
      const routedDeliveries = publication.slices.flatMap((sliceValue) => {
        if (!sliceValue || typeof sliceValue !== 'object') return []
        const slice = sliceValue as { batches?: unknown }
        if (!Array.isArray(slice.batches)) return []
        return slice.batches.flatMap((batchValue) => {
          if (!batchValue || typeof batchValue !== 'object') return []
          const batch = batchValue as {
            channel?: unknown
            deliveries?: unknown
          }
          if (!Array.isArray(batch.deliveries)) return []
          return batch.deliveries.map((deliveryValue) => ({
            channel: batch.channel,
            deliveryValue
          }))
        })
      })
      routedDeliveries.forEach(({ channel, deliveryValue }) => {
        if (!deliveryValue || typeof deliveryValue !== 'object') return
        const delivery = deliveryValue as {
          deliveryId?: unknown
          eventName?: unknown
          payload?: unknown
        }
        const bytes = Buffer.byteLength(JSON.stringify(delivery))
        totalDeliveryBytes += bytes
        const route = `${String(channel)}/${String(delivery.eventName)}`
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
      __aiFactoryStatuses?: FactoryTransactionStatusEvidence[]
    }
    runtime.__aiCreateDeliveryModes = []
    runtime.__aiFactoryCommits = []
    runtime.__aiFactoryPublications = []
    runtime.__aiFactoryStatuses = []
    if (window.__AsyraAiDrawingPerformance__) {
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = window as any
    const factory = scope.__Core__?.deps?.factory
    if (!factory) {
      throw new Error('Progressive runtime evidence owners are unavailable')
    }
    const serializeError = (
      value: unknown
    ): DiagnosticErrorEvidence | string | undefined => {
      if (value === undefined) return undefined
      if (value instanceof Error) {
        return {
          message: value.message,
          name: value.name
        }
      }
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        return String(value)
      }
      const candidate = value as { message?: unknown; name?: unknown }
      if (
        typeof candidate.message === 'string' ||
        typeof candidate.name === 'string'
      ) {
        return {
          message:
            typeof candidate.message === 'string'
              ? candidate.message
              : String(value),
          name: typeof candidate.name === 'string' ? candidate.name : 'Error'
        }
      }
      return String(value)
    }
    factory.subscribeToTransactionStatus(
      (status: {
        changeCount: number
        error?: unknown
        failure?: {
          cause?: unknown
          kind: string
          message?: string
        }
        nonRollbackableChangeCount: number
        origin: string
        rollbackableChangeCount: number
        status: string
        timestamp: number
        transactionId: number
        undoableChangeCount: number
      }) => {
        runtime.__aiFactoryStatuses?.push({
          capturedAtMs: status.timestamp,
          changeCount: status.changeCount,
          ...(status.error === undefined
            ? {}
            : { error: serializeError(status.error) }),
          ...(status.failure
            ? {
                failure: {
                  ...(status.failure.cause === undefined
                    ? {}
                    : { cause: serializeError(status.failure.cause) }),
                  kind: status.failure.kind,
                  ...(status.failure.message === undefined
                    ? {}
                    : { message: status.failure.message })
                }
              }
            : {}),
          nonRollbackableChangeCount: status.nonRollbackableChangeCount,
          origin: status.origin,
          rollbackableChangeCount: status.rollbackableChangeCount,
          status: status.status,
          transactionId: status.transactionId,
          undoableChangeCount: status.undoableChangeCount
        })
      }
    )
    factory.subscribeToSharedPublication(
      (publication: {
        publicationId: string
        slices: readonly {
          batches: readonly { deliveries: readonly unknown[] }[]
        }[]
      }) => {
        runtime.__aiFactoryPublications?.push({
          capturedAtMs: performance.timeOrigin + performance.now(),
          deliveryCount: publication.slices.reduce(
            (sliceTotal, slice) =>
              sliceTotal +
              slice.batches.reduce(
                (batchTotal, batch) => batchTotal + batch.deliveries.length,
                0
              ),
            0
          ),
          publicationId: publication.publicationId
        })
      }
    )
    factory.subscribeToTransactionStatus(
      (status: {
        origin: string
        status: string
        timestamp: number
        transactionId: number
        undoableChangeCount: number
      }) => {
        if (status.status !== 'committed') return
        runtime.__aiFactoryCommits?.push({
          capturedAtMs: status.timestamp,
          origin: status.origin,
          transactionId: status.transactionId,
          undoableChangeCount: status.undoableChangeCount
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
      __aiFactoryStatuses?: FactoryTransactionStatusEvidence[]
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
      factoryStatuses:
        profileEvidence?.factoryStatuses ?? runtime.__aiFactoryStatuses ?? [],
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

const getCanonicalElementFingerprints = (
  page: Page
): Promise<readonly CanonicalElementFingerprint[]> =>
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
    const normalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(normalize)
      if (!value || typeof value !== 'object') return value
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)])
      )
    }
    const fingerprint = (value: unknown) => {
      const serialized = JSON.stringify(normalize(value))
      let hash = 0x811c9dc5
      for (let index = 0; index < serialized.length; index += 1) {
        hash = Math.imul(hash ^ serialized.charCodeAt(index), 0x01000193)
      }
      return {
        byteLength: new TextEncoder().encode(serialized).byteLength,
        hash: (hash >>> 0).toString(16).padStart(8, '0')
      }
    }

    return canonicalElements
      .filter(({ type }) => type !== 'workspace')
      .map(({ computed, id, raw, rendered, type }) => {
        const computedFingerprint = fingerprint(computed)
        const rawFingerprint = fingerprint(raw)
        return {
          computedByteLength: computedFingerprint.byteLength,
          computedHash: computedFingerprint.hash,
          id,
          rawByteLength: rawFingerprint.byteLength,
          rawHash: rawFingerprint.hash,
          rendered,
          type
        }
      })
      .sort((left, right) => left.id.localeCompare(right.id))
  })

const getCanonicalElementDetail = (
  page: Page,
  elementId: string
): Promise<CanonicalElementDetail | null> =>
  page.evaluate((targetId) => {
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
    const element = canonicalElements.find(({ id }) => id === targetId)
    if (!element) return null
    const normalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(normalize)
      if (!value || typeof value !== 'object') return value
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)])
      )
    }
    return {
      computed: normalize(element.computed),
      raw: normalize(element.raw),
      rendered: element.rendered,
      type: element.type
    }
  }, elementId)

const summarizeDifferenceValue = (value: unknown): unknown => {
  if (value === undefined) return '<undefined>'
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && value.length > 160
      ? `${value.slice(0, 160)}…`
      : value
  }
  if (Array.isArray(value)) {
    return {
      kind: 'array',
      length: value.length,
      sample: value.slice(0, 5)
    }
  }
  const keys = Object.keys(value)
  return {
    kind: 'object',
    keyCount: keys.length,
    keys: keys.slice(0, 10)
  }
}

const findFirstValueDifference = (
  actorA: unknown,
  actorB: unknown,
  path: string
):
  | Readonly<{
      actorA: unknown
      actorB: unknown
      path: string
    }>
  | undefined => {
  if (Object.is(actorA, actorB)) return
  if (
    actorA === null ||
    actorB === null ||
    typeof actorA !== 'object' ||
    typeof actorB !== 'object'
  ) {
    return {
      actorA: summarizeDifferenceValue(actorA),
      actorB: summarizeDifferenceValue(actorB),
      path
    }
  }
  if (Array.isArray(actorA) || Array.isArray(actorB)) {
    if (!Array.isArray(actorA) || !Array.isArray(actorB)) {
      return {
        actorA: summarizeDifferenceValue(actorA),
        actorB: summarizeDifferenceValue(actorB),
        path
      }
    }
    if (actorA.length !== actorB.length) {
      return {
        actorA: { length: actorA.length },
        actorB: { length: actorB.length },
        path: `${path}.length`
      }
    }
    for (let index = 0; index < actorA.length; index += 1) {
      const difference = findFirstValueDifference(
        actorA[index],
        actorB[index],
        `${path}[${index}]`
      )
      if (difference) return difference
    }
    return
  }
  const actorARecord = actorA as Record<string, unknown>
  const actorBRecord = actorB as Record<string, unknown>
  const actorAKeys = Object.keys(actorARecord).sort()
  const actorBKeys = Object.keys(actorBRecord).sort()
  if (
    actorAKeys.length !== actorBKeys.length ||
    actorAKeys.some((key, index) => key !== actorBKeys[index])
  ) {
    return {
      actorA: { keyCount: actorAKeys.length, keys: actorAKeys.slice(0, 20) },
      actorB: { keyCount: actorBKeys.length, keys: actorBKeys.slice(0, 20) },
      path: `${path}.__keys__`
    }
  }
  for (const key of actorAKeys) {
    const difference = findFirstValueDifference(
      actorARecord[key],
      actorBRecord[key],
      `${path}.${key}`
    )
    if (difference) return difference
  }
}

const getFirstCanonicalDifference = async (actorA: Page, actorB: Page) => {
  const [actorAFingerprints, actorBFingerprints] = await Promise.all([
    getCanonicalElementFingerprints(actorA),
    getCanonicalElementFingerprints(actorB)
  ])
  if (actorAFingerprints.length !== actorBFingerprints.length) {
    return {
      actorACount: actorAFingerprints.length,
      actorBCount: actorBFingerprints.length,
      kind: 'element-count'
    }
  }
  for (let index = 0; index < actorAFingerprints.length; index += 1) {
    const actorAFingerprint = actorAFingerprints[index]
    const actorBFingerprint = actorBFingerprints[index]
    if (!actorAFingerprint || !actorBFingerprint) continue
    if (actorAFingerprint.id !== actorBFingerprint.id) {
      return {
        actorAId: actorAFingerprint.id,
        actorBId: actorBFingerprint.id,
        index,
        kind: 'element-id'
      }
    }
    if (
      actorAFingerprint.type === actorBFingerprint.type &&
      actorAFingerprint.rendered === actorBFingerprint.rendered &&
      actorAFingerprint.rawHash === actorBFingerprint.rawHash &&
      actorAFingerprint.rawByteLength === actorBFingerprint.rawByteLength &&
      actorAFingerprint.computedHash === actorBFingerprint.computedHash &&
      actorAFingerprint.computedByteLength ===
        actorBFingerprint.computedByteLength
    ) {
      continue
    }
    const [actorADetail, actorBDetail] = await Promise.all([
      getCanonicalElementDetail(actorA, actorAFingerprint.id),
      getCanonicalElementDetail(actorB, actorBFingerprint.id)
    ])
    return {
      difference: findFirstValueDifference(
        actorADetail,
        actorBDetail,
        'element'
      ),
      elementId: actorAFingerprint.id,
      fingerprints: {
        actorA: actorAFingerprint,
        actorB: actorBFingerprint
      },
      kind: 'element-state'
    }
  }
  return {
    kind: 'aggregate-only',
    note: 'No per-element fingerprint difference was found.'
  }
}

const summarizeLiveEvidence = (evidence: LiveAiDrawingEvidence | undefined) =>
  evidence
    ? {
        blueStrokeCount: evidence.blueStrokeIds.length,
        byteLength: evidence.byteLength,
        firstId: evidence.ids[0] ?? null,
        groupCount: evidence.groupCount,
        lastId: evidence.ids.at(-1) ?? null,
        pointCount: evidence.pointCount,
        redFillCount: evidence.redFillIds.length,
        sha256: evidence.sha256.slice(0, 16),
        totalCount: evidence.totalCount,
        vectorCount: evidence.vectorCount,
        whiteBackgroundCount: evidence.whiteBackgrounds.length
      }
    : null

const summarizeCollaborationDiagnostics = (
  diagnostics: Awaited<ReturnType<typeof getCollaborationDiagnostics>>
) => ({
  actionCommitCount: diagnostics.factoryCommits.filter(
    ({ origin }) => origin === 'action'
  ).length,
  failedOutcomes: diagnostics.outcomes
    .filter(
      ({ status }) => status === 'send-failed' || status === 'process-failed'
    )
    .slice(-5),
  lastOutcomes: diagnostics.outcomes.slice(-5).map((outcome) => ({
    direction: outcome.direction,
    publicationId: outcome.publicationId,
    status: outcome.status
  })),
  outcomeCount: diagnostics.outcomes.length,
  publicationCount: diagnostics.factoryPublications.length,
  remoteCommitCount: diagnostics.factoryCommits.filter(
    ({ origin }) => origin === 'remote'
  ).length,
  status: diagnostics.status
})

const getLiveHierarchyEvidence = (
  page: Page
): Promise<readonly LiveHierarchyEvidence[]> =>
  page.evaluate(() =>
    Array.from(window.__Core__.deps.sceneTree.getAllElements().entries())
      .filter(([, element]) => element.get('type') !== 'workspace')
      .map(([id, element]) => {
        const type = String(element.get('type'))
        const children = type === 'group' ? element.get('children') : undefined
        return {
          id,
          type,
          parentId: String(element.get('parentId') ?? ''),
          ...(Array.isArray(children) ? { children: [...children] } : {})
        }
      })
      .sort((left, right) => left.id.localeCompare(right.id))
  )

const getAppliedRenderProjectionCount = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      window.__AsyraAiDrawingPerformance__?.readCounterTotal(
        'render-projection-outcome-applied'
      ) ?? 0
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
    const summarizeTimes = (times: readonly number[]) => {
      const ordered = [...times].sort((left, right) => left - right)
      const gaps = ordered
        .slice(1)
        .map((capturedAtMs, index) => capturedAtMs - (ordered[index] ?? 0))
      return {
        count: ordered.length,
        firstAtMs: ordered[0] ?? null,
        lastAtMs: ordered.at(-1) ?? null,
        maxGapMs: gaps.length > 0 ? Math.max(...gaps) : 0
      }
    }
    const summarizePhaseTimes = (
      profile: PerformanceProfileSnapshot | null,
      name: string
    ) =>
      summarizeTimes(
        profile?.phases
          .filter((phase) => phase.name === name)
          .map(({ atMs }) => atMs) ?? []
      )
    const summarizeCounterTimes = (
      profile: PerformanceProfileSnapshot | null,
      name: string
    ) =>
      summarizeTimes(
        profile?.counters
          .filter((counter) => counter.name === name)
          .map(({ atMs }) => atMs) ?? []
      )
    const sourceSent = sourceDiagnostics?.outcomes.filter(
      ({ direction, status }) => direction === 'local' && status === 'sent'
    )
    const remoteProcessed = diagnostics.outcomes.filter(
      ({ direction, status }) =>
        direction === 'remote' && status === 'processed'
    )
    const remoteProcessedIds = new Set(
      remoteProcessed.map(({ publicationId }) => publicationId)
    )
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
              failures: sourceDiagnostics.outcomes
                .filter(
                  ({ status }) =>
                    status === 'send-failed' || status === 'process-failed'
                )
                .slice(-3),
              status: sourceDiagnostics.status,
              topCounters: [...sourceCounterTotals.entries()]
                .sort((left, right) => right[1] - left[1])
                .slice(0, 10),
              topPhases: [...sourcePhaseTotals.entries()]
                .sort((left, right) => right[1] - left[1])
                .slice(0, 12)
                .map(([name, durationMs]) => [name, Math.round(durationMs)]),
              outcomeTimes: summarizeTimes(
                sourceSent?.map(({ capturedAtMs }) => capturedAtMs) ?? []
              )
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
          failures: diagnostics.outcomes
            .filter(
              ({ status }) =>
                status === 'send-failed' || status === 'process-failed'
            )
            .slice(-3),
          status: diagnostics.status,
          outcomeTimes: summarizeTimes(
            remoteProcessed.map(({ capturedAtMs }) => capturedAtMs)
          ),
          pendingPublications:
            sourceDiagnostics?.factoryPublications
              .filter(
                ({ publicationId }) => !remoteProcessedIds.has(publicationId)
              )
              .map(({ deliveryCount, publicationId }) => ({
                deliveryCount,
                publicationId
              })) ?? []
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
          .map(([name, durationMs]) => [name, Math.round(durationMs)]),
        phaseTimes: {
          inboundFrameEntry: summarizeCounterTimes(
            snapshot,
            'collaboration:inbound-frame-byte-length'
          ),
          inboundReceive: summarizePhaseTimes(
            snapshot,
            'collaboration:inbound-receive-to-dispatch'
          ),
          remoteApply: summarizePhaseTimes(
            snapshot,
            'collaboration:remote-transaction-apply'
          ),
          remoteCanonicalBatch: summarizePhaseTimes(
            snapshot,
            'collaboration:remote-canonical-batch-apply'
          ),
          renderFlush: summarizePhaseTimes(snapshot, 'render:flush-frame')
        }
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
    `Local live AI drawing evidence timed out: ${JSON.stringify(
      summarizeLiveEvidence(latest)
    )}`
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
            diagnostics: summarizeCollaborationDiagnostics(actorADiagnostics),
            live: summarizeLiveEvidence(await getLiveAiDrawingEvidence(actorA))
          },
          actorB: {
            diagnostics: summarizeCollaborationDiagnostics(actorBDiagnostics),
            live: summarizeLiveEvidence(await getLiveAiDrawingEvidence(actorB))
          }
        })}`
      )
    }
    await actorA.waitForTimeout(500)
  }
  const [actorADiagnostics, actorBDiagnostics, actorALive, actorBLive] =
    await Promise.all([
      getCollaborationDiagnostics(actorA),
      getCollaborationDiagnostics(actorB),
      getLiveAiDrawingEvidence(actorA),
      getLiveAiDrawingEvidence(actorB)
    ])
  throw new Error(
    `Live CRDT convergence timed out: ${JSON.stringify({
      actorA: {
        diagnostics: summarizeCollaborationDiagnostics(actorADiagnostics),
        live: summarizeLiveEvidence(actorALive)
      },
      actorB: {
        diagnostics: summarizeCollaborationDiagnostics(actorBDiagnostics),
        live: summarizeLiveEvidence(actorBLive)
      },
      firstCanonicalDifference: await getFirstCanonicalDifference(
        actorA,
        actorB
      )
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

const getPerformanceProfileSnapshot = async (
  page: Page
): Promise<PerformanceProfileSnapshot> => {
  const snapshot = await page.evaluate(
    () => window.__AsyraAiDrawingPerformance__?.snapshot() ?? null
  )
  if (!snapshot) {
    throw new Error('AI drawing performance profile is unavailable')
  }
  return snapshot
}

const getPerformanceProfile = async (
  page: Page
): Promise<{
  readonly productDurationMs: number
  readonly snapshot: PerformanceProfileSnapshot
}> => {
  const snapshot = await getPerformanceProfileSnapshot(page)
  const productSamples = snapshot.phases.filter(
    ({ name }) => name === 'ai-turn:accepted-to-settled'
  )
  if (productSamples.length !== 1) {
    throw new Error(
      `Expected one accepted-to-settled product sample, received ${productSamples.length}`
    )
  }
  return {
    productDurationMs: productSamples[0]?.durationMs ?? Number.NaN,
    snapshot
  }
}

const expectProfileOwnerPhases = (
  snapshot: PerformanceProfileSnapshot,
  owner: string,
  requiredNames: readonly string[]
) => {
  const observedNames = new Set(snapshot.phases.map(({ name }) => name))
  expect(
    requiredNames.filter((name) => !observedNames.has(name)),
    `${owner} profile is missing required owner phases`
  ).toEqual([])
}

const sumProfileCounter = (
  snapshot: PerformanceProfileSnapshot,
  name: string
): number =>
  snapshot.counters
    .filter((counter) => counter.name === name)
    .reduce((total, counter) => total + counter.value, 0)

const sumProfilePhase = (
  snapshots: readonly PerformanceProfileSnapshot[],
  name: string
): number =>
  snapshots.reduce(
    (total, snapshot) =>
      total +
      snapshot.phases
        .filter((phase) => phase.name === name)
        .reduce((phaseTotal, phase) => phaseTotal + phase.durationMs, 0),
    0
  )

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

const openAgent = async (page: Page) => {
  await page.getByRole('button', { name: 'Open Agent' }).click()
  await expect(page.getByTestId('ai-agent-panel')).toBeVisible()
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
    .getByTestId('ai-agent-panel')
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
  const actorAPath = testInfo.outputPath(`${name}-actor-a.png`)
  const actorBPath = testInfo.outputPath(`${name}-actor-b.png`)
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
  return Object.freeze({ actorAPath, actorBPath })
}

interface NativeRecordingBounds {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

const launchIndependentActor = async (
  baseURL: string,
  profilePath: string,
  { height, left, top, width }: NativeRecordingBounds
): Promise<{ readonly context: BrowserContext; readonly page: Page }> => {
  const context = await chromium.launchPersistentContext(profilePath, {
    args: [
      '--app=about:blank',
      '--disable-session-crashed-bubble',
      '--no-default-browser-check',
      '--no-first-run',
      `--window-position=${left},${top}`,
      `--window-size=${width},${height}`
    ],
    baseURL,
    deviceScaleFactor: undefined,
    headless: false,
    viewport: null
  })
  const page = context.pages()[0] ?? (await context.newPage())
  const session = await context.newCDPSession(page)
  try {
    const { windowId } = await session.send('Browser.getWindowForTarget')
    await session.send('Browser.setWindowBounds', {
      bounds: {
        height,
        left,
        top,
        width,
        windowState: 'normal'
      },
      windowId
    })
  } finally {
    await session.detach()
  }
  return { context, page }
}

const readNativeWindowBounds = (page: Page): Promise<NativeRecordingBounds> =>
  page.evaluate(() => ({
    height: outerHeight,
    left: screenX,
    top: screenY,
    width: outerWidth
  }))

const resolveStackedCaptureBounds = async (
  actorA: Page,
  actorB: Page
): Promise<NativeRecordingBounds> => {
  const [actorAWindow, actorBWindow] = await Promise.all([
    readNativeWindowBounds(actorA),
    readNativeWindowBounds(actorB)
  ])
  const horizontalDifference = Math.abs(actorAWindow.left - actorBWindow.left)
  const verticalDifference = Math.abs(
    actorBWindow.top - (actorAWindow.top + actorAWindow.height)
  )
  if (
    horizontalDifference > 4 ||
    verticalDifference > 4 ||
    actorAWindow.width !== actorBWindow.width
  ) {
    throw new Error(
      `The independent Actor windows are not stacked: ${JSON.stringify({
        actorAWindow,
        actorBWindow
      })}`
    )
  }
  const left = Math.min(actorAWindow.left, actorBWindow.left)
  const top = Math.min(actorAWindow.top, actorBWindow.top)
  const right = Math.max(
    actorAWindow.left + actorAWindow.width,
    actorBWindow.left + actorBWindow.width
  )
  const bottom = Math.max(
    actorAWindow.top + actorAWindow.height,
    actorBWindow.top + actorBWindow.height
  )
  return {
    height: bottom - top,
    left,
    top,
    width: right - left
  }
}

const waitForNativeCommand = (
  child: ChildProcessWithoutNullStreams,
  label: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          `${label} failed (${code ?? signal ?? 'unknown'}): ${stderr.trim()}`
        )
      )
    })
  })

const startNativeScreenRecording = async (
  { height, left, top, width }: NativeRecordingBounds,
  outputPath: string
) => {
  const captureProcess = spawn('/usr/sbin/screencapture', [
    '-x',
    '-v',
    '-T0',
    `-R${left},${top},${width},${height}`,
    outputPath
  ])
  const completion = waitForNativeCommand(
    captureProcess,
    'macOS screen recording'
  )
  await new Promise((resolve) => setTimeout(resolve, 300))
  if (captureProcess.exitCode !== null) {
    await completion
    throw new Error('macOS screen recording stopped before Agent interaction')
  }
  return {
    stop: async () => {
      if (!captureProcess.kill('SIGINT')) {
        throw new Error('macOS screen recording could not be stopped')
      }
      await completion
    }
  }
}

const convertNativeRecording = async (
  sourcePath: string,
  destinationPath: string
) => {
  const conversion = spawn('/usr/bin/avconvert', [
    '--source',
    sourcePath,
    '--preset',
    'PresetHighestQuality',
    '--output',
    destinationPath,
    '--replace'
  ])
  await waitForNativeCommand(conversion, 'MP4 conversion')
}

const reportRecordingStage = (stage: string) => {
  // eslint-disable-next-line no-console
  console.log(`AI_CRDT_RECORDING_STAGE ${stage}`)
}

test('proves the high-detail progressive CRDT correctness flow without generating media', async ({
  browser
}, testInfo) => {
  test.skip(
    !RUN_HIGH_DETAIL_CRDT,
    'High-detail CRDT correctness is an explicit opt-in gate.'
  )
  test.setTimeout(600_000)
  const captureLiveVisualReview = CAPTURE_HIGH_DETAIL_CRDT_VISUAL_REVIEW
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
  const measureHarnessPhase = async <T>(
    name: string,
    run: () => Promise<T>
  ): Promise<T> => {
    const startedAtMs = Date.now()
    try {
      const result = await run()
      const durationMs = Date.now() - startedAtMs
      timings[`harness:${name}`] = durationMs
      // eslint-disable-next-line no-console
      console.log(
        `AI_CRDT_SETUP ${JSON.stringify({ durationMs, name, status: 'settled' })}`
      )
      return result
    } catch (error) {
      const durationMs = Date.now() - startedAtMs
      timings[`harness:${name}`] = durationMs
      // eslint-disable-next-line no-console
      console.log(
        `AI_CRDT_SETUP ${JSON.stringify({
          durationMs,
          message: error instanceof Error ? error.message : String(error),
          name,
          status: 'failed'
        })}`
      )
      throw error
    }
  }
  const productProfiles: Record<
    string,
    {
      readonly productDurationMs: number
      readonly snapshot: PerformanceProfileSnapshot
    }
  > = {}
  const sourceProfiles: Record<string, PerformanceProfileSnapshot> = {}
  const peerProfiles: Record<string, PerformanceProfileSnapshot> = {}

  try {
    const fileId = `ai-crdt-high-detail-${Date.now()}`
    await measureHarnessPhase('server-response-inbox-seeded', () =>
      seedAsyraDesignServerResponse(actorAContext, {
        appUrl: profiledCollaborationUrl(fileId),
        fileId,
        itemCount: 7075
      })
    )
    await measureHarnessPhase('navigate-actors', () =>
      Promise.all([
        actorA.goto(profiledCollaborationUrl(fileId)),
        actorB.goto(profiledCollaborationUrl(fileId))
      ])
    )
    await measureHarnessPhase('app-ready', () =>
      Promise.all([waitForAppReady(actorA), waitForAppReady(actorB)])
    )
    await measureHarnessPhase('collaboration-ready', () =>
      Promise.all([
        waitForCollaboration(actorA),
        waitForCollaboration(actorB),
        captureCollaborationOutcomes(actorA),
        captureCollaborationOutcomes(actorB)
      ])
    )
    if (process.env.ASYRA_DESIGN_CAPTURE_WEBSOCKET_PAYLOAD_PROFILE === '1') {
      stopWebSocketPayloadProfile = await measureHarnessPhase(
        'websocket-profile-ready',
        () => startWebSocketPayloadProfile(actorAContext, actorA)
      )
    }
    await measureHarnessPhase('agent-ready', () => openAgent(actorA))
    await measureHarnessPhase('reference-attached', () =>
      dropReferenceImage(actorA)
    )
    await measureHarnessPhase('runtime-evidence-ready', () =>
      captureProgressiveRuntimeEvidence(actorA)
    )
    const actorBPersistenceBaseline = await measureHarnessPhase(
      'peer-persistence-baseline',
      () => getPersistedAiDrawingEvidence(actorB, fileId)
    )
    const [actorATransactionBaseline, actorBTransactionBaseline] =
      await measureHarnessPhase('history-baseline', () =>
        Promise.all([getUndoHistoryDepth(actorA), getUndoHistoryDepth(actorB)])
      )
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
    let progressiveCreation: ProgressiveCreationEvidence
    try {
      progressiveCreation = await observeProgressiveCreation(
        actorA,
        actorB,
        () => createdTurnSettled
      )
    } catch (error) {
      let turnFailure: unknown
      try {
        await createdTurnPromise
      } catch (createdTurnError) {
        turnFailure =
          createdTurnError instanceof Error
            ? {
                message: createdTurnError.message,
                name: createdTurnError.name,
                stack: createdTurnError.stack
              }
            : createdTurnError
      }
      const [
        actorADiagnostics,
        actorACanonicalElementCount,
        conversationResult
      ] = await Promise.all([
        getCollaborationDiagnostics(actorA),
        getLiveCanonicalElementCount(actorA),
        actorA.evaluate(
          () =>
            window.__AsyraAiDrawingPerformance__
              ?.readConversationSnapshot()
              ?.settledTurns.at(-1)?.result ?? null
        )
      ])
      throw new Error(
        `High-detail creation failed before progressive publication: ${JSON.stringify(
          {
            actorACanonicalElementCount,
            actorAFactoryStatuses: actorADiagnostics.factoryStatuses,
            conversationResult,
            turnText: await actorA
              .getByTestId('ai-agent-panel')
              .locator('article[data-turn-id]')
              .last()
              .innerText(),
            turnFailure
          }
        )}`,
        { cause: error }
      )
    }
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
    expect(creationCommit.undoableChangeCount).toBeGreaterThan(0)
    const creationConvergenceDeadlineMs = creationCommit.capturedAtMs + 120_000
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
    peerProfiles.creation = await getPerformanceProfileSnapshot(actorB)
    const actorACreated = await waitForPersistedAiDrawingEvidence(
      actorA,
      fileId,
      ({ totalCount }) => totalCount === 7076
    )
    expect(canonicalSummary(actorACreated)).toEqual(canonicalSummary(created))
    // eslint-disable-next-line no-console
    console.log(`AI_CRDT_PHASE actor-a-persisted ${actorACreated.totalCount}`)
    await expectActorBPersistenceUnchanged('creation')
    sourceProfiles.creation = await getPerformanceProfileSnapshot(actorA)
    expectProfileOwnerPhases(sourceProfiles.creation, 'Actor A creation', [
      'ai-app:prepare-composition-bulk-request',
      'ai-app:create-composition-batch',
      'factory:finalize-mutation-batch-artifact',
      'factory:flush-shared-channels',
      'factory:select-delivery-sequence-boundaries',
      'factory:create-shared-publication',
      'collaboration:outbound-encode',
      'collaboration:codec-worker-encode',
      'render:flush-frame',
      'ui-context:flush',
      'core:persistence-capture',
      'core:persistence-save',
      'persistence:indexeddb-put'
    ])
    expect(
      sourceProfiles.creation.phases.some(
        ({ name }) => name === 'collaboration:outbound-send-to-acceptance'
      )
    ).toBe(true)
    expect(
      sumProfileCounter(
        sourceProfiles.creation,
        'collaboration:outbound-encoded-byte-length'
      )
    ).toBeGreaterThan(0)
    expect(sumProfileCounter(sourceProfiles.creation, 'ai-turn:accepted')).toBe(
      1
    )
    expect(
      sumProfileCounter(sourceProfiles.creation, 'ai-turn:outcome:success')
    ).toBe(1)
    expectProfileOwnerPhases(peerProfiles.creation, 'Actor B creation', [
      'collaboration:inbound-receive-to-dispatch',
      'collaboration:codec-worker-decode',
      'collaboration:remote-transaction-apply',
      'render:flush-frame',
      'ui-context:flush'
    ])
    expect(
      sumProfileCounter(
        peerProfiles.creation,
        'collaboration:remote-add-element-batch-size'
      )
    ).toBe(7076)
    expect(
      sumProfileCounter(
        peerProfiles.creation,
        'collaboration:remote-add-element-batch-count'
      )
    ).toBeGreaterThan(0)
    expect(
      sumProfileCounter(
        peerProfiles.creation,
        'collaboration:remote-add-element-single-count'
      )
    ).toBe(0)
    expect(
      sumProfileCounter(
        peerProfiles.creation,
        'render-projection-outcome-applied'
      )
    ).toBe(7076)
    for (const outcome of ['failed', 'missing', 'resynced']) {
      expect(
        sumProfileCounter(
          peerProfiles.creation,
          `render-projection-outcome-${outcome}`
        )
      ).toBe(0)
    }
    for (const phase of [
      'core:persistence-capture',
      'core:persistence-save',
      'persistence:indexeddb-put'
    ]) {
      expect(
        peerProfiles.creation.phases.filter(({ name }) => name === phase)
      ).toHaveLength(0)
    }
    const actorBCreationDiagnostics = await getCollaborationDiagnostics(actorB)
    const actorBRemoteCreationCommits =
      actorBCreationDiagnostics.factoryCommits.filter(
        ({ origin }) => origin === 'remote'
      )
    expect(actorBRemoteCreationCommits.length).toBeGreaterThan(0)
    expect(
      actorBRemoteCreationCommits.every(
        ({ undoableChangeCount }) => undoableChangeCount === 0
      )
    ).toBe(true)
    expect(await getUndoHistoryDepth(actorA)).toBe(
      actorATransactionBaseline + 1
    )
    expect(await getUndoHistoryDepth(actorB)).toBe(actorBTransactionBaseline)
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
    await waitForAppliedRenderProjection(actorB, (count) => count > 0, 30_000)
    const blueWhiskers = await expectLivePeerEvidence(
      actorA,
      actorB,
      ({ blueStrokeIds }) => blueStrokeIds.length >= 2
    )
    peerProfiles.blueWhiskers = await getPerformanceProfileSnapshot(actorB)
    const actorABlueWhiskers = await waitForPersistedAiDrawingEvidence(
      actorA,
      fileId,
      ({ blueStrokeIds }) => blueStrokeIds.length >= 2
    )
    expect(canonicalSummary(actorABlueWhiskers)).toEqual(
      canonicalSummary(blueWhiskers)
    )
    const whiskerConvergedAtMs = Date.now()
    const whiskerDiagnostics = await getCollaborationDiagnostics(actorA)
    await expectActorBPersistenceUnchanged('blue-whiskers follow-up')
    sourceProfiles.blueWhiskers = await getPerformanceProfileSnapshot(actorA)
    expect(await getUndoHistoryDepth(actorA)).toBe(
      actorATransactionBaseline + 2
    )
    expect(await getUndoHistoryDepth(actorB)).toBe(actorBTransactionBaseline)
    // eslint-disable-next-line no-console
    console.log('AI_CRDT_PHASE whiskers-converged')
    expect(blueWhiskers.ids).toEqual(created.ids)
    expect(blueWhiskers.totalCount).toBe(created.totalCount)
    expect(blueWhiskers.pointCount).toBe(created.pointCount)
    expect(blueWhiskers.blueStrokeIds).toHaveLength(49)
    expect(whiskerDiagnostics.factoryPublications).toHaveLength(1)
    expect(
      whiskerDiagnostics.factoryCommits.filter(
        ({ origin }) => origin === 'action'
      )
    ).toHaveLength(1)
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
    await waitForAppliedRenderProjection(actorB, (count) => count > 0, 30_000)
    const redPupils = await expectLivePeerEvidence(
      actorA,
      actorB,
      ({ redFillIds }) => redFillIds.length === 2
    )
    peerProfiles.redPupils = await getPerformanceProfileSnapshot(actorB)
    const actorARedPupils = await waitForPersistedAiDrawingEvidence(
      actorA,
      fileId,
      ({ redFillIds }) => redFillIds.length === 2
    )
    expect(canonicalSummary(actorARedPupils)).toEqual(
      canonicalSummary(redPupils)
    )
    const pupilConvergedAtMs = Date.now()
    const pupilDiagnostics = await getCollaborationDiagnostics(actorA)
    await expectActorBPersistenceUnchanged('red-pupils follow-up')
    sourceProfiles.redPupils = await getPerformanceProfileSnapshot(actorA)
    expect(await getUndoHistoryDepth(actorA)).toBe(
      actorATransactionBaseline + 3
    )
    expect(await getUndoHistoryDepth(actorB)).toBe(actorBTransactionBaseline)
    // eslint-disable-next-line no-console
    console.log('AI_CRDT_PHASE pupils-converged')
    expect(redPupils.ids).toEqual(created.ids)
    expect(redPupils.totalCount).toBe(created.totalCount)
    expect(redPupils.pointCount).toBe(created.pointCount)
    expect(redPupils.blueStrokeIds).toEqual(blueWhiskers.blueStrokeIds)
    expect(redPupils.redFillIds).toHaveLength(2)
    expect(pupilDiagnostics.factoryPublications).toHaveLength(1)
    expect(
      pupilDiagnostics.factoryCommits.filter(
        ({ origin }) => origin === 'action'
      )
    ).toHaveLength(1)
    timings.redPupilHarnessMs = pupilSettledAtMs - pupilStartedAtMs
    timings.redPupilProductMs = productProfiles.redPupils.productDurationMs
    timings.redPupilPeerConvergenceMs = pupilConvergedAtMs - pupilSettledAtMs

    await undo(actorB)
    expect(await getLiveAiDrawingEvidence(actorB)).toEqual(redPupils)
    expect(await getLiveAiDrawingEvidence(actorA)).toEqual(redPupils)
    expect(await getUndoHistoryDepth(actorB)).toBe(actorBTransactionBaseline)
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
    expect(await getUndoHistoryDepth(actorA)).toBe(
      actorATransactionBaseline + 2
    )
    expect(await getUndoHistoryDepth(actorB)).toBe(actorBTransactionBaseline)
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
    expect(await getUndoHistoryDepth(actorA)).toBe(
      actorATransactionBaseline + 3
    )
    expect(await getUndoHistoryDepth(actorB)).toBe(actorBTransactionBaseline)
    expect(redonePupils).toEqual(redPupils)

    timings.fullFlowHarnessMs = Date.now() - flowStartedAtMs
    timings.fullFlowProductMs = Object.values(productProfiles).reduce(
      (total, { productDurationMs }) => total + productDurationMs,
      0
    )
    for (const stage of ['blueWhiskers', 'redPupils'] as const) {
      expectProfileOwnerPhases(sourceProfiles[stage], `Actor A ${stage}`, [
        'ai-app:apply-update-batch',
        'factory:finalize-mutation-batch-artifact',
        'factory:flush-shared-channels',
        'factory:create-shared-publication',
        'collaboration:outbound-encode',
        'collaboration:codec-worker-encode',
        'render:flush-frame',
        'ui-context:flush',
        'core:persistence-capture',
        'core:persistence-save',
        'persistence:indexeddb-put'
      ])
      expectProfileOwnerPhases(peerProfiles[stage], `Actor B ${stage}`, [
        'collaboration:inbound-receive-to-dispatch',
        'collaboration:codec-worker-decode',
        'collaboration:remote-transaction-apply',
        'render:flush-frame',
        'ui-context:flush'
      ])
    }
    const sourceProfileSnapshots = Object.values(sourceProfiles)
    const peerProfileSnapshots = Object.values(peerProfiles)
    const ownerSpanValues = {
      appBulkRequestMs: sumProfilePhase(
        [sourceProfiles.creation],
        'ai-app:prepare-composition-bulk-request'
      ),
      canonicalBatchMs: sumProfilePhase(
        [sourceProfiles.creation],
        'ai-app:create-composition-batch'
      ),
      factoryArtifactMs: sumProfilePhase(
        sourceProfileSnapshots,
        'factory:finalize-mutation-batch-artifact'
      ),
      factoryPublicationSequenceMs:
        sumProfilePhase(
          sourceProfileSnapshots,
          'factory:select-delivery-sequence-boundaries'
        ) +
        sumProfilePhase(
          sourceProfileSnapshots,
          'factory:create-shared-publication'
        ),
      inboundDispatchMs: sumProfilePhase(
        peerProfileSnapshots,
        'collaboration:inbound-receive-to-dispatch'
      ),
      outboundEncodeMs: sumProfilePhase(
        sourceProfileSnapshots,
        'collaboration:outbound-encode'
      ),
      persistenceCaptureMs: sumProfilePhase(
        sourceProfileSnapshots,
        'core:persistence-capture'
      ),
      persistenceSaveMs: sumProfilePhase(
        sourceProfileSnapshots,
        'core:persistence-save'
      ),
      remoteApplyMs: sumProfilePhase(
        peerProfileSnapshots,
        'collaboration:remote-transaction-apply'
      ),
      sourceRenderMs: sumProfilePhase(
        sourceProfileSnapshots,
        'render:flush-frame'
      ),
      sourceUiMs: sumProfilePhase(sourceProfileSnapshots, 'ui-context:flush'),
      peerRenderMs: sumProfilePhase(peerProfileSnapshots, 'render:flush-frame'),
      peerUiMs: sumProfilePhase(peerProfileSnapshots, 'ui-context:flush'),
      testBodyHarnessMs: timings.fullFlowHarnessMs,
      testBodyOverheadMs: Math.max(
        0,
        timings.fullFlowHarnessMs - timings.fullFlowProductMs
      ),
      workerDecodeMs: sumProfilePhase(
        peerProfileSnapshots,
        'collaboration:codec-worker-decode'
      ),
      workerEncodeMs: sumProfilePhase(
        sourceProfileSnapshots,
        'collaboration:codec-worker-encode'
      )
    }

    // eslint-disable-next-line no-console
    console.log(
      `AI_CRDT_TIMING_SUMMARY ${JSON.stringify({
        ownerSpanValues,
        timings
      })}`
    )
    const [actorAFinalDiagnostics, actorBFinalDiagnostics] = await Promise.all([
      getCollaborationDiagnostics(actorA),
      getCollaborationDiagnostics(actorB)
    ])
    const outcomes = [
      ...actorAFinalDiagnostics.outcomes,
      ...actorBFinalDiagnostics.outcomes
    ]
    expect(
      outcomes.some(
        ({ status }) => status === 'send-failed' || status === 'process-failed'
      )
    ).toBe(false)
    expect(
      actorBFinalDiagnostics.outcomes.filter(
        ({ direction, status }) => direction === 'local' && status === 'sent'
      )
    ).toEqual([])
    expect(
      actorAFinalDiagnostics.outcomes.filter(
        ({ direction, status }) =>
          direction === 'remote' && status === 'processed'
      )
    ).toEqual([])
    await testInfo.attach('high-detail-crdt-timing-summary.json', {
      body: JSON.stringify(
        {
          canonical: {
            created,
            redPupils,
            redonePupils,
            undonePupils
          },
          peerProfiles,
          productProfiles,
          sourceProfiles,
          progressiveCreation,
          ownerSpanValues,
          timings
        },
        null,
        2
      ),
      contentType: 'application/json'
    })

    if (captureLiveVisualReview) {
      const [actorAFrame, actorBFrame] = await Promise.all([
        prepareCompleteCatViewport(actorA),
        prepareCompleteCatViewport(actorB)
      ])
      const [
        actorAEvidenceBeforeCapture,
        actorBEvidenceBeforeCapture,
        actorAHierarchyBeforeCapture,
        actorBHierarchyBeforeCapture
      ] = await Promise.all([
        getLiveAiDrawingEvidence(actorA),
        getLiveAiDrawingEvidence(actorB),
        getLiveHierarchyEvidence(actorA),
        getLiveHierarchyEvidence(actorB)
      ])
      expect(actorBEvidenceBeforeCapture).toEqual(actorAEvidenceBeforeCapture)
      expect(actorBHierarchyBeforeCapture).toEqual(actorAHierarchyBeforeCapture)
      const screenshotName = 'high-detail-live-visual-review'
      const screenshots = await captureCheckpoint(
        actorA,
        actorB,
        testInfo,
        screenshotName
      )
      const [
        actorAEvidenceAfterCapture,
        actorBEvidenceAfterCapture,
        actorAHierarchyAfterCapture,
        actorBHierarchyAfterCapture
      ] = await Promise.all([
        getLiveAiDrawingEvidence(actorA),
        getLiveAiDrawingEvidence(actorB),
        getLiveHierarchyEvidence(actorA),
        getLiveHierarchyEvidence(actorB)
      ])
      expect(actorAEvidenceAfterCapture).toEqual(actorAEvidenceBeforeCapture)
      expect(actorBEvidenceAfterCapture).toEqual(actorAEvidenceBeforeCapture)
      expect(actorAHierarchyAfterCapture).toEqual(actorAHierarchyBeforeCapture)
      expect(actorBHierarchyAfterCapture).toEqual(actorAHierarchyBeforeCapture)
      const visualReviewMetadata = {
        actorAFrame,
        actorBFrame,
        baseURL: testInfo.project.use.baseURL,
        canonical: {
          blueStrokeIds: actorAEvidenceBeforeCapture.blueStrokeIds,
          byteLength: actorAEvidenceBeforeCapture.byteLength,
          groupCount: actorAEvidenceBeforeCapture.groupCount,
          ids: actorAEvidenceBeforeCapture.ids,
          pointCount: actorAEvidenceBeforeCapture.pointCount,
          redFillIds: actorAEvidenceBeforeCapture.redFillIds,
          sha256: actorAEvidenceBeforeCapture.sha256,
          totalCount: actorAEvidenceBeforeCapture.totalCount,
          vectorCount: actorAEvidenceBeforeCapture.vectorCount,
          whiteBackgrounds: actorAEvidenceBeforeCapture.whiteBackgrounds
        },
        hierarchy: actorAHierarchyBeforeCapture,
        screenshots,
        viewport: { height: 720, width: 1280 }
      }
      const metadataPath = testInfo.outputPath(
        `${screenshotName}-metadata.json`
      )
      await writeFile(
        metadataPath,
        `${JSON.stringify(visualReviewMetadata, null, 2)}\n`,
        'utf8'
      )
      await testInfo.attach(`${screenshotName}-metadata`, {
        contentType: 'application/json',
        path: metadataPath
      })
    }
  } finally {
    try {
      const peerProfile = await getPerformanceProfileSnapshot(actorB)
      await testInfo.attach('actor-b-performance-profile.json', {
        body: JSON.stringify(peerProfile, null, 2),
        contentType: 'application/json'
      })
    } catch {
      // Teardown must still close both browser contexts after an early failure.
    }
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

// eslint-disable-next-line no-empty-pattern
test('records two live CRDT clients while Agent creates the same cat', async ({}, testInfo) => {
  test.skip(
    process.env.ASYRA_DESIGN_RUN_AI_CRDT_VIDEO !== '1',
    'The dual-client AI recording is an explicit resource-aware visual gate.'
  )
  test.skip(
    process.platform !== 'darwin',
    'The dual-client live-window recorder uses the macOS compositor.'
  )
  test.setTimeout(900_000)

  const baseURL = testInfo.project.use.baseURL
  if (typeof baseURL !== 'string') {
    throw new Error('The AI CRDT recording requires an App base URL')
  }
  let actorAContext: BrowserContext | null = null
  let actorBContext: BrowserContext | null = null
  let actorA: Page | null = null
  let actorB: Page | null = null
  let nativeRecording: Awaited<
    ReturnType<typeof startNativeScreenRecording>
  > | null = null
  let recordingCompleted = false
  const sourceVideoPath = testInfo.outputPath(
    'ai-cat-crdt-progressive-side-by-side.mov'
  )
  const videoPath = testInfo.outputPath(
    'ai-cat-crdt-progressive-side-by-side.mp4'
  )
  let timingEvidence:
    | {
        readonly actorACompletedMs: number
        readonly actorBRenderedMs: number
      }
    | undefined
  try {
    const actorAResult = await launchIndependentActor(
      baseURL,
      testInfo.outputPath('actor-a-profile'),
      {
        height: recordingWindowHeight,
        left: recordingWindowLeft,
        top: recordingWindowTop,
        width: recordingWindowWidth
      }
    )
    actorAContext = actorAResult.context
    actorA = actorAResult.page
    const actorBResult = await launchIndependentActor(
      baseURL,
      testInfo.outputPath('actor-b-profile'),
      {
        height: recordingWindowHeight,
        left: recordingWindowLeft,
        top: recordingWindowTop + recordingWindowHeight,
        width: recordingWindowWidth
      }
    )
    actorBContext = actorBResult.context
    actorB = actorBResult.page

    const fileId = `ai-crdt-video-${Date.now()}`
    await seedAsyraDesignServerResponse(actorAContext, {
      appUrl: collaborationUrl(fileId),
      fileId,
      itemCount: 7075
    })
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

    const [actorAFrame, actorBFrame] = await Promise.all([
      prepareCompleteCatViewport(actorA),
      prepareCompleteCatViewport(actorB)
    ])
    expect(actorAFrame.scale).toBeGreaterThan(0)
    expect(actorAFrame.scale).toBeLessThan(1)
    expect(actorBFrame.scale).toBeGreaterThan(0)
    expect(actorBFrame.scale).toBeLessThan(1)

    await actorA.bringToFront()
    await actorB.bringToFront()
    await actorB.waitForTimeout(250)
    const captureBounds = await resolveStackedCaptureBounds(actorA, actorB)
    nativeRecording = await startNativeScreenRecording(
      captureBounds,
      sourceVideoPath
    )
    reportRecordingStage('capture-started')
    await openAgent(actorA)
    await dropReferenceImage(actorA)

    const actorABefore = await getUndoHistoryDepth(actorA)
    const actorBBefore = await getUndoHistoryDepth(actorB)
    const operationStartedAt = Date.now()
    reportRecordingStage('send')
    const createdTurnPromise = submitTurn(actorA, exactCatOnlyPrompt, 1).then(
      (turn) => ({
        actorACompletedAt: Date.now(),
        turn
      })
    )
    const { actorACompletedAt, turn: createdTurn } = await createdTurnPromise
    reportRecordingStage('actor-a-complete')
    const remainingConvergenceMs = Math.max(
      1,
      recordingOperationDeadlineMs - (Date.now() - operationStartedAt)
    )
    const created = await expectPeerSnapshot(
      actorA,
      actorB,
      remainingConvergenceMs
    )
    await actorB.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
    const actorBRenderedAt = Date.now()
    reportRecordingStage('actor-b-rendered')
    timingEvidence = {
      actorACompletedMs: actorACompletedAt - operationStartedAt,
      actorBRenderedMs: actorBRenderedAt - operationStartedAt
    }
    expect(timingEvidence.actorBRenderedMs).toBeLessThanOrEqual(
      recordingOperationDeadlineMs
    )
    await actorB.waitForTimeout(1000)
    await nativeRecording.stop()
    nativeRecording = null
    recordingCompleted = true

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
    expect(await getUndoHistoryDepth(actorA)).toBe(actorABefore + 1)
    expect(await getUndoHistoryDepth(actorB)).toBe(actorBBefore)
    await expect(createdTurn.getByText(/^Elapsed \d/)).toBeVisible()
    await captureCheckpoint(actorA, actorB, testInfo, 'progressive-01-created')
  } finally {
    if (nativeRecording) {
      await nativeRecording.stop()
    }
    await Promise.all([actorAContext?.close(), actorBContext?.close()])
  }

  if (!recordingCompleted || !timingEvidence) {
    throw new Error('The dual-client live-window recording did not complete')
  }
  await convertNativeRecording(sourceVideoPath, videoPath)
  // eslint-disable-next-line no-console
  console.log(`AI_CRDT_RECORDING_TIMING ${JSON.stringify(timingEvidence)}`)
  await testInfo.attach('ai-cat-crdt-recording-timing.json', {
    body: JSON.stringify(timingEvidence, null, 2),
    contentType: 'application/json'
  })
  await testInfo.attach('ai-cat-crdt-progressive-side-by-side', {
    contentType: 'video/mp4',
    path: videoPath
  })
})

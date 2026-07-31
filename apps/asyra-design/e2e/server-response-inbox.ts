import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import type { BrowserContext, Route } from '@playwright/test'
import { AsyraDesignAiActionNames } from '../src/constants/ai-actions'
import type { PreparedElementDescriptor } from '../src/common-apis'
import {
  PREPARED_DRAWING_ARTIFACT_VERSION,
  PREPARED_DRAWING_SLICE_ELEMENT_BUDGET,
  PREPARED_DRAWING_SLICE_POINT_BUDGET,
  type PreparedDrawingArtifact,
  type PreparedDrawingBounds,
  type PreparedDrawingSlice
} from '../src/ai/prepared-drawing-artifact'
import {
  createCatOnlyWhiteBackgroundItemsAtSource,
  type DetailedTabbyCompositionItem,
  type DetailedTabbyPath
} from '../test-data/ai-drawing/detailed-tabby'
import {
  ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_NAME,
  ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_VERSION,
  ASYRA_DESIGN_SERVER_RESPONSE_INBOX_STORE_NAME,
  ASYRA_DESIGN_SERVER_RESPONSE_SCHEMA_VERSION,
  type AsyraDesignServerResponseRecord
} from '../src/ai/server-response-inbox'

export type AsyraDesignServerResponseItemCount = 16 | 320 | 1280 | 7075

export interface SeedAsyraDesignServerResponseOptions {
  readonly appUrl: string
  readonly fileId: string
  readonly itemCount: AsyraDesignServerResponseItemCount
}

export interface SeedPreparedAsyraDesignServerResponseOptions {
  readonly appUrl: string
  readonly fileId: string
  readonly publicPath: string
}

export interface PreparedAsyraDesignServerResponseSeedMetrics {
  readonly compressedBytes: number
  readonly decodeMs: number
  readonly fetchMs: number
  readonly indexedDbWriteMs: number
  readonly totalMs: number
}

interface ServerResponseMetadata {
  readonly actionId: string
  readonly batchId: string
  readonly compositionRole: string
  readonly explanation: string
}

type ServerCompositionBounds = PreparedDrawingBounds

interface ServerCompositionStyle {
  readonly fillColor?: string
  readonly strokeColor?: string
  readonly strokeWidth?: number
}

interface PreparedSourceItem {
  readonly bounds: ServerCompositionBounds
  readonly paths: readonly DetailedTabbyPath[]
  readonly pointCount: number
  readonly primitive: 'oval' | 'vector'
  readonly role: string
  readonly style: ServerCompositionStyle
}

interface CreatePreparedDrawingArtifactOptions {
  readonly batchId: string
  readonly compositionRole: string
  readonly fileId: string
}

interface ServerResponseSeedPayload {
  readonly databaseName: string
  readonly databaseVersion: number
  readonly response: unknown
  readonly responseFileId: string
  readonly storeName: string
}

const WORKSPACE_LIMIT = 2048
const MAXIMUM_SEED_STRING_LENGTH = 1_024

class StableCanonicalIdWriter {
  private readonly counters = new Map<string, number>()

  constructor(private readonly namespace: string) {}

  next(prefix: string): string {
    const sequence = (this.counters.get(prefix) ?? 0) + 1
    this.counters.set(prefix, sequence)
    return `${prefix}-${this.namespace}-${sequence}`
  }
}

const invalidResponseComposition = (message: string): never => {
  throw new Error(`Invalid server response composition: ${message}`)
}

const finiteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const prepareBounds = (
  value: DetailedTabbyCompositionItem['bounds'],
  itemIndex: number
): ServerCompositionBounds => {
  if (
    !finiteNumber(value.x) ||
    !finiteNumber(value.y) ||
    !finiteNumber(value.width) ||
    !finiteNumber(value.height) ||
    value.x < 0 ||
    value.y < 0 ||
    value.width <= 0 ||
    value.height <= 0 ||
    value.x + value.width > WORKSPACE_LIMIT ||
    value.y + value.height > WORKSPACE_LIMIT
  ) {
    return invalidResponseComposition(`item ${itemIndex} has invalid bounds`)
  }
  return {
    height: value.height,
    width: value.width,
    x: value.x,
    y: value.y
  }
}

const prepareStyle = (
  value: DetailedTabbyCompositionItem['style'],
  itemIndex: number
): ServerCompositionStyle => {
  const keys = Object.keys(value)
  if (
    keys.length === 0 ||
    keys.some(
      (key) =>
        key !== 'fillColor' && key !== 'strokeColor' && key !== 'strokeWidth'
    ) ||
    (value.fillColor !== undefined &&
      !/^#[0-9a-f]{6}$/i.test(value.fillColor)) ||
    (value.strokeColor !== undefined &&
      !/^#[0-9a-f]{6}$/i.test(value.strokeColor)) ||
    (value.strokeWidth !== undefined &&
      (!finiteNumber(value.strokeWidth) ||
        value.strokeWidth < 1 ||
        value.strokeWidth > 20)) ||
    (value.strokeWidth !== undefined && value.strokeColor === undefined)
  ) {
    return invalidResponseComposition(`item ${itemIndex} has invalid style`)
  }
  return {
    ...(value.fillColor === undefined ? {} : { fillColor: value.fillColor }),
    ...(value.strokeColor === undefined
      ? {}
      : { strokeColor: value.strokeColor }),
    ...(value.strokeWidth === undefined
      ? {}
      : { strokeWidth: value.strokeWidth })
  }
}

const validatePath = (
  path: DetailedTabbyPath,
  bounds: ServerCompositionBounds,
  itemIndex: number
): number => {
  if (
    typeof path.closed !== 'boolean' ||
    !Array.isArray(path.points) ||
    path.points.length < 2 ||
    (path.closed && path.points.length < 3)
  ) {
    return invalidResponseComposition(`item ${itemIndex} has an invalid path`)
  }
  for (const point of path.points) {
    if (
      !finiteNumber(point.x) ||
      !finiteNumber(point.y) ||
      point.x < bounds.x ||
      point.x > bounds.x + bounds.width ||
      point.y < bounds.y ||
      point.y > bounds.y + bounds.height
    ) {
      return invalidResponseComposition(
        `item ${itemIndex} has an out-of-bounds point`
      )
    }
  }
  return path.points.length
}

const prepareSourceItem = (
  item: DetailedTabbyCompositionItem,
  itemIndex: number
): PreparedSourceItem => {
  if (
    (item.primitive !== 'oval' && item.primitive !== 'vector') ||
    typeof item.role !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(item.role)
  ) {
    return invalidResponseComposition(`item ${itemIndex} has invalid identity`)
  }
  const bounds = prepareBounds(item.bounds, itemIndex)
  const style = prepareStyle(item.style, itemIndex)
  if (item.primitive === 'oval') {
    if (
      item.paths !== undefined ||
      item.points !== undefined ||
      item.closed !== undefined
    ) {
      return invalidResponseComposition(
        `oval item ${itemIndex} contains vector geometry`
      )
    }
    return {
      bounds,
      paths: [],
      pointCount: 0,
      primitive: 'oval',
      role: item.role,
      style
    }
  }

  let paths: readonly DetailedTabbyPath[]
  let pointCount = 0
  if (item.paths !== undefined) {
    if (
      item.points !== undefined ||
      item.closed !== undefined ||
      !Array.isArray(item.paths) ||
      item.paths.length === 0
    ) {
      return invalidResponseComposition(
        `vector item ${itemIndex} has ambiguous geometry`
      )
    }
    paths = item.paths
  } else {
    if (item.points === undefined || typeof item.closed !== 'boolean') {
      return invalidResponseComposition(
        `vector item ${itemIndex} is missing geometry`
      )
    }
    paths = [{ closed: item.closed, points: item.points }]
  }
  for (const path of paths) {
    pointCount += validatePath(path, bounds, itemIndex)
  }
  return {
    bounds,
    paths,
    pointCount,
    primitive: 'vector',
    role: item.role,
    style
  }
}

const createArtifactNamespace = (fileId: string, batchId: string): string =>
  createHash('sha256')
    .update(fileId)
    .update('\0')
    .update(batchId)
    .digest('hex')
    .slice(0, 16)

const createRootPropertyIds = (
  idWriter: StableCanonicalIdWriter,
  names: readonly string[]
): PreparedElementDescriptor['props'] =>
  Object.fromEntries(
    names.map((name) => [name, idWriter.next('pp')])
  ) as PreparedElementDescriptor['props']

const createPreparedFillDescriptor = (id: string, color: string) => ({
  id,
  type: 'fill',
  kind: 'solid',
  defaultColorFormat: 'hex',
  colorFormat: 'hex',
  color,
  opacity: 1,
  visible: true,
  gradient: null
})

const createPreparedStrokeDescriptor = (
  id: string,
  color: string,
  width: number
) => ({
  id,
  type: 'stroke',
  style: 'solid',
  position: 'center',
  width,
  dash: 20,
  gap: 20,
  fill: createPreparedFillDescriptor(id, color),
  joinType: 'round',
  capType: 'round',
  miterAngle: 28.96
})

const createStyleDescriptors = (
  style: ServerCompositionStyle,
  idWriter: StableCanonicalIdWriter
) => ({
  fills:
    style.fillColor === undefined
      ? []
      : [createPreparedFillDescriptor(idWriter.next('fill'), style.fillColor)],
  strokes:
    style.strokeColor === undefined
      ? []
      : [
          createPreparedStrokeDescriptor(
            idWriter.next('stroke'),
            style.strokeColor,
            style.strokeWidth ?? 1
          )
        ]
})

const createGroupDescriptor = (
  compositionRole: string,
  bounds: ServerCompositionBounds,
  idWriter: StableCanonicalIdWriter
): PreparedElementDescriptor => ({
  children: [],
  fills: [],
  height: bounds.height,
  id: idWriter.next('grp'),
  lock: false,
  name: compositionRole,
  props: createRootPropertyIds(idWriter, [
    'position',
    'dimension',
    'fills',
    'strokes'
  ]),
  strokes: [],
  type: 'group',
  visible: true,
  width: bounds.width,
  x: bounds.x,
  y: bounds.y
})

const createVectorDescriptor = (
  item: PreparedSourceItem,
  groupBounds: ServerCompositionBounds,
  idWriter: StableCanonicalIdWriter
): PreparedElementDescriptor => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {}

  for (const path of item.paths) {
    const pointIds = path.points.map(({ x, y }) => {
      const pointId = idWriter.next('tp')
      points[pointId] = {
        anchorType: 'sharp',
        handleMode: 'none',
        id: pointId,
        kind: 'anchor',
        x,
        y
      }
      return pointId
    })
    const segmentIds: string[] = []
    const segmentCount = path.closed ? pointIds.length : pointIds.length - 1
    for (let index = 0; index < segmentCount; index += 1) {
      const segmentId = idWriter.next('ts')
      segments[segmentId] = {
        endId: pointIds[(index + 1) % pointIds.length],
        id: segmentId,
        inControlId: null,
        outControlId: null,
        startId: pointIds[index]
      }
      segmentIds.push(segmentId)
    }
    const networkId = idWriter.next('tn')
    networks[networkId] = {
      closed: path.closed,
      id: networkId,
      pointIds,
      segmentIds
    }
  }

  const elementId = idWriter.next('vector')
  return {
    closed: item.paths.some(({ closed }) => closed),
    fillRule: 'nonzero',
    height: item.bounds.height,
    id: elementId,
    lock: false,
    name: item.role,
    networks,
    pointCoordinateSpace: 'workspace',
    points,
    props: createRootPropertyIds(idWriter, [
      'position',
      'dimension',
      'points',
      'segments',
      'networks',
      'closed',
      'pointCoordinateSpace',
      'fillRule',
      'fills',
      'strokes'
    ]),
    segments,
    ...createStyleDescriptors(item.style, idWriter),
    type: 'vector',
    visible: true,
    width: item.bounds.width,
    x: item.bounds.x - groupBounds.x,
    y: item.bounds.y - groupBounds.y
  }
}

const createOvalDescriptor = (
  item: PreparedSourceItem,
  groupBounds: ServerCompositionBounds,
  idWriter: StableCanonicalIdWriter
): PreparedElementDescriptor => ({
  height: item.bounds.height,
  id: idWriter.next('oval'),
  lock: false,
  name: item.role,
  props: createRootPropertyIds(idWriter, [
    'position',
    'dimension',
    'fills',
    'strokes'
  ]),
  ...createStyleDescriptors(item.style, idWriter),
  type: 'oval',
  visible: true,
  width: item.bounds.width,
  x: item.bounds.x - groupBounds.x,
  y: item.bounds.y - groupBounds.y
})

const createPreparedDrawingSlices = (
  items: readonly PreparedSourceItem[],
  descriptors: readonly PreparedElementDescriptor[]
): readonly PreparedDrawingSlice[] => {
  const slices: PreparedDrawingSlice[] = []
  let currentDescriptors: PreparedElementDescriptor[] = []
  let currentPointCount = 0
  let currentRoles: string[] = []
  const flush = () => {
    if (currentDescriptors.length === 0) return
    slices.push({
      descriptors: currentDescriptors,
      pointCount: currentPointCount,
      roles: currentRoles
    })
    currentDescriptors = []
    currentPointCount = 0
    currentRoles = []
  }

  items.forEach((item, index) => {
    if (
      currentDescriptors.length > 0 &&
      (currentDescriptors.length >= PREPARED_DRAWING_SLICE_ELEMENT_BUDGET ||
        currentPointCount + item.pointCount >
          PREPARED_DRAWING_SLICE_POINT_BUDGET)
    ) {
      flush()
    }
    currentDescriptors.push(descriptors[index])
    currentPointCount += item.pointCount
    currentRoles.push(item.role)
  })
  flush()
  return slices
}

export const createPreparedDrawingArtifact = (
  items: readonly DetailedTabbyCompositionItem[],
  { batchId, compositionRole, fileId }: CreatePreparedDrawingArtifactOptions
): PreparedDrawingArtifact => {
  if (
    items.length === 0 ||
    batchId.trim().length === 0 ||
    fileId.trim().length === 0 ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(compositionRole)
  ) {
    return invalidResponseComposition('the composition envelope is invalid')
  }

  const sourceItems = items.map(prepareSourceItem)
  const acceptedItems: PreparedSourceItem[] = []
  const skipped: {
    readonly reason: 'duplicate-role'
    readonly role: string
  }[] = []
  const roles = new Set<string>()
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let pointCount = 0

  sourceItems.forEach((item) => {
    if (roles.has(item.role)) {
      skipped.push({ reason: 'duplicate-role', role: item.role })
      return
    }
    roles.add(item.role)
    acceptedItems.push(item)
    pointCount += item.pointCount
    minX = Math.min(minX, item.bounds.x)
    minY = Math.min(minY, item.bounds.y)
    maxX = Math.max(maxX, item.bounds.x + item.bounds.width)
    maxY = Math.max(maxY, item.bounds.y + item.bounds.height)
  })

  if (acceptedItems.length === 0) {
    return invalidResponseComposition(
      'the composition contains no accepted item'
    )
  }
  const groupBounds = {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY
  }
  const idWriter = new StableCanonicalIdWriter(
    createArtifactNamespace(fileId, batchId)
  )
  const groupDescriptor = createGroupDescriptor(
    compositionRole,
    groupBounds,
    idWriter
  )
  const descriptors = acceptedItems.map((item) =>
    item.primitive === 'vector'
      ? createVectorDescriptor(item, groupBounds, idWriter)
      : createOvalDescriptor(item, groupBounds, idWriter)
  )
  const roleToElementIds: Record<string, readonly string[]> = {}
  const pupilIds: string[] = []
  const whiskerIds: string[] = []
  acceptedItems.forEach((item, index) => {
    const elementId = descriptors[index].id
    roleToElementIds[item.role] = [elementId]
    if (item.role.includes('pupil')) {
      pupilIds.push(elementId)
    }
    if (item.role.includes('whisker')) {
      whiskerIds.push(elementId)
    }
  })
  if (pupilIds.length > 0) {
    roleToElementIds.pupils = pupilIds
  }
  if (whiskerIds.length > 0) {
    roleToElementIds.whiskers = whiskerIds
  }

  return {
    artifactVersion: PREPARED_DRAWING_ARTIFACT_VERSION,
    compositionRole,
    elementCount: descriptors.length,
    groupBounds,
    groupDescriptor,
    parent: 'workspace',
    pointCount,
    roleToElementIds,
    skipped,
    slices: createPreparedDrawingSlices(acceptedItems, descriptors)
  }
}

const DETAILED_TABBY_SOURCE_URL = new URL(
  '../test-data/ai-drawing/detailed-tabby-cat-only-white-background.svg',
  import.meta.url
)

const metadataForItemCount = (
  itemCount: AsyraDesignServerResponseItemCount
): ServerResponseMetadata => {
  switch (itemCount) {
    case 16:
      return {
        actionId: 'create-fast-crdt-response',
        batchId: 'create-fast-crdt-response',
        compositionRole: 'performance-response',
        explanation:
          'Create the deterministic fast CRDT response as ordinary editable vector elements'
      }
    case 320:
      return {
        actionId: 'create-320-crdt-response',
        batchId: 'create-320-crdt-response',
        compositionRole: 'performance-response-320',
        explanation:
          'Create the deterministic 320-item CRDT response as ordinary editable vector elements'
      }
    case 1280:
      return {
        actionId: 'create-1280-crdt-response',
        batchId: 'create-1280-crdt-response',
        compositionRole: 'performance-response-1280',
        explanation:
          'Create the deterministic 1,280-item CRDT response as ordinary editable vector elements'
      }
    case 7075:
      return {
        actionId: 'create-cat-only-white-background',
        batchId: 'create-cat-only-white-background',
        compositionRole: 'cat-face',
        explanation:
          'Create only the reference cat on a same-size pure white editable vector canvas'
      }
  }
}

const readDetailedTabbyPathPrefix = async (
  itemCount: AsyraDesignServerResponseItemCount
): Promise<string> => {
  const input = createReadStream(DETAILED_TABBY_SOURCE_URL, {
    encoding: 'utf8'
  })
  const lines = createInterface({
    crlfDelay: Number.POSITIVE_INFINITY,
    input
  })
  const pathLines: string[] = []

  try {
    for await (const line of lines) {
      if (!line.trimStart().startsWith('<path ')) continue
      pathLines.push(line)
      if (pathLines.length === itemCount) break
    }
  } finally {
    lines.close()
    input.destroy()
  }

  if (pathLines.length !== itemCount) {
    throw new Error(
      `Detailed-tabby source contains ${pathLines.length} paths; expected ${itemCount}.`
    )
  }
  return pathLines.join('\n')
}

export const createAsyraDesignServerResponseRecord = async (
  fileId: string,
  itemCount: AsyraDesignServerResponseItemCount
): Promise<AsyraDesignServerResponseRecord> => {
  if (fileId.trim().length === 0) {
    throw new Error('Server response fileId must not be empty.')
  }

  const sourceSvg = await readDetailedTabbyPathPrefix(itemCount)
  const items = createCatOnlyWhiteBackgroundItemsAtSource(sourceSvg, {
    height: 941,
    itemLimit: itemCount,
    width: 1672
  })
  if (items.length !== itemCount) {
    throw new Error(
      `Detailed-tabby builder produced ${items.length} items; expected ${itemCount}.`
    )
  }
  const metadata = metadataForItemCount(itemCount)
  const artifact = createPreparedDrawingArtifact(items, {
    batchId: metadata.batchId,
    compositionRole: metadata.compositionRole,
    fileId
  })

  return {
    batch: {
      actions: [
        {
          arguments: artifact,
          id: metadata.actionId,
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
          summary: {
            affectedCount: artifact.elementCount,
            bounds: artifact.groupBounds,
            pointCount: artifact.pointCount,
            skippedCount: artifact.skipped.length
          }
        }
      ],
      batchId: metadata.batchId,
      explanation: metadata.explanation
    },
    fileId,
    schemaVersion: ASYRA_DESIGN_SERVER_RESPONSE_SCHEMA_VERSION
  }
}

export const seedAsyraDesignServerResponse = async (
  context: BrowserContext,
  { appUrl, fileId, itemCount }: SeedAsyraDesignServerResponseOptions
): Promise<AsyraDesignServerResponseRecord> => {
  const record = await createAsyraDesignServerResponseRecord(fileId, itemCount)
  const action = record.batch.actions[0]
  const artifact = action?.arguments as PreparedDrawingArtifact | undefined
  if (
    record.batch.actions.length !== 1 ||
    !artifact ||
    artifact.artifactVersion !== PREPARED_DRAWING_ARTIFACT_VERSION ||
    !artifact.groupDescriptor ||
    !Array.isArray(artifact.slices)
  ) {
    throw new Error(
      'Server response seed requires one prepared drawing artifact action.'
    )
  }
  const seedPage = await context.newPage()
  const routePattern = '**/*'
  const routeHandler = (route: Route) =>
    route.fulfill({
      body: '<!doctype html><html><body></body></html>',
      contentType: 'text/html; charset=utf-8',
      status: 200
    })

  await seedPage.route(routePattern, routeHandler)
  try {
    await seedPage.goto(appUrl, { waitUntil: 'domcontentloaded' })
    await seedPage.evaluate(
      ({
        databaseName,
        databaseVersion,
        response,
        responseFileId,
        storeName
      }: ServerResponseSeedPayload): Promise<void> =>
        new Promise((resolve, reject) => {
          const openRequest = indexedDB.open(databaseName, databaseVersion)
          openRequest.onblocked = () =>
            reject(new Error('Server response inbox seed open was blocked.'))
          openRequest.onerror = () =>
            reject(
              openRequest.error ??
                new Error('Server response inbox seed open failed.')
            )
          openRequest.onupgradeneeded = () => {
            if (!openRequest.result.objectStoreNames.contains(storeName)) {
              openRequest.result.createObjectStore(storeName)
            }
          }
          openRequest.onsuccess = () => {
            const database = openRequest.result
            try {
              const transaction = database.transaction(storeName, 'readwrite')
              transaction.onabort = () => {
                database.close()
                reject(
                  transaction.error ??
                    new Error(
                      'Server response inbox seed transaction was aborted.'
                    )
                )
              }
              transaction.onerror = () => {
                database.close()
                reject(
                  transaction.error ??
                    new Error('Server response inbox seed transaction failed.')
                )
              }
              transaction.oncomplete = () => {
                database.close()
                resolve()
              }
              transaction.objectStore(storeName).put(response, responseFileId)
            } catch (error) {
              database.close()
              reject(error)
            }
          }
        }),
      {
        databaseName: ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_NAME,
        databaseVersion: ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_VERSION,
        response: record,
        responseFileId: record.fileId,
        storeName: ASYRA_DESIGN_SERVER_RESPONSE_INBOX_STORE_NAME
      }
    )
  } finally {
    await seedPage.unroute(routePattern, routeHandler)
    await seedPage.close()
  }

  return record
}

export const seedPreparedAsyraDesignServerResponse = async (
  context: BrowserContext,
  { appUrl, fileId, publicPath }: SeedPreparedAsyraDesignServerResponseOptions
): Promise<PreparedAsyraDesignServerResponseSeedMetrics> => {
  const appOrigin = new URL(appUrl)
  const preparedResponseUrl = new URL(publicPath, appOrigin)
  if (
    !['http:', 'https:'].includes(appOrigin.protocol) ||
    preparedResponseUrl.origin !== appOrigin.origin ||
    fileId.trim().length === 0 ||
    fileId.length > MAXIMUM_SEED_STRING_LENGTH ||
    publicPath.trim().length === 0 ||
    publicPath.length > MAXIMUM_SEED_STRING_LENGTH
  ) {
    throw new Error(
      'Prepared server response seed requires bounded same-origin inputs.'
    )
  }

  const seedPageUrl = new URL(
    `/__endpoint-test__/server-response-seed/${encodeURIComponent(fileId)}`,
    appOrigin
  ).href
  const seedPage = await context.newPage()
  const routeHandler = (route: Route) =>
    route.fulfill({
      body: '<!doctype html><html><body></body></html>',
      contentType: 'text/html; charset=utf-8',
      status: 200
    })

  await seedPage.route(seedPageUrl, routeHandler)
  try {
    await seedPage.goto(seedPageUrl, { waitUntil: 'domcontentloaded' })
    const metrics = await seedPage.evaluate(
      async ({
        databaseName,
        databaseVersion,
        publicResponsePath,
        responseFileId,
        schemaVersion,
        storeName
      }): Promise<PreparedAsyraDesignServerResponseSeedMetrics> => {
        const isRecord = (value: unknown): value is Record<string, unknown> =>
          typeof value === 'object' && value !== null && !Array.isArray(value)
        const hasExactKeys = (
          value: Record<string, unknown>,
          expectedKeys: readonly string[]
        ): boolean => {
          const actualKeys = Object.keys(value)
          return (
            actualKeys.length === expectedKeys.length &&
            expectedKeys.every((key) =>
              Object.prototype.hasOwnProperty.call(value, key)
            )
          )
        }
        const boundedString = (value: unknown): value is string =>
          typeof value === 'string' && value.length > 0 && value.length <= 1_024
        const roundDuration = (value: number): number =>
          Math.round(value * 1_000) / 1_000

        const totalStartedAt = performance.now()
        const fetchStartedAt = performance.now()
        const fetchResponse = await fetch(publicResponsePath, {
          cache: 'force-cache'
        })
        if (!fetchResponse.ok) {
          throw new Error(
            `Prepared server response fetch failed (${fetchResponse.status}).`
          )
        }
        const compressedResponse = await fetchResponse.arrayBuffer()
        const fetchMs = performance.now() - fetchStartedAt
        if (compressedResponse.byteLength === 0) {
          throw new Error(
            'Prepared server response has an invalid compressed size.'
          )
        }

        const decodeStartedAt = performance.now()
        const decompressedResponse = new Response(
          new Blob([compressedResponse])
            .stream()
            .pipeThrough(new DecompressionStream('gzip'))
        )
        const response: unknown = await decompressedResponse.json()
        if (
          !isRecord(response) ||
          !hasExactKeys(response, ['batch', 'fileId', 'schemaVersion']) ||
          response.fileId !== responseFileId ||
          response.schemaVersion !== schemaVersion ||
          !isRecord(response.batch) ||
          !hasExactKeys(response.batch, [
            'actions',
            'batchId',
            'explanation'
          ]) ||
          !Array.isArray(response.batch.actions) ||
          response.batch.actions.length !== 1 ||
          !boundedString(response.batch.batchId) ||
          !boundedString(response.batch.explanation)
        ) {
          throw new Error(
            'Prepared server response envelope does not match the inbox contract.'
          )
        }
        const [action] = response.batch.actions
        if (
          !isRecord(action) ||
          !hasExactKeys(action, ['arguments', 'id', 'name', 'summary']) ||
          !boundedString(action.id) ||
          !boundedString(action.name) ||
          !isRecord(action.arguments) ||
          !isRecord(action.summary)
        ) {
          throw new Error(
            'Prepared server response action envelope is invalid.'
          )
        }
        const decodeMs = performance.now() - decodeStartedAt

        const indexedDbWriteStartedAt = performance.now()
        await new Promise<void>((resolve, reject) => {
          const openRequest = indexedDB.open(databaseName, databaseVersion)
          openRequest.onblocked = () =>
            reject(
              new Error('Prepared server response inbox open was blocked.')
            )
          openRequest.onerror = () =>
            reject(
              openRequest.error ??
                new Error('Prepared server response inbox open failed.')
            )
          openRequest.onupgradeneeded = () => {
            if (!openRequest.result.objectStoreNames.contains(storeName)) {
              openRequest.result.createObjectStore(storeName)
            }
          }
          openRequest.onsuccess = () => {
            const database = openRequest.result
            try {
              const transaction = database.transaction(storeName, 'readwrite')
              transaction.onabort = () => {
                database.close()
                reject(
                  transaction.error ??
                    new Error(
                      'Prepared server response inbox transaction was aborted.'
                    )
                )
              }
              transaction.onerror = () => {
                database.close()
                reject(
                  transaction.error ??
                    new Error(
                      'Prepared server response inbox transaction failed.'
                    )
                )
              }
              transaction.oncomplete = () => {
                database.close()
                resolve()
              }
              transaction.objectStore(storeName).put(response, responseFileId)
            } catch (error) {
              database.close()
              reject(error)
            }
          }
        })
        const indexedDbWriteMs = performance.now() - indexedDbWriteStartedAt

        return {
          compressedBytes: compressedResponse.byteLength,
          decodeMs: roundDuration(decodeMs),
          fetchMs: roundDuration(fetchMs),
          indexedDbWriteMs: roundDuration(indexedDbWriteMs),
          totalMs: roundDuration(performance.now() - totalStartedAt)
        }
      },
      {
        databaseName: ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_NAME,
        databaseVersion: ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_VERSION,
        publicResponsePath: publicPath,
        responseFileId: fileId,
        schemaVersion: ASYRA_DESIGN_SERVER_RESPONSE_SCHEMA_VERSION,
        storeName: ASYRA_DESIGN_SERVER_RESPONSE_INBOX_STORE_NAME
      }
    )
    if (
      !Number.isInteger(metrics.compressedBytes) ||
      metrics.compressedBytes <= 0 ||
      [metrics.decodeMs, metrics.fetchMs, metrics.indexedDbWriteMs].some(
        (metric) =>
          !Number.isFinite(metric) || metric < 0 || metric > metrics.totalMs
      ) ||
      !Number.isFinite(metrics.totalMs) ||
      metrics.totalMs < 0 ||
      metrics.totalMs > 3_600_000
    ) {
      throw new Error('Prepared server response seed returned invalid metrics.')
    }
    return metrics
  } finally {
    await seedPage.unroute(seedPageUrl, routeHandler)
    await seedPage.close()
  }
}

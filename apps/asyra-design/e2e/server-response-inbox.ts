import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { BrowserContext, Route } from '@playwright/test'
import { AsyraDesignAiActionNames } from '../src/constants/ai-actions'
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

interface ServerResponseMetadata {
  readonly actionId: string
  readonly batchId: string
  readonly compositionRole: string
  readonly explanation: string
}

interface ServerCompositionBounds {
  readonly [key: string]: number
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

interface ServerCompositionStyle {
  readonly fillColor?: string
  readonly strokeColor?: string
  readonly strokeWidth?: number
}

interface ServerCompositionItem {
  readonly bounds: ServerCompositionBounds
  readonly pathCount: number
  readonly pathStart: number
  readonly pointCount: number
  readonly primitive: 'oval' | 'vector'
  readonly role: string
  readonly style: ServerCompositionStyle
  readonly vectorEncoding?: 'paths' | 'points'
}

interface ServerCompositionPath {
  readonly closed: boolean
  readonly coordinateOffset: number
  readonly pointCount: number
}

interface ServerCompositionArtifact {
  readonly artifactVersion: 1
  readonly compositionRole: string
  readonly coordinates: ArrayBuffer
  readonly groupBounds: ServerCompositionBounds
  readonly items: readonly ServerCompositionItem[]
  readonly parent: 'workspace'
  readonly paths: readonly ServerCompositionPath[]
  readonly pointCount: number
  readonly skipped: readonly {
    readonly reason: 'duplicate-role'
    readonly role: string
  }[]
}

interface ServerResponseSeedPayload {
  readonly databaseName: string
  readonly databaseVersion: number
  readonly response: unknown
  readonly responseFileId: string
  readonly storeName: string
}

const WORKSPACE_LIMIT = 2048

class CoordinateWriter {
  private coordinates = new Float64Array(4096)
  private coordinateLength = 0

  get length(): number {
    return this.coordinateLength
  }

  append(x: number, y: number): void {
    this.ensureCapacity(this.coordinateLength + 2)
    this.coordinates[this.coordinateLength] = x
    this.coordinates[this.coordinateLength + 1] = y
    this.coordinateLength += 2
  }

  finish(): ArrayBuffer {
    return this.coordinates.slice(0, this.coordinateLength).buffer
  }

  truncate(length: number): void {
    this.coordinateLength = length
  }

  private ensureCapacity(required: number): void {
    if (required <= this.coordinates.length) return
    let capacity = this.coordinates.length
    while (capacity < required) capacity *= 2
    const grown = new Float64Array(capacity)
    grown.set(this.coordinates.subarray(0, this.coordinateLength))
    this.coordinates = grown
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

const appendPath = (
  path: DetailedTabbyPath,
  bounds: ServerCompositionBounds,
  itemIndex: number,
  coordinates: CoordinateWriter,
  paths: ServerCompositionPath[]
): number => {
  if (
    typeof path.closed !== 'boolean' ||
    !Array.isArray(path.points) ||
    path.points.length < 2 ||
    (path.closed && path.points.length < 3)
  ) {
    return invalidResponseComposition(`item ${itemIndex} has an invalid path`)
  }
  const coordinateOffset = coordinates.length
  for (const point of path.points) {
    if (
      !finiteNumber(point.x) ||
      !finiteNumber(point.y) ||
      point.x < bounds.x ||
      point.x > bounds.x + bounds.width ||
      point.y < bounds.y ||
      point.y > bounds.y + bounds.height
    ) {
      coordinates.truncate(coordinateOffset)
      return invalidResponseComposition(
        `item ${itemIndex} has an out-of-bounds point`
      )
    }
    coordinates.append(point.x, point.y)
  }
  paths.push({
    closed: path.closed,
    coordinateOffset,
    pointCount: path.points.length
  })
  return path.points.length
}

const appendItem = (
  item: DetailedTabbyCompositionItem,
  itemIndex: number,
  coordinates: CoordinateWriter,
  paths: ServerCompositionPath[]
): ServerCompositionItem => {
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
      pathCount: 0,
      pathStart: paths.length,
      pointCount: 0,
      primitive: 'oval',
      role: item.role,
      style
    }
  }

  const pathStart = paths.length
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
    for (const path of item.paths) {
      pointCount += appendPath(path, bounds, itemIndex, coordinates, paths)
    }
    return {
      bounds,
      pathCount: paths.length - pathStart,
      pathStart,
      pointCount,
      primitive: 'vector',
      role: item.role,
      style,
      vectorEncoding: 'paths'
    }
  }
  if (item.points === undefined || typeof item.closed !== 'boolean') {
    return invalidResponseComposition(
      `vector item ${itemIndex} is missing geometry`
    )
  }
  pointCount = appendPath(
    { closed: item.closed, points: item.points },
    bounds,
    itemIndex,
    coordinates,
    paths
  )
  return {
    bounds,
    pathCount: 1,
    pathStart,
    pointCount,
    primitive: 'vector',
    role: item.role,
    style,
    vectorEncoding: 'points'
  }
}

export const createAsyraDesignServerCompositionArtifact = (
  items: readonly DetailedTabbyCompositionItem[],
  compositionRole: string
): ServerCompositionArtifact => {
  if (
    items.length === 0 ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(compositionRole)
  ) {
    return invalidResponseComposition('the composition envelope is invalid')
  }

  const coordinates = new CoordinateWriter()
  const preparedItems: ServerCompositionItem[] = []
  const paths: ServerCompositionPath[] = []
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

  items.forEach((item, index) => {
    const pathStart = paths.length
    const coordinateStart = coordinates.length
    const prepared = appendItem(item, index, coordinates, paths)
    if (roles.has(prepared.role)) {
      paths.length = pathStart
      coordinates.truncate(coordinateStart)
      skipped.push({ reason: 'duplicate-role', role: prepared.role })
      return
    }
    roles.add(prepared.role)
    preparedItems.push(prepared)
    pointCount += prepared.pointCount
    minX = Math.min(minX, prepared.bounds.x)
    minY = Math.min(minY, prepared.bounds.y)
    maxX = Math.max(maxX, prepared.bounds.x + prepared.bounds.width)
    maxY = Math.max(maxY, prepared.bounds.y + prepared.bounds.height)
  })

  if (preparedItems.length === 0) {
    return invalidResponseComposition(
      'the composition contains no accepted item'
    )
  }
  return {
    artifactVersion: 1,
    compositionRole,
    coordinates: coordinates.finish(),
    groupBounds: {
      height: maxY - minY,
      width: maxX - minX,
      x: minX,
      y: minY
    },
    items: preparedItems,
    parent: 'workspace',
    paths,
    pointCount,
    skipped
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
  const artifact = createAsyraDesignServerCompositionArtifact(
    items,
    metadata.compositionRole
  )

  return {
    batch: {
      actions: [
        {
          arguments: artifact,
          id: metadata.actionId,
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
          summary: {
            affectedCount: artifact.items.length,
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
  const artifact = action?.arguments as ServerCompositionArtifact | undefined
  if (
    record.batch.actions.length !== 1 ||
    !artifact ||
    !(artifact.coordinates instanceof ArrayBuffer)
  ) {
    throw new Error(
      'Server response seed requires one compact composition action.'
    )
  }
  const browserTransferResponse = {
    ...record,
    batch: {
      ...record.batch,
      actions: [
        {
          ...action,
          arguments: {
            ...artifact,
            coordinates: new Float64Array(artifact.coordinates)
          }
        }
      ]
    }
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
          const responseRecord = response as {
            readonly batch: {
              readonly actions: readonly {
                readonly arguments: {
                  readonly coordinates: unknown
                }
              }[]
            }
          }
          const transferredCoordinates =
            responseRecord.batch.actions[0]?.arguments.coordinates
          if (!(transferredCoordinates instanceof Float64Array)) {
            reject(
              new Error(
                'Server response seed did not receive binary coordinates.'
              )
            )
            return
          }
          const residentResponse = {
            ...responseRecord,
            batch: {
              ...responseRecord.batch,
              actions: responseRecord.batch.actions.map((action, index) =>
                index === 0
                  ? {
                      ...action,
                      arguments: {
                        ...action.arguments,
                        coordinates: new Float64Array(transferredCoordinates)
                          .buffer
                      }
                    }
                  : action
              )
            }
          }
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
              transaction
                .objectStore(storeName)
                .put(residentResponse, responseFileId)
            } catch (error) {
              database.close()
              reject(error)
            }
          }
        }),
      {
        databaseName: ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_NAME,
        databaseVersion: ASYRA_DESIGN_SERVER_RESPONSE_INBOX_DATABASE_VERSION,
        response: browserTransferResponse,
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

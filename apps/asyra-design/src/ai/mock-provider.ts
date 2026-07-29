import {
  AiProviderError,
  type AiProvider,
  type AiProviderInput
} from '@asyra/ai-agent-runtime'
import {
  AsyraDesignAiActionNames,
  AsyraDesignAiDrawingDetailSelectionIntents
} from '../constants'
import { measureBrowserDragAsyncPhase } from '@asyra/utils'
import {
  createAsyraDesignVTracerClient,
  type AsyraDesignVTracer,
  type AsyraDesignVTracerAttachment
} from './vtracer'

export const ASYRA_DESIGN_MOCK_AI_DELAY_MS = 650
export const ASYRA_DESIGN_MOCK_AI_MAX_DELAY_MS = 10_000

export const AsyraDesignMockAiPhrases = Object.freeze({
  CREATE_CAT_FACE_EN: 'draw a cat face',
  CREATE_CAT_FACE_ZH: '畫一個貓臉',
  CREATE_DETAILED_CAT_FACE_EN: 'draw a detailed cat face',
  CREATE_DETAILED_CAT_FACE_ZH: '畫一個精緻的貓臉',
  CREATE_320_ITEM_CRDT_FIXTURE_EN:
    'create the 320-item CRDT performance fixture',
  CREATE_FAST_CRDT_FIXTURE_EN: 'create the fast CRDT performance fixture',
  DELETE_CAT_FACE_EN: 'delete the current cat face',
  DELETE_CAT_FACE_ZH: '刪除目前的貓臉',
  DRAW_REFERENCE_IMAGE_EN: 'draw this image',
  DRAW_REFERENCE_IMAGE_ZH: '請依照這張圖繪製',
  DRAW_ONLY_CAT_ON_SAME_SIZE_WHITE_BACKGROUND_EN:
    'Draw only the cat from the reference image. Exclude the original background and place the cat on a pure white background canvas with exactly the same width and height as the uploaded photo.',
  DRAW_REFERENCE_IMAGE_BALANCED_EN:
    AsyraDesignAiDrawingDetailSelectionIntents.BALANCED_EN,
  DRAW_REFERENCE_IMAGE_BALANCED_ZH:
    AsyraDesignAiDrawingDetailSelectionIntents.BALANCED_ZH,
  DRAW_REFERENCE_IMAGE_MAXIMUM_EN:
    AsyraDesignAiDrawingDetailSelectionIntents.MAXIMUM_EN,
  DRAW_REFERENCE_IMAGE_MAXIMUM_ZH:
    AsyraDesignAiDrawingDetailSelectionIntents.MAXIMUM_ZH,
  ENLARGE_EYES_EN: 'make the eyes bigger',
  ENLARGE_EYES_ZH: '把眼睛放大一點',
  PARTIAL_RESULT_EN: 'simulate a partial result',
  PARTIAL_RESULT_ZH: '模擬部分成功',
  PROVIDER_FAILURE_EN: 'simulate a provider failure',
  PROVIDER_FAILURE_ZH: '模擬 provider 失敗',
  RECOLOR_PUPILS_EN: 'make the pupils red',
  RECOLOR_WHISKERS_EN: 'make the whiskers blue',
  RECOLOR_WHISKERS_ZH: '把鬍鬚改成藍色',
  VECTORIZE_IMAGE_EN: 'Vectorize this image',
  VECTORIZE_IMAGE_ZH: '將這張圖片轉換成可編輯向量圖形'
} as const)

export type AsyraDesignMockAiDelay = (
  delayMs: number,
  signal: AbortSignal
) => Promise<void>

export interface CreateAsyraDesignMockAiProviderOptions {
  readonly delay?: AsyraDesignMockAiDelay
  readonly delayMs?: number
  readonly vectorizer?: AsyraDesignVTracer
}

export interface AsyraDesignMockAiProvider extends AiProvider {
  dispose(): Promise<void>
}

interface MockBounds {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

interface MockPoint {
  readonly x: number
  readonly y: number
}

interface MockPath {
  readonly closed: boolean
  readonly points: readonly MockPoint[]
}

interface MockStyle {
  readonly fillColor?: string
  readonly strokeColor?: string
  readonly strokeWidth?: number
}

interface MockCompositionItem {
  readonly bounds: MockBounds
  readonly closed?: boolean
  readonly paths?: readonly MockPath[]
  readonly points?: readonly MockPoint[]
  readonly primitive: 'oval' | 'vector'
  readonly role: string
  readonly style: MockStyle
}

type MockFixture =
  | 'create-balanced-cat-face'
  | 'create-cat-only-white-background'
  | 'create-320-crdt-fixture'
  | 'create-fast-crdt-fixture'
  | 'create-maximum-cat-face'
  | 'delete-cat-face'
  | 'enlarge-eyes'
  | 'partial-result'
  | 'provider-failure'
  | 'recolor-pupils'
  | 'recolor-whiskers'
  | 'request-drawing-detail-choice'
  | 'vectorize-image'

const defaultDelay: AsyraDesignMockAiDelay = (delayMs, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }

    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, delayMs)
    const abort = () => {
      globalThis.clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
  })

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  Reflect.ownKeys(value).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor && 'value' in descriptor) {
      deepFreeze(descriptor.value)
    }
  })
  return Object.freeze(value)
}

const boundsForPoints = (points: readonly MockPoint[]): MockBounds => {
  const xs = points.map(({ x }) => x)
  const ys = points.map(({ y }) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    height: Math.max(1, Math.max(...ys) - y),
    width: Math.max(1, Math.max(...xs) - x),
    x,
    y
  }
}

const multiPathVector = (
  role: string,
  paths: readonly MockPath[],
  style: MockStyle
): MockCompositionItem => ({
  bounds: boundsForPoints(paths.flatMap(({ points }) => points)),
  paths,
  primitive: 'vector',
  role,
  style
})

const createCrdtFixtureItems = (itemCount: number): MockCompositionItem[] => {
  const columnCount = Math.ceil(Math.sqrt(itemCount))
  const roleWidth = String(itemCount - 1).length
  return Array.from({ length: itemCount }, (_, index) => {
    const column = index % columnCount
    const row = Math.floor(index / columnCount)
    const x = 80 + column * 56
    const y = 80 + row * 56
    return multiPathVector(
      indexedRole('performance-vector', index, roleWidth),
      [
        {
          closed: true,
          points: [
            { x, y },
            { x: x + 32, y },
            { x: x + 32, y: y + 32 },
            { x, y: y + 32 }
          ]
        }
      ],
      {
        fillColor: index % 2 === 0 ? '#C9825B' : '#355070',
        strokeColor: '#1F2937',
        strokeWidth: 1
      }
    )
  })
}

const createFastCrdtFixtureItems = (): MockCompositionItem[] =>
  createCrdtFixtureItems(16)

const create320ItemCrdtFixtureItems = (): MockCompositionItem[] =>
  createCrdtFixtureItems(320)

const indexedRole = (prefix: string, index: number, width: number) =>
  `${prefix}-${String(index).padStart(width, '0')}`

const DETAILED_TABBY_SCALE = 0.55
const DETAILED_TABBY_ORIGIN = Object.freeze({ x: 20, y: 70 })
const DETAILED_TABBY_PATH_TOKEN_PATTERN = /[MmLlZz]|-?(?:\d+(?:\.\d*)?|\.\d+)/g

interface DetailedTabbyRoleCounters {
  leftEye: number
  leftWhisker: number
  rightEye: number
  rightWhisker: number
}

const parseDetailedTabbyPolygonPath = (data: string): MockPath[] => {
  const tokens = data.match(DETAILED_TABBY_PATH_TOKEN_PATTERN) ?? []
  const paths: MockPath[] = []
  let command = ''
  let currentPath: MockPoint[] | null = null
  let currentX = 0
  let currentY = 0
  let index = 0
  let startX = 0
  let startY = 0

  const finishPath = (closed: boolean) => {
    if (
      currentPath &&
      currentPath.length >= 2 &&
      (!closed || currentPath.length >= 3)
    ) {
      paths.push({ closed, points: currentPath })
    }
    currentPath = null
  }
  const readCoordinate = () => {
    const token = tokens[index]
    if (token === undefined || /^[A-Za-z]$/.test(token)) {
      throw new Error('Invalid deterministic detailed-tabby polygon data.')
    }
    index += 1
    return Number(token)
  }

  while (index < tokens.length) {
    const token = tokens[index]
    if (/^[A-Za-z]$/.test(token)) {
      command = token
      index += 1
      if (command === 'Z' || command === 'z') {
        finishPath(true)
        currentX = startX
        currentY = startY
        continue
      }
    }
    const nextX = readCoordinate()
    const nextY = readCoordinate()
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      throw new Error('Invalid deterministic detailed-tabby coordinate.')
    }
    if (command === 'M' || command === 'm') {
      finishPath(false)
      if (command === 'M') {
        currentX = nextX
        currentY = nextY
        command = 'L'
      } else {
        currentX += nextX
        currentY += nextY
        command = 'l'
      }
      startX = currentX
      startY = currentY
      currentPath = [{ x: currentX, y: currentY }]
      continue
    }
    if (!currentPath) {
      throw new Error('Detailed-tabby polygon is missing a move command.')
    }
    if (command === 'L') {
      currentX = nextX
      currentY = nextY
    } else if (command === 'l') {
      currentX += nextX
      currentY += nextY
    } else {
      throw new Error('Detailed-tabby polygon contains an unsupported command.')
    }
    currentPath.push({ x: currentX, y: currentY })
  }
  finishPath(false)
  return paths
}

interface DetailedTabbyTransform {
  readonly originX: number
  readonly originY: number
  readonly scaleX: number
  readonly scaleY: number
}

const transformDetailedTabbyPoint = (
  { x, y }: MockPoint,
  transform: DetailedTabbyTransform
): MockPoint => ({
  x: Number((x * transform.scaleX + transform.originX).toFixed(2)),
  y: Number((y * transform.scaleY + transform.originY).toFixed(2))
})

const isDetailedTabbyEyeRegion = (
  side: 'left' | 'right',
  centerX: number,
  centerY: number
) => {
  const minimumX = side === 'left' ? 590 : 910
  const maximumX = side === 'left' ? 760 : 1080
  return (
    centerX >= minimumX &&
    centerX <= maximumX &&
    centerY >= 420 &&
    centerY <= 565
  )
}

const detailedTabbyRole = (
  sourceIndex: number,
  sourceBounds: MockBounds,
  fillColor: string,
  counters: DetailedTabbyRoleCounters
): string => {
  if (sourceIndex === 0) {
    return 'portrait-background'
  }
  const centerX = sourceBounds.x + sourceBounds.width / 2
  const centerY = sourceBounds.y + sourceBounds.height / 2
  const isDarkPupil =
    /^#[0-9A-F]{6}$/.test(fillColor) &&
    Math.max(
      Number.parseInt(fillColor.slice(1, 3), 16),
      Number.parseInt(fillColor.slice(3, 5), 16),
      Number.parseInt(fillColor.slice(5, 7), 16)
    ) <= 24 &&
    sourceBounds.width <= 35 &&
    sourceBounds.height >= 25 &&
    sourceBounds.height <= 65
  if (
    isDarkPupil &&
    centerX >= 635 &&
    centerX <= 715 &&
    centerY >= 450 &&
    centerY <= 535
  ) {
    return 'left-pupil'
  }
  if (
    isDarkPupil &&
    centerX >= 945 &&
    centerX <= 1025 &&
    centerY >= 450 &&
    centerY <= 535
  ) {
    return 'right-pupil'
  }
  if (isDetailedTabbyEyeRegion('left', centerX, centerY)) {
    const eyeIndex = counters.leftEye
    counters.leftEye += 1
    return eyeIndex === 0
      ? 'left-eye'
      : indexedRole('left-eye-detail', eyeIndex, 4)
  }
  if (isDetailedTabbyEyeRegion('right', centerX, centerY)) {
    const eyeIndex = counters.rightEye
    counters.rightEye += 1
    return eyeIndex === 0
      ? 'right-eye'
      : indexedRole('right-eye-detail', eyeIndex, 4)
  }
  const isWhisker =
    sourceBounds.width > 80 &&
    sourceBounds.height < 55 &&
    centerY > 580 &&
    centerY < 870
  if (isWhisker && centerX < 790) {
    const whiskerIndex = counters.leftWhisker
    counters.leftWhisker += 1
    return indexedRole('left-whisker', whiskerIndex, 3)
  }
  if (isWhisker && centerX > 880) {
    const whiskerIndex = counters.rightWhisker
    counters.rightWhisker += 1
    return indexedRole('right-whisker', whiskerIndex, 3)
  }
  return indexedRole('tabby-vector', sourceIndex, 4)
}

const createTabbyItemsAtSource = (
  sourceSvg: string,
  transform: DetailedTabbyTransform = {
    originX: DETAILED_TABBY_ORIGIN.x,
    originY: DETAILED_TABBY_ORIGIN.y,
    scaleX: DETAILED_TABBY_SCALE,
    scaleY: DETAILED_TABBY_SCALE
  }
): MockCompositionItem[] => {
  const counters: DetailedTabbyRoleCounters = {
    leftEye: 0,
    leftWhisker: 0,
    rightEye: 0,
    rightWhisker: 0
  }
  const matches = sourceSvg.matchAll(
    /<path d="([^"]+)" fill="(#[0-9a-f]{6})"(?: transform="translate\((-?(?:\d+(?:\.\d*)?|\.\d+)),(-?(?:\d+(?:\.\d*)?|\.\d+))\)")?\s*\/>/gi
  )
  const items: MockCompositionItem[] = []
  let sourceIndex = 0
  for (const match of matches) {
    const translateX = match[3] === undefined ? 0 : Number(match[3])
    const translateY = match[4] === undefined ? 0 : Number(match[4])
    const sourcePaths = parseDetailedTabbyPolygonPath(match[1]).map((path) => ({
      ...path,
      points: path.points.map(({ x, y }) => ({
        x: x + translateX,
        y: y + translateY
      }))
    }))
    if (sourcePaths.length === 0) {
      sourceIndex += 1
      continue
    }
    const sourceBounds = boundsForPoints(
      sourcePaths.flatMap(({ points }) => points)
    )
    const fillColor = match[2].toUpperCase()
    const role = detailedTabbyRole(
      sourceIndex,
      sourceBounds,
      fillColor,
      counters
    )
    const paths = sourcePaths.map((path) => ({
      ...path,
      points: path.points.map((point) =>
        transformDetailedTabbyPoint(point, transform)
      )
    }))
    items.push(
      multiPathVector(role, paths, {
        fillColor,
        ...(role.includes('whisker')
          ? { strokeColor: fillColor, strokeWidth: 1 }
          : {})
      })
    )
    sourceIndex += 1
  }
  return items
}

const createBalancedCatFaceItems = async (): Promise<MockCompositionItem[]> => {
  const { default: sourceSvg } = await import(
    './fixtures/detailed-tabby-polygon.svg?raw'
  )
  return createTabbyItemsAtSource(sourceSvg)
}

const createMaximumCatFaceItems = async (): Promise<MockCompositionItem[]> => {
  const { default: sourceSvg } = await import(
    './fixtures/maximum-tabby-polygon.svg?raw'
  )
  return createTabbyItemsAtSource(sourceSvg)
}

interface ImageDimensions {
  readonly height: number
  readonly width: number
}

const createCatOnlyWhiteBackgroundItems = async (
  dimensions: ImageDimensions
): Promise<MockCompositionItem[]> => {
  const { default: sourceSvg } = await import(
    './fixtures/detailed-tabby-cat-only-white-background.svg?raw'
  )
  const items = createTabbyItemsAtSource(sourceSvg, {
    originX: 0,
    originY: 0,
    scaleX: dimensions.width / 1672,
    scaleY: dimensions.height / 941
  })
  const backgroundIndex = items.findIndex(
    ({ role }) => role === 'portrait-background'
  )
  if (backgroundIndex >= 0) {
    const background = items[backgroundIndex]
    items[backgroundIndex] = {
      ...background,
      style: {
        ...background.style,
        fillColor: '#FFFFFF'
      }
    }
  }
  return items
}

const decodeBase64DataUrl = (dataUrl: string): Uint8Array | null => {
  const separator = dataUrl.indexOf(',')
  if (separator < 0) {
    return null
  }
  try {
    const binary = globalThis.atob(dataUrl.slice(separator + 1))
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

const readUint16BigEndian = (bytes: Uint8Array, offset: number) =>
  bytes[offset] * 256 + bytes[offset + 1]

const readUint16LittleEndian = (bytes: Uint8Array, offset: number) =>
  bytes[offset] + bytes[offset + 1] * 256

const readUint24LittleEndian = (bytes: Uint8Array, offset: number) =>
  bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65_536

const validImageDimensions = (
  width: number,
  height: number
): ImageDimensions | null =>
  Number.isSafeInteger(width) &&
  Number.isSafeInteger(height) &&
  width > 0 &&
  height > 0
    ? { height, width }
    : null

const readPngDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return validImageDimensions(view.getUint32(16), view.getUint32(20))
}

const readJpegDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return validImageDimensions(
        readUint16BigEndian(bytes, offset + 7),
        readUint16BigEndian(bytes, offset + 5)
      )
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2
      continue
    }
    const segmentLength = readUint16BigEndian(bytes, offset + 2)
    if (segmentLength < 2) {
      return null
    }
    offset += segmentLength + 2
  }
  return null
}

const readWebpDimensions = (bytes: Uint8Array): ImageDimensions | null => {
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length))
  if (bytes.length < 30 || text(0, 4) !== 'RIFF' || text(8, 4) !== 'WEBP') {
    return null
  }
  const chunk = text(12, 4)
  if (chunk === 'VP8X') {
    return validImageDimensions(
      readUint24LittleEndian(bytes, 24) + 1,
      readUint24LittleEndian(bytes, 27) + 1
    )
  }
  if (chunk === 'VP8 ') {
    return validImageDimensions(
      readUint16LittleEndian(bytes, 26) & 0x3fff,
      readUint16LittleEndian(bytes, 28) & 0x3fff
    )
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8)
    const height =
      1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
    return validImageDimensions(width, height)
  }
  return null
}

const readAcceptedImageDimensions = (
  input: AiProviderInput
): ImageDimensions | null => {
  if (
    !isPlainObject(input.metadata) ||
    !Array.isArray(input.metadata.imageAttachments)
  ) {
    return null
  }
  for (const attachment of input.metadata.imageAttachments) {
    if (!isPlainObject(attachment) || typeof attachment.dataUrl !== 'string') {
      continue
    }
    const bytes = decodeBase64DataUrl(attachment.dataUrl)
    if (!bytes) {
      continue
    }
    let dimensions: ImageDimensions | null = null
    if (attachment.mediaType === 'image/png') {
      dimensions = readPngDimensions(bytes)
    } else if (attachment.mediaType === 'image/jpeg') {
      dimensions = readJpegDimensions(bytes)
    } else if (attachment.mediaType === 'image/webp') {
      dimensions = readWebpDimensions(bytes)
    }
    if (dimensions) {
      return dimensions
    }
  }
  return null
}

const hasAcceptedImageAttachment = (input: AiProviderInput): boolean => {
  if (
    !isPlainObject(input.metadata) ||
    !Array.isArray(input.metadata.imageAttachments)
  ) {
    return false
  }
  return input.metadata.imageAttachments.some(
    (attachment) =>
      isPlainObject(attachment) &&
      (attachment.mediaType === 'image/jpeg' ||
        attachment.mediaType === 'image/png' ||
        attachment.mediaType === 'image/webp') &&
      typeof attachment.name === 'string' &&
      attachment.name.length > 0 &&
      typeof attachment.size === 'number' &&
      Number.isSafeInteger(attachment.size) &&
      attachment.size > 0 &&
      typeof attachment.dataUrl === 'string' &&
      attachment.dataUrl.startsWith(
        `data:${attachment.mediaType as string};base64,`
      )
  )
}

const readAcceptedImageAttachments = (
  input: AiProviderInput
): readonly AsyraDesignVTracerAttachment[] => {
  if (
    !isPlainObject(input.metadata) ||
    !Array.isArray(input.metadata.imageAttachments)
  ) {
    return []
  }
  return input.metadata.imageAttachments.filter(
    (attachment): attachment is AsyraDesignVTracerAttachment =>
      isPlainObject(attachment) &&
      (attachment.mediaType === 'image/jpeg' ||
        attachment.mediaType === 'image/png' ||
        attachment.mediaType === 'image/webp') &&
      typeof attachment.name === 'string' &&
      attachment.name.length > 0 &&
      typeof attachment.size === 'number' &&
      Number.isSafeInteger(attachment.size) &&
      attachment.size > 0 &&
      typeof attachment.dataUrl === 'string' &&
      attachment.dataUrl.startsWith(
        `data:${attachment.mediaType as string};base64,`
      )
  )
}

const phraseToFixture = (input: AiProviderInput): MockFixture | null => {
  const normalized = input.intent.trim().toLocaleLowerCase('en-US')
  const phrases = AsyraDesignMockAiPhrases
  if (
    [phrases.VECTORIZE_IMAGE_ZH, phrases.VECTORIZE_IMAGE_EN].some(
      (candidate) => candidate.toLocaleLowerCase('en-US') === normalized
    )
  ) {
    return readAcceptedImageAttachments(input).length === 1
      ? 'vectorize-image'
      : null
  }
  if (
    normalized ===
    phrases.DRAW_ONLY_CAT_ON_SAME_SIZE_WHITE_BACKGROUND_EN.toLocaleLowerCase(
      'en-US'
    )
  ) {
    return hasAcceptedImageAttachment(input)
      ? 'create-cat-only-white-background'
      : null
  }
  if (
    [phrases.DRAW_REFERENCE_IMAGE_ZH, phrases.DRAW_REFERENCE_IMAGE_EN].some(
      (candidate) => candidate.toLocaleLowerCase('en-US') === normalized
    )
  ) {
    return hasAcceptedImageAttachment(input)
      ? 'request-drawing-detail-choice'
      : null
  }
  if (
    [
      phrases.DRAW_REFERENCE_IMAGE_BALANCED_ZH,
      phrases.DRAW_REFERENCE_IMAGE_BALANCED_EN
    ].some((candidate) => candidate.toLocaleLowerCase('en-US') === normalized)
  ) {
    return hasAcceptedImageAttachment(input) ? 'create-balanced-cat-face' : null
  }
  if (
    [
      phrases.DRAW_REFERENCE_IMAGE_MAXIMUM_ZH,
      phrases.DRAW_REFERENCE_IMAGE_MAXIMUM_EN
    ].some((candidate) => candidate.toLocaleLowerCase('en-US') === normalized)
  ) {
    return hasAcceptedImageAttachment(input) ? 'create-maximum-cat-face' : null
  }
  const fixtures: readonly [readonly string[], MockFixture][] = [
    [[phrases.CREATE_320_ITEM_CRDT_FIXTURE_EN], 'create-320-crdt-fixture'],
    [[phrases.CREATE_FAST_CRDT_FIXTURE_EN], 'create-fast-crdt-fixture'],
    [
      [
        phrases.CREATE_CAT_FACE_ZH,
        phrases.CREATE_CAT_FACE_EN,
        phrases.CREATE_DETAILED_CAT_FACE_ZH,
        phrases.CREATE_DETAILED_CAT_FACE_EN
      ],
      'create-balanced-cat-face'
    ],
    [[phrases.ENLARGE_EYES_ZH, phrases.ENLARGE_EYES_EN], 'enlarge-eyes'],
    [
      [phrases.RECOLOR_WHISKERS_ZH, phrases.RECOLOR_WHISKERS_EN],
      'recolor-whiskers'
    ],
    [[phrases.RECOLOR_PUPILS_EN], 'recolor-pupils'],
    [
      [phrases.DELETE_CAT_FACE_ZH, phrases.DELETE_CAT_FACE_EN],
      'delete-cat-face'
    ],
    [[phrases.PARTIAL_RESULT_ZH, phrases.PARTIAL_RESULT_EN], 'partial-result'],
    [
      [phrases.PROVIDER_FAILURE_ZH, phrases.PROVIDER_FAILURE_EN],
      'provider-failure'
    ]
  ]
  return (
    fixtures.find(([candidates]) =>
      candidates.some(
        (candidate) => candidate.toLocaleLowerCase('en-US') === normalized
      )
    )?.[1] ?? null
  )
}

const readAiTargets = (
  input: AiProviderInput
): {
  readonly compositionId: string | null
  readonly roleToElementIds: Readonly<Record<string, readonly string[]>>
} => {
  const source =
    isPlainObject(input.metadata) && isPlainObject(input.metadata.aiTargets)
      ? input.metadata
      : input.context
  if (!isPlainObject(source) || !isPlainObject(source.aiTargets)) {
    return {
      compositionId: null,
      roleToElementIds: {}
    }
  }

  const compositionId =
    typeof source.aiTargets.compositionId === 'string' &&
    source.aiTargets.compositionId.length > 0
      ? source.aiTargets.compositionId
      : null
  const roleToElementIds: Record<string, readonly string[]> = {}
  if (isPlainObject(source.aiTargets.roleToElementIds)) {
    for (const [role, value] of Object.entries(
      source.aiTargets.roleToElementIds
    )) {
      if (!Array.isArray(value)) {
        continue
      }
      const ids = [
        ...new Set(
          value.filter(
            (elementId): elementId is string =>
              typeof elementId === 'string' && elementId.length > 0
          )
        )
      ]
      if (ids.length > 0) {
        roleToElementIds[role] = Object.freeze(ids)
      }
    }
  }

  return {
    compositionId,
    roleToElementIds: Object.freeze(roleToElementIds)
  }
}

const invalidInput = (): never => {
  throw new AiProviderError({
    code: 'AI_PROVIDER_INVALID_INPUT',
    message: 'Mock AI request is unsupported or missing current targets.'
  })
}

const planForFixture = async (
  fixture: MockFixture,
  input: AiProviderInput,
  vectorizer: AsyraDesignVTracer,
  signal: AbortSignal
) => {
  const targets = readAiTargets(input)
  if (fixture === 'provider-failure') {
    throw new AiProviderError({
      code: 'AI_PROVIDER_TRANSPORT_FAILED',
      message: 'Mock AI provider failed.'
    })
  }

  if (fixture === 'request-drawing-detail-choice') {
    return deepFreeze({
      actions: [
        {
          arguments: {},
          id: 'mock-request-drawing-detail-choice',
          name: AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE
        }
      ],
      explanation: 'Choose a drawing detail level before creating elements',
      planId: 'mock-plan-request-drawing-detail-choice'
    })
  }

  if (fixture === 'vectorize-image') {
    const attachments = readAcceptedImageAttachments(input)
    if (attachments.length !== 1) {
      return invalidInput()
    }
    const result = await vectorizer.vectorize({
      attachment: attachments[0],
      profile: 'photo-faithful',
      signal
    })
    return deepFreeze({
      actions: [
        {
          arguments: {
            compositionRole: 'vectorized-image',
            items: result.items,
            parent: 'workspace'
          },
          id: 'mock-vectorize-reference-image',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Vectorize the complete attached image into ordinary editable Asyra vector elements',
      planId: 'mock-plan-vectorize-reference-image'
    })
  }

  if (fixture === 'create-balanced-cat-face') {
    return deepFreeze({
      actions: [
        {
          arguments: {
            compositionRole: 'cat-face',
            items: await createBalancedCatFaceItems(),
            parent: 'workspace'
          },
          id: 'mock-create-detailed-cat-face',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Create a high-detail tabby cat portrait from editable Asyra vector layers',
      planId: 'mock-plan-create-detailed-cat-face'
    })
  }

  if (fixture === 'create-fast-crdt-fixture') {
    return deepFreeze({
      actions: [
        {
          arguments: {
            compositionRole: 'performance-fixture',
            items: createFastCrdtFixtureItems(),
            parent: 'workspace'
          },
          id: 'mock-create-fast-crdt-fixture',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Create the deterministic fast CRDT fixture as ordinary editable vector elements',
      planId: 'mock-plan-create-fast-crdt-fixture'
    })
  }

  if (fixture === 'create-320-crdt-fixture') {
    return deepFreeze({
      actions: [
        {
          arguments: {
            compositionRole: 'performance-fixture-320',
            items: create320ItemCrdtFixtureItems(),
            parent: 'workspace'
          },
          id: 'mock-create-320-crdt-fixture',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Create the deterministic 320-item CRDT fixture as ordinary editable vector elements',
      planId: 'mock-plan-create-320-crdt-fixture'
    })
  }

  if (fixture === 'create-cat-only-white-background') {
    const dimensions = readAcceptedImageDimensions(input)
    if (!dimensions) {
      return invalidInput()
    }
    return deepFreeze({
      actions: [
        {
          arguments: {
            compositionRole: 'cat-face',
            items: await createCatOnlyWhiteBackgroundItems(dimensions),
            parent: 'workspace'
          },
          id: 'mock-create-cat-only-white-background',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Create only the reference cat on a same-size pure white editable vector canvas',
      planId: 'mock-plan-create-cat-only-white-background'
    })
  }

  if (fixture === 'create-maximum-cat-face') {
    return deepFreeze({
      actions: [
        {
          arguments: {
            compositionRole: 'cat-face',
            items: await createMaximumCatFaceItems(),
            parent: 'workspace'
          },
          id: 'mock-create-maximum-detail-cat-face',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Create a maximum-detail tabby portrait from editable Asyra vector layers',
      planId: 'mock-plan-create-maximum-detail-cat-face'
    })
  }

  if (fixture === 'partial-result') {
    const items = await createBalancedCatFaceItems()
    const duplicate = items.find(({ role }) => role === 'right-whisker-000')
    if (!duplicate) {
      throw new Error(
        'Deterministic detailed-tabby fixture is missing its partial-result role.'
      )
    }
    items.push(duplicate)
    return deepFreeze({
      actions: [
        {
          arguments: {
            compositionRole: 'cat-face',
            items,
            parent: 'workspace'
          },
          id: 'mock-create-partial-cat-face',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Create a high-detail cat face while demonstrating one recoverable skipped item',
      planId: 'mock-plan-partial-cat-face'
    })
  }

  if (fixture === 'enlarge-eyes') {
    const idsForEye = (side: 'left' | 'right') =>
      Object.entries(targets.roleToElementIds)
        .filter(
          ([role]) =>
            role === `${side}-eye` || role.startsWith(`${side}-eye-detail-`)
        )
        .flatMap(([, elementIds]) => elementIds)
    const left = idsForEye('left')
    const right = idsForEye('right')
    if (left.length === 0 || right.length === 0) {
      return invalidInput()
    }
    return deepFreeze({
      actions: [
        {
          arguments: {
            updates: [...left, ...right].map((elementId) => ({
              elementId,
              geometry: {
                scaleX: 1.2,
                scaleY: 1.2
              }
            }))
          },
          id: 'mock-enlarge-eyes',
          name: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS
        }
      ],
      explanation: 'Enlarge the existing cat-face eye elements',
      planId: 'mock-plan-enlarge-eyes'
    })
  }

  if (fixture === 'recolor-whiskers') {
    const whiskers = targets.roleToElementIds.whiskers
    if (!whiskers || whiskers.length === 0) {
      return invalidInput()
    }
    return deepFreeze({
      actions: [
        {
          arguments: {
            updates: whiskers.map((elementId) => ({
              elementId,
              style: {
                strokeColor: '#2563EB'
              }
            }))
          },
          id: 'mock-recolor-whiskers',
          name: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS
        }
      ],
      explanation: 'Recolor the existing cat-face whisker elements blue',
      planId: 'mock-plan-recolor-whiskers'
    })
  }

  if (fixture === 'recolor-pupils') {
    const pupils = targets.roleToElementIds.pupils
    if (!pupils || pupils.length === 0) {
      return invalidInput()
    }
    return deepFreeze({
      actions: [
        {
          arguments: {
            updates: pupils.map((elementId) => ({
              elementId,
              style: {
                fillColor: '#DC2626'
              }
            }))
          },
          id: 'mock-recolor-pupils',
          name: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS
        }
      ],
      explanation: 'Recolor the existing cat-face pupil elements red',
      planId: 'mock-plan-recolor-pupils'
    })
  }

  if (!targets.compositionId) {
    return invalidInput()
  }
  return deepFreeze({
    actions: [
      {
        arguments: {
          compositionId: targets.compositionId
        },
        id: 'mock-remove-cat-face',
        name: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION
      }
    ],
    explanation: 'Remove the existing cat-face composition',
    planId: 'mock-plan-remove-cat-face'
  })
}

const abortError = (disposed: boolean): AiProviderError =>
  new AiProviderError({
    code: disposed ? 'AI_PROVIDER_DISPOSED' : 'AI_PROVIDER_ABORTED',
    message: disposed
      ? 'Mock AI provider was disposed.'
      : 'Mock AI provider request was aborted.'
  })

const validateDelayMs = (value: number): number => {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > ASYRA_DESIGN_MOCK_AI_MAX_DELAY_MS
  ) {
    throw new AiProviderError({
      code: 'AI_PROVIDER_INVALID_CONFIGURATION',
      message: 'Mock AI delay configuration is invalid.'
    })
  }
  return value
}

export const createAsyraDesignMockAiProvider = (
  options: CreateAsyraDesignMockAiProviderOptions = {}
): AsyraDesignMockAiProvider => {
  const delay = options.delay ?? defaultDelay
  const delayMs = validateDelayMs(
    options.delayMs ?? ASYRA_DESIGN_MOCK_AI_DELAY_MS
  )
  const vectorizer = options.vectorizer ?? createAsyraDesignVTracerClient()
  const active = new Set<AbortController>()
  let disposed = false

  const provider: AsyraDesignMockAiProvider = {
    generateActionPlan: async (input, requestOptions) => {
      if (disposed) {
        throw abortError(true)
      }

      const controller = new AbortController()
      const abort = () => controller.abort(requestOptions.signal.reason)
      if (requestOptions.signal.aborted) {
        abort()
      } else {
        requestOptions.signal.addEventListener('abort', abort, { once: true })
      }
      active.add(controller)

      try {
        await measureBrowserDragAsyncPhase('ai-provider:delay', () =>
          delay(delayMs, controller.signal)
        )
        if (controller.signal.aborted) {
          throw abortError(disposed)
        }
        const fixture = phraseToFixture(input)
        if (!fixture) {
          return invalidInput()
        }
        return measureBrowserDragAsyncPhase(
          'ai-provider:materialize-plan',
          () => planForFixture(fixture, input, vectorizer, controller.signal)
        )
      } catch (error) {
        if (controller.signal.aborted) {
          throw abortError(disposed)
        }
        if (error instanceof AiProviderError) {
          throw error
        }
        throw new AiProviderError({
          code: 'AI_PROVIDER_TRANSPORT_FAILED',
          message: 'Mock AI provider failed.'
        })
      } finally {
        requestOptions.signal.removeEventListener('abort', abort)
        active.delete(controller)
      }
    },
    dispose: async () => {
      if (disposed) {
        return
      }
      disposed = true
      active.forEach((controller) => controller.abort())
      active.clear()
    }
  }

  return Object.freeze(provider)
}

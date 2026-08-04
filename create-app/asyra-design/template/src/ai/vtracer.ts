import {
  AI_WORKSPACE_LIMIT,
  type AiCompositionItem,
  type AiCompositionPath,
  type AiCompositionPoint
} from './actions'

export const VTRACER_ENDPOINT = '/api/ai-tools/vtracer'

export type VTracerProfile = 'photo-faithful'

export type VTracerErrorCode =
  | 'VTRACER_ABORTED'
  | 'VTRACER_FAILED'
  | 'VTRACER_INVALID_INPUT'
  | 'VTRACER_INVALID_OUTPUT'

export class VTracerError extends Error {
  readonly code: VTracerErrorCode

  constructor(code: VTracerErrorCode, message: string) {
    super(message)
    this.name = 'VTracerError'
    this.code = code
  }
}

export interface VTracerAttachment {
  readonly dataUrl: string
  readonly mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  readonly name: string
  readonly size: number
}

export interface VTracerRequest {
  readonly attachment: VTracerAttachment
  readonly profile: VTracerProfile
  readonly signal: AbortSignal
}

export interface VTracerResult {
  readonly height: number
  readonly items: readonly AiCompositionItem[]
  readonly pointCount: number
  readonly width: number
}

export interface VTracer {
  vectorize(request: VTracerRequest): Promise<VTracerResult>
}

interface CreateVTracerClientOptions {
  readonly endpoint?: string
  readonly fetch?: typeof globalThis.fetch
}

const NUMBER_PATTERN = '-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?'
const PATH_TOKEN_PATTERN = new RegExp(`[A-Za-z]|${NUMBER_PATTERN}`, 'g')
const SUPPORTED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const invalidOutput = (message: string): never => {
  throw new VTracerError('VTRACER_INVALID_OUTPUT', message)
}

const parsePositiveDimension = (value: string | null): number => {
  if (value === null || !new RegExp(`^${NUMBER_PATTERN}$`).test(value)) {
    return invalidOutput('VTracer SVG dimensions are invalid.')
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    return invalidOutput('VTracer SVG dimensions are invalid.')
  }
  return number
}

const polygonArea = (points: readonly AiCompositionPoint[]): number => {
  let area = 0
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    area += point.x * next.y - next.x * point.y
  })
  return Math.abs(area / 2)
}

const isValidPath = (path: AiCompositionPath): boolean => {
  if (path.closed) {
    return path.points.length >= 3 && polygonArea(path.points) > 0
  }
  return path.points.length >= 2
}

const parsePolygonPath = (
  source: string,
  scale: number
): AiCompositionPath[] => {
  const tokens = source.match(PATH_TOKEN_PATTERN) ?? []
  const remainder = source.replace(PATH_TOKEN_PATTERN, '').replace(/[,\s]/g, '')
  if (tokens.length === 0 || remainder.length > 0) {
    return invalidOutput('VTracer SVG path data is invalid.')
  }

  const paths: AiCompositionPath[] = []
  let command = ''
  let current: AiCompositionPoint[] | null = null
  let index = 0

  const finish = (closed: boolean) => {
    if (current) {
      const path = Object.freeze({
        closed,
        points: Object.freeze(current)
      })
      if (isValidPath(path)) {
        paths.push(path)
      }
    }
    current = null
  }
  const readNumber = (): number => {
    const token = tokens[index]
    if (token === undefined || /^[A-Za-z]$/.test(token)) {
      return invalidOutput('VTracer SVG path coordinates are invalid.')
    }
    index += 1
    const value = Number(token)
    if (!Number.isFinite(value)) {
      return invalidOutput('VTracer SVG path coordinates are invalid.')
    }
    return Number((value * scale).toFixed(4))
  }

  while (index < tokens.length) {
    const token = tokens[index]
    if (/^[A-Za-z]$/.test(token)) {
      if (token !== 'M' && token !== 'L' && token !== 'Z') {
        return invalidOutput(
          'VTracer SVG contains an unsupported path command.'
        )
      }
      command = token
      index += 1
      if (command === 'Z') {
        finish(true)
        continue
      }
    }
    if (command !== 'M' && command !== 'L') {
      return invalidOutput('VTracer SVG path is missing a move command.')
    }
    const point = Object.freeze({ x: readNumber(), y: readNumber() })
    if (command === 'M') {
      finish(false)
      current = [point]
      command = 'L'
    } else {
      if (!current) {
        return invalidOutput('VTracer SVG path is missing a move command.')
      }
      current.push(point)
    }
  }
  finish(false)
  return paths
}

const boundsForPaths = (paths: readonly AiCompositionPath[]) => {
  let x = Number.POSITIVE_INFINITY
  let y = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  paths.forEach((path) => {
    path.points.forEach((point) => {
      x = Math.min(x, point.x)
      y = Math.min(y, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  })
  const width = maxX - x
  const height = maxY - y
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x + width > AI_WORKSPACE_LIMIT ||
    y + height > AI_WORKSPACE_LIMIT
  ) {
    return null
  }
  return Object.freeze({ height, width, x, y })
}

export const parseVTracerSvg = (source: string): VTracerResult => {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (document.querySelector('parsererror')) {
    return invalidOutput('VTracer returned malformed SVG.')
  }
  const svg = document.documentElement
  if (svg.localName !== 'svg' || document.querySelector('[transform]')) {
    return invalidOutput('VTracer returned unsupported SVG structure.')
  }
  const sourceWidth = parsePositiveDimension(svg.getAttribute('width'))
  const sourceHeight = parsePositiveDimension(svg.getAttribute('height'))
  const scale = Math.min(
    1,
    AI_WORKSPACE_LIMIT / sourceWidth,
    AI_WORKSPACE_LIMIT / sourceHeight
  )
  const items: AiCompositionItem[] = []
  let pointCount = 0

  Array.from(document.querySelectorAll('path')).forEach((element) => {
    const data = element.getAttribute('d')
    const fill = element.getAttribute('fill')
    if (data === null || fill === null || !/^#[0-9a-f]{6}$/i.test(fill)) {
      return invalidOutput('VTracer SVG path presentation is invalid.')
    }
    const paths = parsePolygonPath(data, scale)
    const bounds = paths.length > 0 ? boundsForPaths(paths) : null
    if (!bounds) {
      return
    }
    pointCount += paths.reduce((total, path) => total + path.points.length, 0)
    items.push(
      Object.freeze({
        bounds,
        paths: Object.freeze(paths),
        primitive: 'vector',
        role: `reference-vector-${String(items.length + 1).padStart(6, '0')}`,
        style: Object.freeze({ fillColor: fill.toUpperCase() })
      })
    )
  })

  if (items.length === 0) {
    return invalidOutput('VTracer returned no finite editable vector paths.')
  }
  return Object.freeze({
    height: Number((sourceHeight * scale).toFixed(4)),
    items: Object.freeze(items),
    pointCount,
    width: Number((sourceWidth * scale).toFixed(4))
  })
}

const decodeAttachment = (attachment: VTracerAttachment): Uint8Array => {
  if (
    !SUPPORTED_MEDIA_TYPES.has(attachment.mediaType) ||
    !Number.isSafeInteger(attachment.size) ||
    attachment.size <= 0 ||
    !attachment.dataUrl.startsWith(
      `data:${attachment.mediaType as string};base64,`
    )
  ) {
    throw new VTracerError(
      'VTRACER_INVALID_INPUT',
      'VTracer attachment is invalid.'
    )
  }
  try {
    const payload = attachment.dataUrl.slice(
      attachment.dataUrl.indexOf(',') + 1
    )
    const binary = globalThis.atob(payload)
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0)
    )
    if (bytes.length === 0 || bytes.length !== attachment.size) {
      throw new Error('size mismatch')
    }
    return bytes
  } catch {
    throw new VTracerError(
      'VTRACER_INVALID_INPUT',
      'VTracer attachment is invalid.'
    )
  }
}

const aborted = (): VTracerError =>
  new VTracerError('VTRACER_ABORTED', 'VTracer request was aborted.')

const normalizeWebpToPng = async (
  bytes: Uint8Array,
  signal: AbortSignal
): Promise<Uint8Array> => {
  if (signal.aborted) {
    throw aborted()
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await globalThis.createImageBitmap(
      new Blob([Uint8Array.from(bytes)], { type: 'image/webp' })
    )
  } catch {
    if (signal.aborted) {
      throw aborted()
    }
    throw new VTracerError(
      'VTRACER_INVALID_INPUT',
      'VTracer attachment is invalid.'
    )
  }
  try {
    if (signal.aborted) {
      throw aborted()
    }
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new VTracerError('VTRACER_FAILED', 'VTracer request failed.')
    }
    context.drawImage(bitmap, 0, 0)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(
                new VTracerError('VTRACER_FAILED', 'VTracer request failed.')
              ),
        'image/png'
      )
    })
    if (signal.aborted) {
      throw aborted()
    }
    const normalized = new Uint8Array(await png.arrayBuffer())
    if (signal.aborted) {
      throw aborted()
    }
    return normalized
  } finally {
    bitmap.close()
  }
}

export const createVTracerClient = (
  options: CreateVTracerClientOptions = {}
): VTracer => {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const endpoint = options.endpoint ?? VTRACER_ENDPOINT
  return Object.freeze({
    vectorize: async ({ attachment, profile, signal }: VTracerRequest) => {
      if (signal.aborted) {
        throw aborted()
      }
      const attachmentBytes = decodeAttachment(attachment)
      const normalizedWebp = attachment.mediaType === 'image/webp'
      const bytes = normalizedWebp
        ? await normalizeWebpToPng(attachmentBytes, signal)
        : attachmentBytes
      let response: Response
      try {
        response = await fetchImplementation(endpoint, {
          body: bytes,
          headers: {
            'content-type': normalizedWebp ? 'image/png' : attachment.mediaType,
            'x-asyra-vtracer-profile': profile
          },
          method: 'POST',
          signal
        })
      } catch {
        throw new VTracerError(
          signal.aborted ? 'VTRACER_ABORTED' : 'VTRACER_FAILED',
          signal.aborted
            ? 'VTracer request was aborted.'
            : 'VTracer request failed.'
        )
      }
      if (
        !response.ok ||
        !response.headers
          .get('content-type')
          ?.toLocaleLowerCase('en-US')
          .startsWith('image/svg+xml')
      ) {
        throw new VTracerError('VTRACER_FAILED', 'VTracer request failed.')
      }
      return parseVTracerSvg(await response.text())
    }
  })
}

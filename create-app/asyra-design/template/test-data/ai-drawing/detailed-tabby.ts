export interface DetailedTabbyBounds {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

export interface DetailedTabbyPoint {
  readonly x: number
  readonly y: number
}

export interface DetailedTabbyPath {
  readonly closed: boolean
  readonly points: readonly DetailedTabbyPoint[]
}

export interface DetailedTabbyStyle {
  readonly fillColor?: string
  readonly strokeColor?: string
  readonly strokeWidth?: number
}

export interface DetailedTabbyCompositionItem {
  readonly bounds: DetailedTabbyBounds
  readonly closed?: boolean
  readonly paths?: readonly DetailedTabbyPath[]
  readonly points?: readonly DetailedTabbyPoint[]
  readonly primitive: 'oval' | 'vector'
  readonly role: string
  readonly style: DetailedTabbyStyle
}

export interface DetailedTabbyTransform {
  readonly originX: number
  readonly originY: number
  readonly scaleX: number
  readonly scaleY: number
}

interface DetailedTabbyRoleCounters {
  leftEye: number
  leftWhisker: number
  rightEye: number
  rightWhisker: number
}

const DEFAULT_TRANSFORM = Object.freeze({
  originX: 20,
  originY: 70,
  scaleX: 0.55,
  scaleY: 0.55
})
const PATH_TOKEN_PATTERN = /[MmLlZz]|-?(?:\d+(?:\.\d*)?|\.\d+)/g
const SVG_PATH_PATTERN =
  /<path d="([^"]+)" fill="(#[0-9a-f]{6})"(?: transform="translate\((-?(?:\d+(?:\.\d*)?|\.\d+)),(-?(?:\d+(?:\.\d*)?|\.\d+))\)")?\s*\/>/gi

const boundsForPoints = (
  points: readonly DetailedTabbyPoint[]
): DetailedTabbyBounds => {
  let minimumX = Number.POSITIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  for (const { x, y } of points) {
    minimumX = Math.min(minimumX, x)
    minimumY = Math.min(minimumY, y)
    maximumX = Math.max(maximumX, x)
    maximumY = Math.max(maximumY, y)
  }
  return {
    height: Math.max(1, maximumY - minimumY),
    width: Math.max(1, maximumX - minimumX),
    x: minimumX,
    y: minimumY
  }
}

const boundsForPaths = (
  paths: readonly DetailedTabbyPath[]
): DetailedTabbyBounds => {
  const points: DetailedTabbyPoint[] = []
  for (const path of paths) {
    points.push(...path.points)
  }
  return boundsForPoints(points)
}

const indexedRole = (prefix: string, index: number, width: number) =>
  `${prefix}-${String(index).padStart(width, '0')}`

const parsePolygonPath = (data: string): DetailedTabbyPath[] => {
  const tokens = data.match(PATH_TOKEN_PATTERN) ?? []
  const paths: DetailedTabbyPath[] = []
  let command = ''
  let currentPath: DetailedTabbyPoint[] | null = null
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

const transformPoint = (
  { x, y }: DetailedTabbyPoint,
  transform: DetailedTabbyTransform
): DetailedTabbyPoint => ({
  x: Number((x * transform.scaleX + transform.originX).toFixed(2)),
  y: Number((y * transform.scaleY + transform.originY).toFixed(2))
})

const isEyeRegion = (
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
  sourceBounds: DetailedTabbyBounds,
  fillColor: string,
  counters: DetailedTabbyRoleCounters
): string => {
  if (sourceIndex === 0) return 'portrait-background'

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
  if (isEyeRegion('left', centerX, centerY)) {
    const eyeIndex = counters.leftEye
    counters.leftEye += 1
    return eyeIndex === 0
      ? 'left-eye'
      : indexedRole('left-eye-detail', eyeIndex, 4)
  }
  if (isEyeRegion('right', centerX, centerY)) {
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

export const createDetailedTabbyItemsAtSource = (
  sourceSvg: string,
  options: {
    readonly itemLimit?: number
    readonly transform?: DetailedTabbyTransform
  } = {}
): DetailedTabbyCompositionItem[] => {
  const itemLimit = options.itemLimit ?? Number.POSITIVE_INFINITY
  if (
    itemLimit !== Number.POSITIVE_INFINITY &&
    (!Number.isSafeInteger(itemLimit) || itemLimit < 1)
  ) {
    throw new Error('Detailed-tabby item limit must be a positive integer.')
  }
  const transform = options.transform ?? DEFAULT_TRANSFORM
  const counters: DetailedTabbyRoleCounters = {
    leftEye: 0,
    leftWhisker: 0,
    rightEye: 0,
    rightWhisker: 0
  }
  const items: DetailedTabbyCompositionItem[] = []
  let sourceIndex = 0
  for (const match of sourceSvg.matchAll(SVG_PATH_PATTERN)) {
    const translateX = match[3] === undefined ? 0 : Number(match[3])
    const translateY = match[4] === undefined ? 0 : Number(match[4])
    const sourcePaths = parsePolygonPath(match[1]).map((path) => ({
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
    const sourceBounds = boundsForPaths(sourcePaths)
    const fillColor = match[2].toUpperCase()
    const role = detailedTabbyRole(
      sourceIndex,
      sourceBounds,
      fillColor,
      counters
    )
    const paths = sourcePaths.map((path) => ({
      ...path,
      points: path.points.map((point) => transformPoint(point, transform))
    }))
    items.push({
      bounds: boundsForPaths(paths),
      paths,
      primitive: 'vector',
      role,
      style: {
        fillColor,
        ...(role.includes('whisker')
          ? { strokeColor: fillColor, strokeWidth: 1 }
          : {})
      }
    })
    if (items.length === itemLimit) break
    sourceIndex += 1
  }
  return items
}

export const createCatOnlyWhiteBackgroundItemsAtSource = (
  sourceSvg: string,
  options: {
    readonly height: number
    readonly itemLimit?: number
    readonly width: number
  }
): DetailedTabbyCompositionItem[] => {
  const items = createDetailedTabbyItemsAtSource(sourceSvg, {
    ...(options.itemLimit === undefined
      ? {}
      : { itemLimit: options.itemLimit }),
    transform: {
      originX: 0,
      originY: 0,
      scaleX: options.width / 1672,
      scaleY: options.height / 941
    }
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

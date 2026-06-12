import { Container, Graphics } from 'pixi.js'
import {
  createRenderGradientFillStyle,
  createMeshProjection,
  type CreateRenderGradientFillOptions,
  type GeometryModel,
  type MeshProjection,
  type RenderFillStyle
} from '@asyra/render'
import type { RenderableStroke } from './renderable-stroke'
import type {
  SolidCenterStrokeGeometryDebugMeta,
  SolidCenterStrokeRuntimeMeta
} from './solid-center-stroke-packets'
import {
  computeStrokeDirtyKeys,
  type StrokeDirtyKey,
  type StrokeRevisionSet
} from './stroke-dirty-keys'

interface Vec2 {
  x: number
  y: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface SolidCenterStrokeRenderEntry {
  cacheKey: string
  stroke: Pick<
    RenderableStroke,
    'kind' | 'color' | 'alpha' | 'gradientStyle' | 'paintKey'
  >
  polygons: Vec2[][]
  fillPolygons?: Vec2[][]
  clipPolygons?: Vec2[][]
  fillClipPolygons?: Vec2[][]
  strokeMaskPolygons?: Vec2[][]
  strokePaths?: Vec2[][]
  strokePathGroups?: {
    strokePaths: Vec2[][]
    strokePathStyle?: Pick<
      RenderableStroke,
      'width' | 'cap' | 'join' | 'miterLimit'
    > & { closed?: boolean }
  }[]
  strokePathStyle?: Pick<
    RenderableStroke,
    'width' | 'cap' | 'join' | 'miterLimit'
  > & { closed?: boolean }
  paintBounds?: Bounds
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
  runtimeMeta?: SolidCenterStrokeRuntimeMeta
  preferSolidGraphics?: boolean
  revisionSet?: StrokeRevisionSet
}

interface SolidStrokeCacheSolidEntry {
  kind: 'solid'
  projection: MeshProjection
  signature: string
  paintKey: string
  revisionSet?: StrokeRevisionSet
  lastDirtyKeys?: StrokeDirtyKey[]
}

interface SolidStrokeCacheGradientEntry {
  kind: 'gradient'
  container: Container
  graphics: Graphics
  signature: string
  paintKey: string
  revisionSet?: StrokeRevisionSet
  lastDirtyKeys?: StrokeDirtyKey[]
}

interface SolidStrokeCacheMaskedSolidEntry {
  kind: 'masked-solid'
  container: Container
  content: Container
  clipContent: Container
  fill: Graphics
  mask: Graphics
  fillMask: Graphics
  strokeMask: Graphics
  signature: string
  paintKey: string
  revisionSet?: StrokeRevisionSet
  lastDirtyKeys?: StrokeDirtyKey[]
}

interface SolidStrokeCacheDragSolidGraphicsEntry {
  kind: 'drag-solid-graphics' | 'solid-graphics'
  graphics: Graphics
  signature: string
  paintKey: string
  revisionSet?: StrokeRevisionSet
  lastDirtyKeys?: StrokeDirtyKey[]
}

interface SolidCenterStrokeRenderGraphic {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addChild?: (...args: any[]) => unknown
  __asyraStrokeMeshCache?: Map<
    string,
    | SolidStrokeCacheSolidEntry
    | SolidStrokeCacheGradientEntry
    | SolidStrokeCacheMaskedSolidEntry
    | SolidStrokeCacheDragSolidGraphicsEntry
  >
}

const isSolidGraphicsCacheEntry = (
  entry:
    | SolidStrokeCacheSolidEntry
    | SolidStrokeCacheGradientEntry
    | SolidStrokeCacheMaskedSolidEntry
    | SolidStrokeCacheDragSolidGraphicsEntry
): entry is SolidStrokeCacheDragSolidGraphicsEntry =>
  entry.kind === 'drag-solid-graphics' || entry.kind === 'solid-graphics'

const buildGeometryModel = (polygons: Vec2[][]): GeometryModel => {
  const normalizedPolygons = polygons.map((polygon) =>
    polygon.map((point) => ({ x: point.x, y: point.y }))
  )

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  normalizedPolygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  return {
    polygons: normalizedPolygons,
    bounds: Number.isFinite(minX)
      ? {
          minX,
          minY,
          maxX,
          maxY
        }
      : undefined
  }
}

const getSignature = (polygons: Vec2[][]) =>
  polygons
    .map((polygon) =>
      polygon
        .map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)
        .join(';')
    )
    .join('|')

const getStrokePathStyleSignature = (
  style: SolidCenterStrokeRenderEntry['strokePathStyle']
) =>
  style
    ? [
        style.width.toFixed(3),
        style.cap,
        style.join,
        style.miterLimit.toFixed(3),
        style.closed === undefined ? 'auto' : style.closed ? 'closed' : 'open'
      ].join(':')
    : ''

const getPolygonSummarySignature = (polygons: Vec2[][] | undefined) => {
  if (!polygons || polygons.length === 0) {
    return '0:0'
  }

  let pointCount = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  polygons.forEach((polygon) => {
    pointCount += polygon.length
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  })

  return [
    polygons.length,
    pointCount,
    Number.isFinite(minX) ? minX.toFixed(3) : 'NaN',
    Number.isFinite(minY) ? minY.toFixed(3) : 'NaN',
    Number.isFinite(maxX) ? maxX.toFixed(3) : 'NaN',
    Number.isFinite(maxY) ? maxY.toFixed(3) : 'NaN'
  ].join(':')
}

const getMaskedSolidDescriptorSummarySignature = (
  entry: SolidCenterStrokeRenderEntry,
  polygons: Vec2[][]
) =>
  [
    'masked-solid-descriptor-summary',
    getPolygonSummarySignature(polygons),
    getPolygonSummarySignature(entry.fillPolygons),
    getPolygonSummarySignature(entry.clipPolygons),
    getPolygonSummarySignature(entry.fillClipPolygons),
    getPolygonSummarySignature(entry.strokeMaskPolygons),
    getPolygonSummarySignature(entry.strokePaths),
    entry.strokePathGroups
      ?.map((group) =>
        [
          getPolygonSummarySignature(group.strokePaths),
          getStrokePathStyleSignature(
            group.strokePathStyle ?? entry.strokePathStyle
          )
        ].join('~')
      )
      .join(';') ?? '',
    getStrokePathStyleSignature(entry.strokePathStyle)
  ].join('|')

const getMaskedSolidDescriptorSignature = (
  entry: SolidCenterStrokeRenderEntry,
  polygons: Vec2[][]
) => {
  return [
    'masked-solid-descriptor',
    getSignature(polygons),
    getSignature(entry.fillPolygons ?? []),
    getSignature(entry.clipPolygons ?? []),
    getSignature(entry.fillClipPolygons ?? []),
    getSignature(entry.strokeMaskPolygons ?? []),
    getSignature(entry.strokePaths ?? []),
    entry.strokePathGroups
      ?.map((group) =>
        [
          getSignature(group.strokePaths),
          getStrokePathStyleSignature(
            group.strokePathStyle ?? entry.strokePathStyle
          )
        ].join('~')
      )
      .join(';') ?? '',
    getStrokePathStyleSignature(entry.strokePathStyle)
  ].join('|')
}

const getRevisionGeometrySignature = (
  revisionSet: StrokeRevisionSet | undefined
) =>
  revisionSet
    ? [
        revisionSet.sourcePathRevision,
        revisionSet.strokeSpecRevision,
        revisionSet.strokeFamilyRevision ?? '',
        revisionSet.intervalAllocationRevision,
        revisionSet.dashScheduleRevision ?? '',
        revisionSet.terminalCapRevision ?? '',
        revisionSet.joinShapeRevision ?? '',
        revisionSet.topologyClassificationRevision,
        revisionSet.candidateRevision ?? '',
        revisionSet.arrangementRevision ?? '',
        revisionSet.ownershipRevision,
        revisionSet.legalityRevision,
        revisionSet.resolvedRegionRevision ?? '',
        revisionSet.renderOutputRevision ?? '',
        revisionSet.previewModeRevision
      ].join('|')
    : null

const drawPolygons = (graphics: Graphics, polygons: Vec2[][]) => {
  polygons.forEach((polygon) => {
    drawPolygon(graphics, polygon)
  })
}

const getSignedPolygonArea = (polygon: Vec2[]) =>
  polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0) / 2

const getPolygonReferencePoint = (polygon: Vec2[]) => ({
  x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
  y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length
})

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i]
    const previous = polygon[j]
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const drawPolygonsWithCutouts = (
  graphics: Graphics,
  polygons: Vec2[][],
  fill: { color: number; alpha: number }
) => {
  const drawablePolygons = polygons.filter((polygon) => polygon.length >= 3)
  const positivePolygons = drawablePolygons.filter(
    (polygon) => getSignedPolygonArea(polygon) >= 0
  )
  const holePolygons = drawablePolygons.filter(
    (polygon) => getSignedPolygonArea(polygon) < 0
  )
  const outerPolygons =
    positivePolygons.length > 0 ? positivePolygons : drawablePolygons
  const consumedHoles = new Set<Vec2[]>()

  outerPolygons.forEach((outerPolygon) => {
    const containedHoles = holePolygons.filter((holePolygon) => {
      if (consumedHoles.has(holePolygon)) {
        return false
      }
      return isPointInPolygon(
        getPolygonReferencePoint(holePolygon),
        outerPolygon
      )
    })

    drawPolygon(graphics, outerPolygon)
    graphics.fill(fill)
    containedHoles.forEach((holePolygon) => {
      drawPolygon(graphics, holePolygon)
      graphics.cut()
      consumedHoles.add(holePolygon)
    })
  })

  holePolygons.forEach((holePolygon) => {
    if (consumedHoles.has(holePolygon)) {
      return
    }
    drawPolygon(graphics, [...holePolygon].reverse())
    graphics.fill(fill)
  })
}

const drawOpaqueMaskPolygons = (graphics: Graphics, polygons: Vec2[][]) => {
  polygons.forEach((polygon) => {
    if (polygon.length < 3) {
      return
    }
    drawPolygon(graphics, polygon)
    graphics.fill({ color: 0xffffff, alpha: 1 })
    graphics.beginPath()
  })
}

const drawPolygon = (graphics: Graphics, polygon: Vec2[]) => {
  const flatPolygon = new Array<number>(polygon.length * 2)
  for (let index = 0; index < polygon.length; index += 1) {
    const point = polygon[index]
    const flatIndex = index * 2
    flatPolygon[flatIndex] = point.x
    flatPolygon[flatIndex + 1] = point.y
  }
  graphics.poly(flatPolygon)
}

const drawStrokePaths = (
  graphics: Graphics,
  paths: Vec2[][],
  style: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'> & {
    closed?: boolean
  },
  color: number,
  alpha: number
) => {
  let hasPath = false

  paths.forEach((path) => {
    if (path.length < 2) {
      return
    }
    const first = path[0]
    const last = path[path.length - 1]
    const autoClosed =
      path.length > 2 &&
      Math.abs(first.x - last.x) < 1e-6 &&
      Math.abs(first.y - last.y) < 1e-6
    const closed = style.closed ?? autoClosed
    const drawablePath = closed ? path.slice(0, -1) : path

    graphics.moveTo(first.x, first.y)
    for (let index = 1; index < drawablePath.length; index += 1) {
      const point = drawablePath[index]
      graphics.lineTo(point.x, point.y)
    }
    if (closed) {
      graphics.closePath()
    }
    hasPath = true
  })

  if (!hasPath) {
    return
  }

  graphics.stroke({
    color,
    alpha,
    width: style.width,
    cap: style.cap === 'none' ? 'butt' : style.cap,
    join: style.join,
    miterLimit: style.miterLimit
  })
}

type PaintDomainGradientStyle = RenderFillStyle & {
  __asyraGradientOptions?: CreateRenderGradientFillOptions
}

const scaleGradientPointToBounds = (
  point: { x: number; y: number } | undefined,
  bounds: Bounds
) => {
  if (!point) {
    return undefined
  }

  return {
    x: bounds.minX + point.x * (bounds.maxX - bounds.minX),
    y: bounds.minY + point.y * (bounds.maxY - bounds.minY)
  }
}

const resolvePaintBoundsGradientStyle = (
  style: RenderFillStyle,
  paintBounds?: Bounds
): RenderFillStyle => {
  const gradientOptions = (style as PaintDomainGradientStyle)
    .__asyraGradientOptions
  if (!paintBounds || !gradientOptions) {
    return style
  }

  return createRenderGradientFillStyle({
    ...gradientOptions,
    start: scaleGradientPointToBounds(gradientOptions.start, paintBounds),
    end: scaleGradientPointToBounds(gradientOptions.end, paintBounds),
    center: scaleGradientPointToBounds(gradientOptions.center, paintBounds),
    outerCenter: scaleGradientPointToBounds(
      gradientOptions.outerCenter,
      paintBounds
    )
  })
}

const applyGradientPaint = (
  graphics: Graphics,
  polygons: Vec2[][],
  style: RenderFillStyle,
  paintBounds?: Bounds
) => {
  graphics.clear()
  graphics.mask = null
  drawPolygons(graphics, polygons)
  graphics.fill(
    resolvePaintBoundsGradientStyle(style, paintBounds) as Parameters<
      Graphics['fill']
    >[0]
  )
}

const getPolygonBounds = (polygons: Vec2[][]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygons.forEach((polygon) => {
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  })

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null
  }

  return { minX, minY, maxX, maxY }
}

const applyMaskedSolidPaint = (
  content: Container,
  clipContent: Container,
  fill: Graphics,
  mask: Graphics,
  fillMask: Graphics,
  strokeMask: Graphics,
  polygons: Vec2[][],
  color: number,
  alpha: number,
  fillPolygons?: Vec2[][],
  clipPolygons?: Vec2[][],
  fillClipPolygons?: Vec2[][],
  strokeMaskPolygons?: Vec2[][],
  strokePaths?: Vec2[][],
  strokePathGroups?: SolidCenterStrokeRenderEntry['strokePathGroups'],
  strokePathStyle?: Pick<
    RenderableStroke,
    'width' | 'cap' | 'join' | 'miterLimit'
  >
) => {
  const maskPolygons = clipPolygons ?? polygons
  const bounds = getPolygonBounds(maskPolygons)
  fill.clear()
  mask.clear()
  fillMask.clear()
  strokeMask.clear()
  fill.alpha = alpha
  mask.alpha = 1
  fillMask.alpha = 1

  if (!bounds) {
    return
  }

  const hasFillPolygons = fillPolygons && fillPolygons.length > 0
  const hasClipPolygons = clipPolygons && clipPolygons.length > 0
  const hasFillClipPolygons = fillClipPolygons && fillClipPolygons.length > 0
  const hasStrokeMaskPolygons =
    strokeMaskPolygons && strokeMaskPolygons.length > 0
  const hasStrokePaths =
    strokePaths && strokePaths.length > 0 && strokePathStyle
  const hasStrokePathGroups =
    strokePathGroups !== undefined && strokePathGroups.length > 0
  const canUseStrokePathAsExactMask =
    (hasStrokePaths || hasStrokePathGroups) &&
    !hasClipPolygons &&
    !hasFillClipPolygons &&
    !hasFillPolygons &&
    !hasStrokeMaskPolygons

  content.mask = null
  clipContent.mask = null
  fill.mask = null
  mask.mask = null
  fillMask.mask = null
  strokeMask.mask = null
  if (!hasStrokePaths && hasFillPolygons) {
    drawPolygonsWithCutouts(fill, fillPolygons, { color, alpha: 1 })
    fill.beginPath()
  } else {
    fill
      .rect(
        bounds.minX,
        bounds.minY,
        Math.max(1e-6, bounds.maxX - bounds.minX),
        Math.max(1e-6, bounds.maxY - bounds.minY)
      )
      .fill({ color, alpha: 1 })
  }

  if (hasStrokePaths) {
    drawStrokePaths(strokeMask, strokePaths, strokePathStyle, 0xffffff, 1)
  }
  if (hasStrokePathGroups) {
    strokePathGroups.forEach((group) => {
      const groupStyle = group.strokePathStyle ?? strokePathStyle
      if (!groupStyle) {
        return
      }
      drawStrokePaths(strokeMask, group.strokePaths, groupStyle, 0xffffff, 1)
    })
  }
  if (hasStrokeMaskPolygons) {
    drawOpaqueMaskPolygons(strokeMask, strokeMaskPolygons)
  }
  if (hasStrokePaths || hasStrokePathGroups || hasStrokeMaskPolygons) {
    fill.mask = strokeMask
    clipContent.mask = canUseStrokePathAsExactMask ? null : mask
  } else {
    fill.mask = mask
  }

  if (!canUseStrokePathAsExactMask) {
    drawPolygonsWithCutouts(mask, maskPolygons, { color: 0xffffff, alpha: 1 })
  }
  if (hasFillClipPolygons) {
    drawPolygonsWithCutouts(fillMask, fillClipPolygons, {
      color: 0xffffff,
      alpha: 1
    })
    content.mask = fillMask
  }
}

const applySolidGraphicsPaint = (
  graphics: Graphics,
  polygons: Vec2[][],
  color: number,
  alpha: number
) => {
  graphics.clear()
  graphics.alpha = alpha
  drawPolygonsWithCutouts(graphics, polygons, { color, alpha: 1 })
}

const disposeCacheEntry = (
  entry:
    | SolidStrokeCacheSolidEntry
    | SolidStrokeCacheGradientEntry
    | SolidStrokeCacheMaskedSolidEntry
    | SolidStrokeCacheDragSolidGraphicsEntry
) => {
  if (entry.kind === 'solid') {
    entry.projection.dispose()
    return
  }

  if (isSolidGraphicsCacheEntry(entry)) {
    entry.graphics.destroy()
    return
  }

  if (entry.kind === 'masked-solid') {
    entry.fill.destroy()
    entry.mask.destroy()
    entry.fillMask.destroy()
    entry.strokeMask.destroy()
    entry.clipContent.destroy()
    entry.content.destroy()
    entry.container.destroy()
    return
  }

  entry.graphics.destroy()
  entry.container.destroy()
}

const syncMaskedFillClipLayer = (
  entry: SolidStrokeCacheMaskedSolidEntry,
  fillClipPolygons?: Vec2[][]
) => {
  const shouldAttach = fillClipPolygons && fillClipPolygons.length > 0
  if (shouldAttach && entry.fillMask.parent !== entry.container) {
    entry.container.addChild(entry.fillMask)
    return
  }

  if (!shouldAttach && entry.fillMask.parent === entry.container) {
    entry.container.removeChild(entry.fillMask)
  }
}

const getRevisionDirtyKeys = (
  previous: StrokeRevisionSet | undefined,
  next: StrokeRevisionSet | undefined
) => {
  if (!previous || !next) {
    return null
  }

  return computeStrokeDirtyKeys(previous, next).dirtyKeys
}

const hasGeometryDirtyKey = (dirtyKeys: StrokeDirtyKey[] | null) =>
  dirtyKeys === null ||
  dirtyKeys.some(
    (key) => key !== 'paint-payload' && key !== 'render-hit-export'
  )

const hasPaintDirtyKey = (dirtyKeys: StrokeDirtyKey[] | null) =>
  dirtyKeys === null || dirtyKeys.includes('paint-payload')

const shouldRenderSolidWithMask = (entry: SolidCenterStrokeRenderEntry) =>
  (entry.clipPolygons !== undefined && entry.clipPolygons.length > 0) ||
  (entry.fillPolygons !== undefined && entry.fillPolygons.length > 0) ||
  (entry.strokeMaskPolygons !== undefined &&
    entry.strokeMaskPolygons.length > 0) ||
  (entry.strokePaths !== undefined &&
    entry.strokePaths.length > 0 &&
    entry.strokePathStyle !== undefined) ||
  (entry.strokePathGroups !== undefined && entry.strokePathGroups.length > 0)

const shouldRenderDragVisualWithGraphics = (
  entry: SolidCenterStrokeRenderEntry
) =>
  entry.stroke.kind !== 'gradient' &&
  (
    entry.revisionSet ??
    entry.runtimeMeta?.revisionSet ??
    entry.debugMeta?.revisionSet
  )?.previewModeRevision === 'drag-visual'

const shouldRenderPlainSolidWithGraphics = (
  entry: SolidCenterStrokeRenderEntry,
  shouldUseMaskedSolid: boolean
) => {
  const geometryFamily =
    entry.debugMeta?.geometryFamily ?? entry.runtimeMeta?.geometryFamily
  const hasKnownNonSolidCenterFamily =
    geometryFamily !== undefined && geometryFamily !== 'solid-center'
  const canProjectExactPolygonsWithGraphics =
    geometryFamily === 'solid-center' || geometryFamily === 'constrained-dashed'

  return (
    entry.stroke.kind !== 'gradient' &&
    !shouldUseMaskedSolid &&
    entry.preferSolidGraphics !== false &&
    (canProjectExactPolygonsWithGraphics || !hasKnownNonSolidCenterFamily)
  )
}

const emitStrokePipelineCounter = (counterName: string, value = 1) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

export const renderSolidCenterStrokeEntries = (
  graphic: SolidCenterStrokeRenderGraphic,
  entries: SolidCenterStrokeRenderEntry[]
) => {
  if (!graphic.__asyraStrokeMeshCache) {
    graphic.__asyraStrokeMeshCache = new Map()
  }

  const active = new Set<string>()

  if (entries.length === 0) {
    graphic.__asyraStrokeMeshCache.forEach((entry) => disposeCacheEntry(entry))
    graphic.__asyraStrokeMeshCache.clear()
    return
  }

  entries.forEach((entry) => {
    const polygons = entry.polygons.filter((polygon) => polygon.length >= 3)
    if (polygons.length === 0 || typeof graphic.addChild !== 'function') {
      return
    }

    const existing = graphic.__asyraStrokeMeshCache?.get(entry.cacheKey)
    const revisionSet =
      entry.revisionSet ??
      entry.runtimeMeta?.revisionSet ??
      entry.debugMeta?.revisionSet
    const dirtyKeys = getRevisionDirtyKeys(existing?.revisionSet, revisionSet)
    const geometryDirty = hasGeometryDirtyKey(dirtyKeys)
    const paintDirty = hasPaintDirtyKey(dirtyKeys)
    const strokeKind = entry.stroke.kind ?? 'solid'
    const shouldUseMaskedSolid =
      strokeKind === 'solid' && shouldRenderSolidWithMask(entry)
    const targetCacheKind = shouldUseMaskedSolid
      ? 'masked-solid'
      : shouldRenderDragVisualWithGraphics(entry)
        ? 'drag-solid-graphics'
        : shouldRenderPlainSolidWithGraphics(entry, shouldUseMaskedSolid)
          ? 'solid-graphics'
          : strokeKind
    const paintKey =
      entry.stroke.paintKey ??
      `solid:${entry.stroke.color}:${entry.stroke.alpha}`
    const revisionGeometrySignature = getRevisionGeometrySignature(revisionSet)
    const getGeometrySignature = () => {
      if (revisionGeometrySignature) {
        return shouldUseMaskedSolid
          ? `${revisionGeometrySignature}|${getMaskedSolidDescriptorSummarySignature(
              entry,
              polygons
            )}`
          : revisionGeometrySignature
      }

      const descriptorSignature = shouldUseMaskedSolid
        ? getMaskedSolidDescriptorSignature(entry, polygons)
        : null
      emitStrokePipelineCounter('stroke-render-coordinate-signature-rebuilt')
      return descriptorSignature ?? getSignature(polygons)
    }
    const signature = getGeometrySignature()

    if (existing && existing.kind !== targetCacheKind) {
      disposeCacheEntry(existing)
      graphic.__asyraStrokeMeshCache?.delete(entry.cacheKey)
    }

    const compatibleEntry = graphic.__asyraStrokeMeshCache?.get(entry.cacheKey)

    if (
      compatibleEntry &&
      dirtyKeys !== null &&
      !geometryDirty &&
      compatibleEntry.signature === signature
    ) {
      const paintChanged = compatibleEntry.paintKey !== paintKey
      if (paintDirty || paintChanged) {
        if (compatibleEntry.kind === 'solid') {
          compatibleEntry.projection.updatePaint({
            kind: 'solid',
            color: entry.stroke.color,
            alpha: entry.stroke.alpha
          })
        } else if (compatibleEntry.kind === 'gradient') {
          const gradientStyle = entry.stroke.gradientStyle
          if (gradientStyle) {
            applyGradientPaint(
              compatibleEntry.graphics,
              polygons,
              gradientStyle,
              entry.paintBounds
            )
          }
        } else if (compatibleEntry.kind === 'masked-solid') {
          syncMaskedFillClipLayer(compatibleEntry, entry.fillClipPolygons)
          applyMaskedSolidPaint(
            compatibleEntry.content,
            compatibleEntry.clipContent,
            compatibleEntry.fill,
            compatibleEntry.mask,
            compatibleEntry.fillMask,
            compatibleEntry.strokeMask,
            polygons,
            entry.stroke.color,
            entry.stroke.alpha,
            entry.fillPolygons,
            entry.clipPolygons,
            entry.fillClipPolygons,
            entry.strokeMaskPolygons,
            entry.strokePaths,
            entry.strokePathGroups,
            entry.strokePathStyle
          )
        } else if (isSolidGraphicsCacheEntry(compatibleEntry)) {
          applySolidGraphicsPaint(
            compatibleEntry.graphics,
            polygons,
            entry.stroke.color,
            entry.stroke.alpha
          )
        }
      }

      compatibleEntry.paintKey = paintKey
      compatibleEntry.revisionSet = revisionSet
      compatibleEntry.lastDirtyKeys = dirtyKeys
      if (compatibleEntry.kind === 'solid') {
        compatibleEntry.projection.setVisible(true)
      } else {
        if (isSolidGraphicsCacheEntry(compatibleEntry)) {
          compatibleEntry.graphics.visible = true
        } else {
          compatibleEntry.container.visible = true
        }
      }
      active.add(entry.cacheKey)
      return
    }

    if (
      compatibleEntry &&
      dirtyKeys !== null &&
      !geometryDirty &&
      !paintDirty &&
      compatibleEntry.signature === signature &&
      compatibleEntry.paintKey === paintKey
    ) {
      compatibleEntry.revisionSet = revisionSet
      compatibleEntry.lastDirtyKeys = []
      if (compatibleEntry.kind === 'gradient') {
        compatibleEntry.container.visible = true
      } else if (compatibleEntry.kind === 'masked-solid') {
        compatibleEntry.container.visible = true
      } else if (isSolidGraphicsCacheEntry(compatibleEntry)) {
        compatibleEntry.graphics.visible = true
      } else {
        compatibleEntry.projection.setVisible(true)
      }
      active.add(entry.cacheKey)
      return
    }

    if (targetCacheKind === 'masked-solid') {
      if (
        compatibleEntry &&
        compatibleEntry.kind === 'masked-solid' &&
        (dirtyKeys !== null
          ? !geometryDirty &&
            !paintDirty &&
            compatibleEntry.signature === signature &&
            compatibleEntry.paintKey === paintKey
          : compatibleEntry.signature === signature &&
            compatibleEntry.paintKey === paintKey)
      ) {
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = dirtyKeys ?? []
        compatibleEntry.container.visible = true
        active.add(entry.cacheKey)
        return
      }

      if (
        compatibleEntry &&
        compatibleEntry.kind === 'masked-solid' &&
        (dirtyKeys === null ||
          geometryDirty ||
          paintDirty ||
          compatibleEntry.signature !== signature ||
          compatibleEntry.paintKey !== paintKey)
      ) {
        syncMaskedFillClipLayer(compatibleEntry, entry.fillClipPolygons)
        applyMaskedSolidPaint(
          compatibleEntry.content,
          compatibleEntry.clipContent,
          compatibleEntry.fill,
          compatibleEntry.mask,
          compatibleEntry.fillMask,
          compatibleEntry.strokeMask,
          polygons,
          entry.stroke.color,
          entry.stroke.alpha,
          entry.fillPolygons,
          entry.clipPolygons,
          entry.fillClipPolygons,
          entry.strokeMaskPolygons,
          entry.strokePaths,
          entry.strokePathGroups,
          entry.strokePathStyle
        )
        compatibleEntry.signature = signature
        compatibleEntry.paintKey = paintKey
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = dirtyKeys ?? []
        compatibleEntry.container.visible = true
        active.add(entry.cacheKey)
        return
      }

      const container = new Container()
      const content = new Container()
      const clipContent = new Container()
      const fill = new Graphics()
      const mask = new Graphics()
      const fillMask = new Graphics()
      const strokeMask = new Graphics()
      clipContent.addChild(fill)
      content.addChild(clipContent)
      container.addChild(content)
      container.addChild(mask)
      container.addChild(strokeMask)
      if (entry.fillClipPolygons && entry.fillClipPolygons.length > 0) {
        container.addChild(fillMask)
      }
      applyMaskedSolidPaint(
        content,
        clipContent,
        fill,
        mask,
        fillMask,
        strokeMask,
        polygons,
        entry.stroke.color,
        entry.stroke.alpha,
        entry.fillPolygons,
        entry.clipPolygons,
        entry.fillClipPolygons,
        entry.strokeMaskPolygons,
        entry.strokePaths,
        entry.strokePathGroups,
        entry.strokePathStyle
      )

      if (!graphic.addChild(container)) {
        container.destroy()
        return
      }

      graphic.__asyraStrokeMeshCache?.set(entry.cacheKey, {
        kind: 'masked-solid',
        container,
        content,
        clipContent,
        fill,
        mask,
        fillMask,
        strokeMask,
        signature,
        paintKey,
        revisionSet,
        lastDirtyKeys: []
      })
      active.add(entry.cacheKey)
      return
    }

    if (
      targetCacheKind === 'drag-solid-graphics' ||
      targetCacheKind === 'solid-graphics'
    ) {
      if (
        compatibleEntry &&
        compatibleEntry.kind === targetCacheKind &&
        (dirtyKeys !== null
          ? !geometryDirty &&
            !paintDirty &&
            compatibleEntry.signature === signature &&
            compatibleEntry.paintKey === paintKey
          : compatibleEntry.signature === signature &&
            compatibleEntry.paintKey === paintKey)
      ) {
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = dirtyKeys ?? []
        compatibleEntry.graphics.visible = true
        active.add(entry.cacheKey)
        return
      }

      if (
        compatibleEntry &&
        compatibleEntry.kind === targetCacheKind &&
        (dirtyKeys === null ||
          geometryDirty ||
          paintDirty ||
          compatibleEntry.signature !== signature ||
          compatibleEntry.paintKey !== paintKey)
      ) {
        applySolidGraphicsPaint(
          compatibleEntry.graphics,
          polygons,
          entry.stroke.color,
          entry.stroke.alpha
        )
        compatibleEntry.signature = signature
        compatibleEntry.paintKey = paintKey
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = dirtyKeys ?? []
        compatibleEntry.graphics.visible = true
        active.add(entry.cacheKey)
        return
      }

      const graphics = new Graphics()
      applySolidGraphicsPaint(
        graphics,
        polygons,
        entry.stroke.color,
        entry.stroke.alpha
      )

      if (!graphic.addChild(graphics)) {
        graphics.destroy()
        return
      }

      graphic.__asyraStrokeMeshCache?.set(entry.cacheKey, {
        kind: targetCacheKind,
        graphics,
        signature,
        paintKey,
        revisionSet,
        lastDirtyKeys: []
      })
      active.add(entry.cacheKey)
      return
    }

    if (strokeKind === 'gradient') {
      const gradientStyle = entry.stroke.gradientStyle
      if (!gradientStyle) {
        return
      }

      if (
        compatibleEntry &&
        compatibleEntry.kind === 'gradient' &&
        (dirtyKeys !== null
          ? !geometryDirty && !paintDirty
          : compatibleEntry.signature === signature &&
            compatibleEntry.paintKey === paintKey)
      ) {
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = dirtyKeys ?? []
        compatibleEntry.container.visible = true
        active.add(entry.cacheKey)
        return
      }

      if (
        compatibleEntry &&
        compatibleEntry.kind === 'gradient' &&
        (dirtyKeys === null ||
          geometryDirty ||
          paintDirty ||
          compatibleEntry.signature !== signature ||
          compatibleEntry.paintKey !== paintKey)
      ) {
        applyGradientPaint(
          compatibleEntry.graphics,
          polygons,
          gradientStyle,
          entry.paintBounds
        )
        compatibleEntry.signature = signature
        compatibleEntry.paintKey = paintKey
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = dirtyKeys ?? []
        compatibleEntry.container.visible = true
        active.add(entry.cacheKey)
        return
      }

      const container = new Container()
      const gradientGraphic = new Graphics()
      container.addChild(gradientGraphic)
      applyGradientPaint(
        gradientGraphic,
        polygons,
        gradientStyle,
        entry.paintBounds
      )

      if (!graphic.addChild(container)) {
        container.destroy()
        return
      }

      graphic.__asyraStrokeMeshCache?.set(entry.cacheKey, {
        kind: 'gradient',
        container,
        graphics: gradientGraphic,
        signature,
        paintKey,
        revisionSet,
        lastDirtyKeys: []
      })
      active.add(entry.cacheKey)
      return
    }

    if (!compatibleEntry) {
      const geometryModel = buildGeometryModel(polygons)
      const projection = createMeshProjection({
        model: geometryModel,
        paint: {
          kind: 'solid',
          color: entry.stroke.color,
          alpha: entry.stroke.alpha
        }
      })

      if (!projection.attach(graphic)) {
        projection.dispose()
        return
      }

      graphic.__asyraStrokeMeshCache?.set(entry.cacheKey, {
        kind: 'solid',
        projection,
        signature,
        paintKey,
        revisionSet,
        lastDirtyKeys: []
      })
      active.add(entry.cacheKey)
      return
    }

    if (
      compatibleEntry.kind === 'solid' &&
      (dirtyKeys !== null
        ? geometryDirty ||
          paintDirty ||
          compatibleEntry.signature !== signature ||
          compatibleEntry.paintKey !== paintKey
        : compatibleEntry.signature !== signature ||
          compatibleEntry.paintKey !== paintKey)
    ) {
      const geometryModel = buildGeometryModel(polygons)
      compatibleEntry.projection.update({
        model: geometryModel,
        paint: {
          kind: 'solid',
          color: entry.stroke.color,
          alpha: entry.stroke.alpha
        }
      })
      compatibleEntry.signature = signature
      compatibleEntry.paintKey = paintKey
      compatibleEntry.revisionSet = revisionSet
      compatibleEntry.lastDirtyKeys = dirtyKeys ?? []
    }

    if (compatibleEntry.kind === 'solid') {
      if (dirtyKeys !== null && !geometryDirty && !paintDirty) {
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = []
      }
      compatibleEntry.projection.setVisible(true)
    } else if (compatibleEntry.kind === 'masked-solid') {
      compatibleEntry.container.visible = true
    } else if (isSolidGraphicsCacheEntry(compatibleEntry)) {
      compatibleEntry.graphics.visible = true
    }
    active.add(entry.cacheKey)
  })

  graphic.__asyraStrokeMeshCache.forEach((entry, key) => {
    if (active.has(key)) {
      return
    }

    disposeCacheEntry(entry)
    graphic.__asyraStrokeMeshCache?.delete(key)
  })
}

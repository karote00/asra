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
  fillExcludePolygons?: Vec2[][]
  strokeMaskPolygons?: Vec2[][]
  strokePaths?: Vec2[][]
  strokePathGroups?: {
    clipPolygons?: Vec2[][]
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
  lastUsedRenderGeneration?: number
}

interface SolidStrokeCacheGradientEntry {
  kind: 'gradient'
  container: Container
  graphics: Graphics
  signature: string
  paintKey: string
  revisionSet?: StrokeRevisionSet
  lastDirtyKeys?: StrokeDirtyKey[]
  lastUsedRenderGeneration?: number
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
  color: number
  alpha: number
  revisionSet?: StrokeRevisionSet
  lastDirtyKeys?: StrokeDirtyKey[]
  lastUsedRenderGeneration?: number
}

interface SolidStrokeCacheSolidGraphicsEntry {
  kind: 'solid-graphics'
  graphics: Graphics
  signature: string
  coordinateSignature?: string
  paintKey: string
  color: number
  alpha: number
  revisionSet?: StrokeRevisionSet
  lastDirtyKeys?: StrokeDirtyKey[]
  lastUsedRenderGeneration?: number
}

interface SolidCenterStrokeRenderGraphic {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addChild?: (...args: any[]) => unknown
  __asyraStrokeMeshCacheRenderGeneration?: number
  __asyraStrokeMeshCache?: Map<
    string,
    | SolidStrokeCacheSolidEntry
    | SolidStrokeCacheGradientEntry
    | SolidStrokeCacheMaskedSolidEntry
    | SolidStrokeCacheSolidGraphicsEntry
  >
}

const STROKE_MESH_INACTIVE_RETAIN_GENERATIONS = 32

const isSolidGraphicsCacheEntry = (
  entry:
    | SolidStrokeCacheSolidEntry
    | SolidStrokeCacheGradientEntry
    | SolidStrokeCacheMaskedSolidEntry
    | SolidStrokeCacheSolidGraphicsEntry
): entry is SolidStrokeCacheSolidGraphicsEntry =>
  entry.kind === 'solid-graphics'

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
    getSignature(entry.fillExcludePolygons ?? []),
    getSignature(entry.strokeMaskPolygons ?? []),
    getSignature(entry.strokePaths ?? []),
    entry.strokePathGroups
      ?.map((group) =>
        [
          getSignature(group.strokePaths),
          getSignature(group.clipPolygons ?? []),
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
        revisionSet.domainPlanRevision,
        revisionSet.sharedGeometryRevision,
        revisionSet.strokeProductRevision,
        revisionSet.strokeDomainRevision,
        revisionSet.strokeFamilyRevision ?? '',
        revisionSet.intervalAllocationRevision,
        revisionSet.dashScheduleRevision ?? '',
        revisionSet.terminalCapRevision ?? '',
        revisionSet.joinShapeRevision ?? '',
        revisionSet.smoothContinuityRevision ?? '',
        revisionSet.productMaterializationRevision ?? '',
        revisionSet.ownershipRevision,
        revisionSet.legalityRevision,
        revisionSet.resolvedRegionRevision ?? '',
        revisionSet.renderOutputRevision ?? ''
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

const ensurePositivePolygonWinding = (polygon: Vec2[]) =>
  getSignedPolygonArea(polygon) >= 0 ? polygon : [...polygon].reverse()

const ensureNegativePolygonWinding = (polygon: Vec2[]) =>
  getSignedPolygonArea(polygon) < 0 ? polygon : [...polygon].reverse()

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

interface StrokePathGroupClipLayer {
  stroke: Graphics
  mask: Graphics
}

interface StrokePathGroupClipContainer extends Container {
  __asyraStrokePathGroupClipLayers?: StrokePathGroupClipLayer[]
}
const resetUnusedStrokePathGroupClipLayers = (
  container: Container,
  usedCount: number
) => {
  const owner = container as StrokePathGroupClipContainer
  owner.__asyraStrokePathGroupClipLayers?.slice(usedCount).forEach((layer) => {
    layer.stroke.clear()
    layer.mask.clear()
    layer.stroke.mask = null
    layer.stroke.visible = false
    layer.mask.visible = false
  })
}

const drawClippedStrokePathGroups = (
  container: Container,
  groups: NonNullable<SolidCenterStrokeRenderEntry['strokePathGroups']>,
  baseStyle: SolidCenterStrokeRenderEntry['strokePathStyle'],
  color: number,
  alpha: number
) => {
  const owner = container as StrokePathGroupClipContainer
  if (!owner.__asyraStrokePathGroupClipLayers) {
    owner.__asyraStrokePathGroupClipLayers = []
  }

  let usedLayerCount = 0
  groups.forEach((group) => {
    if (!group.clipPolygons || group.clipPolygons.length === 0) {
      return
    }
    const groupStyle = group.strokePathStyle ?? baseStyle
    if (!groupStyle || group.strokePaths.length === 0) {
      return
    }

    let layer = owner.__asyraStrokePathGroupClipLayers?.[usedLayerCount]
    if (!layer) {
      layer = { stroke: new Graphics(), mask: new Graphics() }
      owner.__asyraStrokePathGroupClipLayers?.push(layer)
      container.addChild(layer.stroke)
      container.addChild(layer.mask)
    } else {
      if (layer.stroke.parent !== container) {
        container.addChild(layer.stroke)
      }
      if (layer.mask.parent !== container) {
        container.addChild(layer.mask)
      }
      layer.stroke.clear()
      layer.mask.clear()
    }

    drawStrokePaths(layer.stroke, group.strokePaths, groupStyle, color, alpha)
    drawPolygonsWithCutouts(layer.mask, group.clipPolygons, {
      color: 0xffffff,
      alpha: 1
    })
    layer.stroke.mask = layer.mask
    layer.stroke.visible = true
    layer.mask.visible = true
    usedLayerCount += 1
  })
  resetUnusedStrokePathGroupClipLayers(container, usedLayerCount)
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
  fillExcludePolygons?: Vec2[][],
  strokeMaskPolygons?: Vec2[][],
  strokePaths?: Vec2[][],
  strokePathGroups?: SolidCenterStrokeRenderEntry['strokePathGroups'],
  strokePathStyle?: Pick<
    RenderableStroke,
    'width' | 'cap' | 'join' | 'miterLimit'
  >
) => {
  const hasStrokeMaskPolygons =
    strokeMaskPolygons && strokeMaskPolygons.length > 0
  content.alpha = alpha
  fill.clear()
  mask.clear()
  fillMask.clear()
  strokeMask.clear()
  fill.alpha = 1
  mask.alpha = 1
  fillMask.alpha = 1

  const hasFillPolygons = fillPolygons && fillPolygons.length > 0
  const hasClipPolygons = clipPolygons && clipPolygons.length > 0
  const hasFillClipPolygons = fillClipPolygons && fillClipPolygons.length > 0
  const hasFillExcludePolygons =
    fillExcludePolygons !== undefined && fillExcludePolygons.length > 0
  const hasStrokePaths =
    strokePaths && strokePaths.length > 0 && strokePathStyle
  const hasStrokePathGroups =
    strokePathGroups !== undefined && strokePathGroups.length > 0
  const clippedStrokePathGroups =
    strokePathGroups?.filter(
      (group) => group.clipPolygons && group.clipPolygons.length > 0
    ) ?? []
  const unclippedStrokePathGroups =
    strokePathGroups?.filter(
      (group) => !group.clipPolygons || group.clipPolygons.length === 0
    ) ?? []
  const canUseStrokePathAsExactMask =
    (hasStrokePaths || hasStrokePathGroups || hasStrokeMaskPolygons) &&
    !hasClipPolygons &&
    !hasFillClipPolygons &&
    !hasFillExcludePolygons &&
    !hasFillPolygons
  const canDrawStrokeGeometryDirectlyWithFillClip =
    hasFillClipPolygons &&
    !hasFillPolygons &&
    !hasClipPolygons &&
    !hasFillExcludePolygons &&
    clippedStrokePathGroups.length === 0 &&
    (hasStrokePaths || hasStrokePathGroups || hasStrokeMaskPolygons)

  content.mask = null
  clipContent.mask = null
  fill.mask = null
  mask.mask = null
  fillMask.mask = null
  strokeMask.mask = null
  resetUnusedStrokePathGroupClipLayers(clipContent, 0)

  if (canDrawStrokeGeometryDirectlyWithFillClip) {
    if (hasStrokePaths) {
      drawStrokePaths(fill, strokePaths, strokePathStyle, color, 1)
    }
    if (unclippedStrokePathGroups.length > 0) {
      unclippedStrokePathGroups.forEach((group) => {
        const groupStyle = group.strokePathStyle ?? strokePathStyle
        if (!groupStyle) {
          return
        }
        drawStrokePaths(fill, group.strokePaths, groupStyle, color, 1)
      })
    }
    if (hasStrokeMaskPolygons) {
      drawPolygonsWithCutouts(fill, strokeMaskPolygons, { color, alpha: 1 })
    }
    drawPolygonsWithCutouts(fillMask, fillClipPolygons, {
      color: 0xffffff,
      alpha: 1
    })
    content.mask = fillMask
    return
  }

  const maskPolygons = clipPolygons ?? polygons
  const paintBoundsPolygons =
    clipPolygons ?? (hasStrokeMaskPolygons ? strokeMaskPolygons : polygons)
  const bounds = getPolygonBounds(paintBoundsPolygons)
  if (!bounds) {
    return
  }

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
  if (unclippedStrokePathGroups.length > 0) {
    unclippedStrokePathGroups.forEach((group) => {
      const groupStyle = group.strokePathStyle ?? strokePathStyle
      if (!groupStyle) {
        return
      }
      drawStrokePaths(strokeMask, group.strokePaths, groupStyle, 0xffffff, 1)
    })
  }
  if (clippedStrokePathGroups.length > 0) {
    drawClippedStrokePathGroups(
      clipContent,
      clippedStrokePathGroups,
      strokePathStyle,
      color,
      1
    )
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
  if (hasFillClipPolygons || hasFillExcludePolygons) {
    const fillMaskPolygons = hasFillClipPolygons
      ? fillClipPolygons
      : [
          ensurePositivePolygonWinding([
            { x: bounds.minX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.maxY },
            { x: bounds.minX, y: bounds.maxY }
          ]),
          ...(fillExcludePolygons ?? []).map(ensureNegativePolygonWinding)
        ]
    drawPolygonsWithCutouts(fillMask, fillMaskPolygons, {
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
    | SolidStrokeCacheSolidGraphicsEntry
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

const setCacheEntryVisible = (
  entry:
    | SolidStrokeCacheSolidEntry
    | SolidStrokeCacheGradientEntry
    | SolidStrokeCacheMaskedSolidEntry
    | SolidStrokeCacheSolidGraphicsEntry,
  visible: boolean
) => {
  if (entry.kind === 'solid') {
    entry.projection.setVisible(visible)
    return
  }

  if (isSolidGraphicsCacheEntry(entry)) {
    entry.graphics.visible = visible
    return
  }

  entry.container.visible = visible
}

const syncMaskedFillClipLayer = (
  entry: SolidStrokeCacheMaskedSolidEntry,
  fillClipPolygons?: Vec2[][],
  fillExcludePolygons?: Vec2[][]
) => {
  const shouldAttach =
    (fillClipPolygons !== undefined && fillClipPolygons.length > 0) ||
    (fillExcludePolygons !== undefined && fillExcludePolygons.length > 0)
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
  (entry.fillExcludePolygons !== undefined &&
    entry.fillExcludePolygons.length > 0) ||
  (entry.strokeMaskPolygons !== undefined &&
    entry.strokeMaskPolygons.length > 0) ||
  (entry.strokePaths !== undefined &&
    entry.strokePaths.length > 0 &&
    entry.strokePathStyle !== undefined) ||
  (entry.strokePathGroups !== undefined && entry.strokePathGroups.length > 0)

const shouldRenderPlainSolidWithGraphics = (
  entry: SolidCenterStrokeRenderEntry,
  shouldUseMaskedSolid: boolean
) => {
  const productMode =
    entry.debugMeta?.productMode ?? entry.runtimeMeta?.productMode
  const productSignature =
    entry.debugMeta?.productSignature ?? entry.runtimeMeta?.productSignature
  const hasKnownNonCenterProduct =
    productMode !== undefined && productMode !== 'center-product'
  const canProjectExactPolygonsWithGraphics =
    productMode === 'center-product' ||
    productSignature?.startsWith('constrained-dashed:') === true

  return (
    entry.stroke.kind !== 'gradient' &&
    !shouldUseMaskedSolid &&
    entry.preferSolidGraphics !== false &&
    (canProjectExactPolygonsWithGraphics || !hasKnownNonCenterProduct)
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
  const renderGeneration =
    (graphic.__asyraStrokeMeshCacheRenderGeneration ?? 0) + 1
  graphic.__asyraStrokeMeshCacheRenderGeneration = renderGeneration

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

    const revisionSet =
      entry.revisionSet ??
      entry.runtimeMeta?.revisionSet ??
      entry.debugMeta?.revisionSet
    const strokeKind = entry.stroke.kind ?? 'solid'
    const shouldUseMaskedSolid =
      strokeKind === 'solid' && shouldRenderSolidWithMask(entry)
    const targetCacheKind = shouldUseMaskedSolid
      ? 'masked-solid'
      : shouldRenderPlainSolidWithGraphics(entry, shouldUseMaskedSolid)
        ? 'solid-graphics'
        : strokeKind
    const paintKey =
      entry.stroke.paintKey ??
      `solid:${entry.stroke.color}:${entry.stroke.alpha}`
    const revisionGeometrySignature = getRevisionGeometrySignature(revisionSet)
    const getGeometrySignature = () => {
      if (revisionGeometrySignature) {
        return revisionGeometrySignature
      }

      const descriptorSignature = shouldUseMaskedSolid
        ? getMaskedSolidDescriptorSignature(entry, polygons)
        : null
      emitStrokePipelineCounter('stroke-render-coordinate-signature-rebuilt')
      return descriptorSignature ?? getSignature(polygons)
    }
    const signature = getGeometrySignature()
    const renderCacheKey = entry.cacheKey
    const existing = graphic.__asyraStrokeMeshCache?.get(renderCacheKey)
    const dirtyKeys = getRevisionDirtyKeys(existing?.revisionSet, revisionSet)
    const geometryDirty = hasGeometryDirtyKey(dirtyKeys)
    const paintDirty = hasPaintDirtyKey(dirtyKeys)

    if (existing && existing.kind !== targetCacheKind) {
      disposeCacheEntry(existing)
      graphic.__asyraStrokeMeshCache?.delete(renderCacheKey)
    }

    const compatibleEntry = graphic.__asyraStrokeMeshCache?.get(renderCacheKey)

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
          if (compatibleEntry.color === entry.stroke.color) {
            compatibleEntry.content.alpha = entry.stroke.alpha
          } else {
            syncMaskedFillClipLayer(
              compatibleEntry,
              entry.fillClipPolygons,
              entry.fillExcludePolygons
            )
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
              entry.fillExcludePolygons,
              entry.strokeMaskPolygons,
              entry.strokePaths,
              entry.strokePathGroups,
              entry.strokePathStyle
            )
            compatibleEntry.color = entry.stroke.color
          }
          compatibleEntry.alpha = entry.stroke.alpha
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
      active.add(renderCacheKey)
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
      active.add(renderCacheKey)
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
        active.add(renderCacheKey)
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
        syncMaskedFillClipLayer(
          compatibleEntry,
          entry.fillClipPolygons,
          entry.fillExcludePolygons
        )
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
          entry.fillExcludePolygons,
          entry.strokeMaskPolygons,
          entry.strokePaths,
          entry.strokePathGroups,
          entry.strokePathStyle
        )
        compatibleEntry.signature = signature
        compatibleEntry.paintKey = paintKey
        compatibleEntry.color = entry.stroke.color
        compatibleEntry.alpha = entry.stroke.alpha
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = dirtyKeys ?? []
        compatibleEntry.container.visible = true
        active.add(renderCacheKey)
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
      if (
        (entry.fillClipPolygons && entry.fillClipPolygons.length > 0) ||
        (entry.fillExcludePolygons && entry.fillExcludePolygons.length > 0)
      ) {
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
        entry.fillExcludePolygons,
        entry.strokeMaskPolygons,
        entry.strokePaths,
        entry.strokePathGroups,
        entry.strokePathStyle
      )

      if (!graphic.addChild(container)) {
        container.destroy()
        return
      }

      graphic.__asyraStrokeMeshCache?.set(renderCacheKey, {
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
        color: entry.stroke.color,
        alpha: entry.stroke.alpha,
        revisionSet,
        lastDirtyKeys: []
      })
      active.add(renderCacheKey)
      return
    }

    if (targetCacheKind === 'solid-graphics') {
      const coordinateSignature = getSignature(polygons)
      if (
        compatibleEntry &&
        compatibleEntry.kind === targetCacheKind &&
        compatibleEntry.coordinateSignature === coordinateSignature &&
        compatibleEntry.color === entry.stroke.color &&
        compatibleEntry.alpha !== entry.stroke.alpha
      ) {
        compatibleEntry.graphics.alpha = entry.stroke.alpha
        compatibleEntry.signature = signature
        compatibleEntry.paintKey = paintKey
        compatibleEntry.alpha = entry.stroke.alpha
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = dirtyKeys ?? ['paint-payload']
        compatibleEntry.graphics.visible = true
        active.add(renderCacheKey)
        return
      }

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
        active.add(renderCacheKey)
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
        if (
          compatibleEntry.coordinateSignature === coordinateSignature &&
          compatibleEntry.color === entry.stroke.color
        ) {
          compatibleEntry.graphics.alpha = entry.stroke.alpha
        } else {
          applySolidGraphicsPaint(
            compatibleEntry.graphics,
            polygons,
            entry.stroke.color,
            entry.stroke.alpha
          )
          compatibleEntry.coordinateSignature = coordinateSignature
          compatibleEntry.color = entry.stroke.color
        }
        compatibleEntry.signature = signature
        compatibleEntry.paintKey = paintKey
        compatibleEntry.alpha = entry.stroke.alpha
        compatibleEntry.revisionSet = revisionSet
        compatibleEntry.lastDirtyKeys = dirtyKeys ?? []
        compatibleEntry.graphics.visible = true
        active.add(renderCacheKey)
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

      graphic.__asyraStrokeMeshCache?.set(renderCacheKey, {
        kind: targetCacheKind,
        graphics,
        signature,
        coordinateSignature,
        paintKey,
        color: entry.stroke.color,
        alpha: entry.stroke.alpha,
        revisionSet,
        lastDirtyKeys: []
      })
      active.add(renderCacheKey)
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
        active.add(renderCacheKey)
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
        active.add(renderCacheKey)
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

      graphic.__asyraStrokeMeshCache?.set(renderCacheKey, {
        kind: 'gradient',
        container,
        graphics: gradientGraphic,
        signature,
        paintKey,
        revisionSet,
        lastDirtyKeys: []
      })
      active.add(renderCacheKey)
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

      graphic.__asyraStrokeMeshCache?.set(renderCacheKey, {
        kind: 'solid',
        projection,
        signature,
        paintKey,
        revisionSet,
        lastDirtyKeys: []
      })
      active.add(renderCacheKey)
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
    active.add(renderCacheKey)
  })

  graphic.__asyraStrokeMeshCache.forEach((entry, key) => {
    if (active.has(key)) {
      entry.lastUsedRenderGeneration = renderGeneration
      return
    }

    const inactiveAge = renderGeneration - (entry.lastUsedRenderGeneration ?? 0)
    if (inactiveAge <= STROKE_MESH_INACTIVE_RETAIN_GENERATIONS) {
      setCacheEntryVisible(entry, false)
      return
    }

    disposeCacheEntry(entry)
    graphic.__asyraStrokeMeshCache?.delete(key)
  })
}

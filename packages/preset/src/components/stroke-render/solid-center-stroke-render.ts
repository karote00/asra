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
import type { SolidCenterStrokeGeometryDebugMeta } from './solid-center-stroke-packets'
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
  strokePaths?: Vec2[][]
  strokePathStyle?: Pick<
    RenderableStroke,
    'width' | 'cap' | 'join' | 'miterLimit'
  >
  paintBounds?: Bounds
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
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
  fill: Graphics
  mask: Graphics
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

const getRevisionGeometrySignature = (
  revisionSet: StrokeRevisionSet | undefined
) =>
  revisionSet
    ? [
        revisionSet.sourcePathRevision,
        revisionSet.strokeSpecRevision,
        revisionSet.intervalAllocationRevision,
        revisionSet.topologyClassificationRevision,
        revisionSet.candidateRevision ?? '',
        revisionSet.arrangementRevision ?? '',
        revisionSet.ownershipRevision,
        revisionSet.legalityRevision,
        revisionSet.resolvedRegionRevision ?? '',
        revisionSet.previewModeRevision
      ].join('|')
    : null

const drawPolygons = (graphics: Graphics, polygons: Vec2[][]) => {
  polygons.forEach((polygon) => {
    drawPolygon(graphics, polygon)
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
  style: Pick<RenderableStroke, 'width' | 'cap' | 'join' | 'miterLimit'>,
  color: number,
  alpha: number
) => {
  let hasPath = false

  paths.forEach((path) => {
    if (path.length < 2) {
      return
    }

    const first = path[0]
    graphics.moveTo(first.x, first.y)
    for (let index = 1; index < path.length; index += 1) {
      const point = path[index]
      graphics.lineTo(point.x, point.y)
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
  fill: Graphics,
  mask: Graphics,
  polygons: Vec2[][],
  color: number,
  alpha: number,
  fillPolygons?: Vec2[][],
  clipPolygons?: Vec2[][],
  strokePaths?: Vec2[][],
  strokePathStyle?: Pick<
    RenderableStroke,
    'width' | 'cap' | 'join' | 'miterLimit'
  >
) => {
  const maskPolygons = clipPolygons ?? polygons
  const bounds = getPolygonBounds(maskPolygons)
  fill.clear()
  mask.clear()

  if (!bounds) {
    return
  }

  const hasFillPolygons = fillPolygons && fillPolygons.length > 0
  const hasStrokePaths =
    strokePaths && strokePaths.length > 0 && strokePathStyle

  if (hasFillPolygons) {
    drawPolygons(fill, fillPolygons)
    fill.fill({ color, alpha })
    fill.beginPath()
  } else if (!hasStrokePaths) {
    fill
      .rect(
        bounds.minX,
        bounds.minY,
        Math.max(1e-6, bounds.maxX - bounds.minX),
        Math.max(1e-6, bounds.maxY - bounds.minY)
      )
      .fill({ color, alpha })
  }

  if (hasStrokePaths) {
    drawStrokePaths(fill, strokePaths, strokePathStyle, color, alpha)
  }

  maskPolygons.forEach((polygon) => {
    if (polygon.length < 3) {
      return
    }
    drawPolygon(mask, polygon)
    mask.fill({ color: 0xffffff, alpha: 1 })
  })
  fill.mask = mask
}

const applySolidGraphicsPaint = (
  graphics: Graphics,
  polygons: Vec2[][],
  color: number,
  alpha: number
) => {
  graphics.clear()
  polygons.forEach((polygon) => {
    if (polygon.length < 3) {
      return
    }
    drawPolygon(graphics, polygon)
    graphics.fill({ color, alpha })
  })
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
    entry.container.destroy()
    return
  }

  entry.graphics.destroy()
  entry.container.destroy()
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
  (entry.debugMeta?.geometryFamily === 'solid-center' &&
    entry.debugMeta?.sourceTopology === 'self-intersecting' &&
    entry.debugMeta?.visualOverlapCollapseStatus === 'exact-union') ||
  (entry.clipPolygons !== undefined && entry.clipPolygons.length > 0) ||
  (entry.fillPolygons !== undefined && entry.fillPolygons.length > 0) ||
  (entry.strokePaths !== undefined &&
    entry.strokePaths.length > 0 &&
    entry.strokePathStyle !== undefined)

const shouldRenderDragVisualWithGraphics = (
  entry: SolidCenterStrokeRenderEntry
) =>
  entry.stroke.kind !== 'gradient' &&
  (entry.revisionSet ?? entry.debugMeta?.revisionSet)?.previewModeRevision ===
    'drag-visual'

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
    const revisionSet = entry.revisionSet ?? entry.debugMeta?.revisionSet
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
        : entry.preferSolidGraphics === true && strokeKind === 'solid'
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
      emitStrokePipelineCounter('stroke-render-coordinate-signature-fallback')
      return getSignature(polygons)
    }

    if (existing && existing.kind !== targetCacheKind) {
      disposeCacheEntry(existing)
      graphic.__asyraStrokeMeshCache?.delete(entry.cacheKey)
    }

    const compatibleEntry = graphic.__asyraStrokeMeshCache?.get(entry.cacheKey)

    if (compatibleEntry && dirtyKeys !== null && !geometryDirty) {
      if (paintDirty) {
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
          applyMaskedSolidPaint(
            compatibleEntry.fill,
            compatibleEntry.mask,
            polygons,
            entry.stroke.color,
            entry.stroke.alpha,
            entry.fillPolygons,
            entry.clipPolygons,
            entry.strokePaths,
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

    const signature = getGeometrySignature()

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
        applyMaskedSolidPaint(
          compatibleEntry.fill,
          compatibleEntry.mask,
          polygons,
          entry.stroke.color,
          entry.stroke.alpha,
          entry.fillPolygons,
          entry.clipPolygons,
          entry.strokePaths,
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
      const fill = new Graphics()
      const mask = new Graphics()
      container.addChild(fill)
      container.addChild(mask)
      applyMaskedSolidPaint(
        fill,
        mask,
        polygons,
        entry.stroke.color,
        entry.stroke.alpha,
        entry.fillPolygons,
        entry.clipPolygons,
        entry.strokePaths,
        entry.strokePathStyle
      )

      if (!graphic.addChild(container)) {
        container.destroy()
        return
      }

      graphic.__asyraStrokeMeshCache?.set(entry.cacheKey, {
        kind: 'masked-solid',
        container,
        fill,
        mask,
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

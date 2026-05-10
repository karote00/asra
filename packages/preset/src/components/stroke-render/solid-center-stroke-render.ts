import { Container, Graphics } from 'pixi.js'
import {
  createMeshProjection,
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

export interface SolidCenterStrokeRenderEntry {
  cacheKey: string
  stroke: Pick<
    RenderableStroke,
    'kind' | 'color' | 'alpha' | 'gradientStyle' | 'paintKey'
  >
  polygons: Vec2[][]
  debugMeta?: SolidCenterStrokeGeometryDebugMeta
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

interface SolidCenterStrokeRenderGraphic {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addChild?: (...args: any[]) => unknown
  __asyraStrokeMeshCache?: Map<
    string,
    | SolidStrokeCacheSolidEntry
    | SolidStrokeCacheGradientEntry
    | SolidStrokeCacheMaskedSolidEntry
  >
}

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
        revisionSet.ownershipRevision,
        revisionSet.legalityRevision,
        revisionSet.previewModeRevision
      ].join('|')
    : null

const drawPolygons = (graphics: Graphics, polygons: Vec2[][]) => {
  polygons.forEach((polygon) => {
    const flatPolygon = polygon.flatMap((point) => [point.x, point.y])
    graphics.poly(flatPolygon)
  })
}

const applyGradientPaint = (
  graphics: Graphics,
  polygons: Vec2[][],
  style: RenderFillStyle
) => {
  graphics.clear()
  drawPolygons(graphics, polygons)
  graphics.fill(style as Parameters<Graphics['fill']>[0])
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
  alpha: number
) => {
  const bounds = getPolygonBounds(polygons)
  fill.clear()
  mask.clear()

  if (!bounds) {
    return
  }

  fill
    .rect(
      bounds.minX,
      bounds.minY,
      Math.max(1e-6, bounds.maxX - bounds.minX),
      Math.max(1e-6, bounds.maxY - bounds.minY)
    )
    .fill({ color, alpha })

  drawPolygons(mask, polygons)
  mask.fill({ color: 0xffffff, alpha: 1 })
  fill.mask = mask
}

const disposeCacheEntry = (
  entry:
    | SolidStrokeCacheSolidEntry
    | SolidStrokeCacheGradientEntry
    | SolidStrokeCacheMaskedSolidEntry
) => {
  if (entry.kind === 'solid') {
    entry.projection.dispose()
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
  entry.debugMeta?.geometryFamily === 'solid-center' &&
  entry.debugMeta?.sourceTopology === 'self-intersecting' &&
  entry.debugMeta?.visualOverlapCollapseStatus === 'exact-union'

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
    const targetCacheKind =
      strokeKind === 'solid' && shouldRenderSolidWithMask(entry)
        ? 'masked-solid'
        : strokeKind
    const paintKey =
      entry.stroke.paintKey ??
      `solid:${entry.stroke.color}:${entry.stroke.alpha}`
    const revisionGeometrySignature = getRevisionGeometrySignature(revisionSet)
    const getGeometrySignature = () =>
      revisionGeometrySignature ?? getSignature(polygons)

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
              gradientStyle
            )
          }
        } else if (compatibleEntry.kind === 'masked-solid') {
          applyMaskedSolidPaint(
            compatibleEntry.fill,
            compatibleEntry.mask,
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
        compatibleEntry.container.visible = true
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
          entry.stroke.alpha
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
        entry.stroke.alpha
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
        applyGradientPaint(compatibleEntry.graphics, polygons, gradientStyle)
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
      applyGradientPaint(gradientGraphic, polygons, gradientStyle)

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

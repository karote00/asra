import { Container, Graphics } from 'pixi.js'
import {
  createMeshProjection,
  type GeometryModel,
  type MeshProjection,
  type RenderFillStyle
} from '@asyra/render'
import type { RenderableStroke } from './renderable-stroke'

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
}

interface SolidStrokeCacheSolidEntry {
  kind: 'solid'
  projection: MeshProjection
  signature: string
  paintKey: string
}

interface SolidStrokeCacheGradientEntry {
  kind: 'gradient'
  container: Container
  graphics: Graphics
  signature: string
  paintKey: string
}

interface SolidCenterStrokeRenderGraphic {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addChild?: (...args: any[]) => unknown
  __asyraPhase1MeshCache?: Map<
    string,
    SolidStrokeCacheSolidEntry | SolidStrokeCacheGradientEntry
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

const disposeCacheEntry = (
  entry: SolidStrokeCacheSolidEntry | SolidStrokeCacheGradientEntry
) => {
  if (entry.kind === 'solid') {
    entry.projection.dispose()
    return
  }

  entry.graphics.destroy()
  entry.container.destroy()
}

export const renderSolidCenterStrokeEntries = (
  graphic: SolidCenterStrokeRenderGraphic,
  entries: SolidCenterStrokeRenderEntry[]
) => {
  if (!graphic.__asyraPhase1MeshCache) {
    graphic.__asyraPhase1MeshCache = new Map()
  }

  const active = new Set<string>()

  if (entries.length === 0) {
    graphic.__asyraPhase1MeshCache.forEach((entry) => disposeCacheEntry(entry))
    graphic.__asyraPhase1MeshCache.clear()
    return
  }

  entries.forEach((entry) => {
    const polygons = entry.polygons.filter((polygon) => polygon.length >= 3)
    if (polygons.length === 0 || typeof graphic.addChild !== 'function') {
      return
    }

    const signature = getSignature(polygons)
    const existing = graphic.__asyraPhase1MeshCache?.get(entry.cacheKey)
    const geometryModel = buildGeometryModel(polygons)
    const strokeKind = entry.stroke.kind ?? 'solid'
    const paintKey =
      entry.stroke.paintKey ??
      `solid:${entry.stroke.color}:${entry.stroke.alpha}`

    if (existing && existing.kind !== strokeKind) {
      disposeCacheEntry(existing)
      graphic.__asyraPhase1MeshCache?.delete(entry.cacheKey)
    }

    const compatibleEntry = graphic.__asyraPhase1MeshCache?.get(entry.cacheKey)

    if (strokeKind === 'gradient') {
      const gradientStyle = entry.stroke.gradientStyle
      if (!gradientStyle) {
        return
      }

      if (
        compatibleEntry &&
        compatibleEntry.kind === 'gradient' &&
        compatibleEntry.signature === signature &&
        compatibleEntry.paintKey === paintKey
      ) {
        compatibleEntry.container.visible = true
        active.add(entry.cacheKey)
        return
      }

      if (compatibleEntry && compatibleEntry.kind === 'gradient') {
        applyGradientPaint(compatibleEntry.graphics, polygons, gradientStyle)
        compatibleEntry.signature = signature
        compatibleEntry.paintKey = paintKey
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

      graphic.__asyraPhase1MeshCache?.set(entry.cacheKey, {
        kind: 'gradient',
        container,
        graphics: gradientGraphic,
        signature,
        paintKey
      })
      active.add(entry.cacheKey)
      return
    }

    if (!compatibleEntry) {
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

      graphic.__asyraPhase1MeshCache?.set(entry.cacheKey, {
        kind: 'solid',
        projection,
        signature,
        paintKey
      })
      active.add(entry.cacheKey)
      return
    }

    if (
      compatibleEntry.kind === 'solid' &&
      (compatibleEntry.signature !== signature ||
        compatibleEntry.paintKey !== paintKey)
    ) {
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
    }

    if (compatibleEntry.kind === 'solid') {
      compatibleEntry.projection.setVisible(true)
    }
    active.add(entry.cacheKey)
  })

  graphic.__asyraPhase1MeshCache.forEach((entry, key) => {
    if (active.has(key)) {
      return
    }

    disposeCacheEntry(entry)
    graphic.__asyraPhase1MeshCache?.delete(key)
  })
}

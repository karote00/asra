import {
  createMeshProjection,
  type GeometryModel,
  type MeshProjection
} from '@asyra/render'
import type { RenderableStroke } from './renderable-stroke'

interface Vec2 {
  x: number
  y: number
}

export interface SolidCenterStrokeRenderEntry {
  cacheKey: string
  stroke: Pick<RenderableStroke, 'color' | 'alpha'>
  polygons: Vec2[][]
}

interface SolidCenterStrokeRenderGraphic {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addChild?: (...args: any[]) => unknown
  __asyraPhase1MeshCache?: Map<
    string,
    {
      projection: MeshProjection
      signature: string
      color: number
      alpha: number
    }
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

export const renderSolidCenterStrokeEntries = (
  graphic: SolidCenterStrokeRenderGraphic,
  entries: SolidCenterStrokeRenderEntry[]
) => {
  if (!graphic.__asyraPhase1MeshCache) {
    graphic.__asyraPhase1MeshCache = new Map()
  }

  const active = new Set<string>()

  if (entries.length === 0) {
    graphic.__asyraPhase1MeshCache.forEach(({ projection }) => {
      projection.dispose()
    })
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

    if (!existing) {
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
        projection,
        signature,
        color: entry.stroke.color,
        alpha: entry.stroke.alpha
      })
      active.add(entry.cacheKey)
      return
    }

    if (
      existing.signature !== signature ||
      existing.color !== entry.stroke.color ||
      existing.alpha !== entry.stroke.alpha
    ) {
      existing.projection.update({
        model: geometryModel,
        paint: {
          kind: 'solid',
          color: entry.stroke.color,
          alpha: entry.stroke.alpha
        }
      })
      existing.signature = signature
      existing.color = entry.stroke.color
      existing.alpha = entry.stroke.alpha
    }

    existing.projection.setVisible(true)
    active.add(entry.cacheKey)
  })

  graphic.__asyraPhase1MeshCache.forEach((entry, key) => {
    if (active.has(key)) {
      return
    }

    entry.projection.dispose()
    graphic.__asyraPhase1MeshCache?.delete(key)
  })
}
